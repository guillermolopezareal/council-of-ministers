"""
LLM integration for /ask: natural-language question → Cypher → result.

Flow
────
1. Call claude-sonnet-4-5 with a cached system prompt containing the full
   graph schema.
2. Extract the Cypher from the code block in the response.
3. Reject any query that contains write keywords before it touches Neo4j.
4. Execute the read-only query and serialise the result rows.

Prompt caching is used on the static schema context to cut latency and cost
on every call after the first within the 5-minute cache window.
"""
from __future__ import annotations

import os
import re
from typing import Any

from anthropic import AsyncAnthropic

# ── Safety ────────────────────────────────────────────────────────────────────

# Word-boundary match so "CREATED_AT" does not trigger the block.
_WRITE_RE = re.compile(
    r'\b(CREATE|MERGE|DELETE|SET|REMOVE|DROP|FOREACH)\b',
    re.IGNORECASE,
)


def is_safe_cypher(cypher: str) -> bool:
    """Return True only if the query contains no write keywords."""
    return not bool(_WRITE_RE.search(cypher))


# ── Extraction ────────────────────────────────────────────────────────────────

def extract_cypher(text: str) -> str | None:
    """Pull the first Cypher block out of the LLM response."""
    for pattern in (
        r'```cypher\s*\n(.*?)```',      # ```cypher ... ```
        r'```\s*\n(MATCH[\s\S]*?)```',  # plain ``` starting with MATCH
    ):
        m = re.search(pattern, text, re.DOTALL | re.IGNORECASE)
        if m:
            return m.group(1).strip()
    return None


def extract_explanation(text: str, cypher: str | None) -> str:
    """Return the prose before the code block, or the full text if none."""
    idx = text.find('```')
    if idx > 0:
        return text[:idx].strip()
    # If the block is first, return any trailing text
    if cypher:
        after = text[text.rfind('```') + 3 :].strip()
        if after:
            return after
    return text.strip()


# ── Serialisation ─────────────────────────────────────────────────────────────

def _serialize(v: Any) -> Any:
    """Convert a Neo4j value to a JSON-safe Python value."""
    if v is None or isinstance(v, (str, int, float, bool)):
        return v
    # Neo4j Node / Relationship implement the Mapping protocol
    if hasattr(v, 'items'):
        return {k: _serialize(w) for k, w in dict(v).items()}
    if isinstance(v, list):
        return [_serialize(i) for i in v]
    if isinstance(v, dict):
        return {k: _serialize(w) for k, w in v.items()}
    # datetime, date, time, spatial types
    if hasattr(v, 'isoformat'):
        return v.isoformat()
    return str(v)


def serialize_results(result) -> tuple[list[str], list[list]]:
    """
    Consume a neo4j.Result and return (column_names, rows).
    Caps at 100 rows to keep API responses lean.
    """
    keys = list(result.keys())
    rows: list[list] = []
    for record in result:
        rows.append([_serialize(v) for v in record.values()])
        if len(rows) >= 100:
            break
    return keys, rows


# ── System prompt (cached) ────────────────────────────────────────────────────

SYSTEM_PROMPT = """\
You are a read-only Cypher query assistant for the Spanish BOE (Boletín Oficial\
 del Estado) legislative graph database. Ministers ask questions in Spanish or \
English about Spanish law, and you translate them into precise, read-only Cypher\
 queries that run against Neo4j.

══ GRAPH SCHEMA ══════════════════════════════════════════════════════

Node label: :Norm
Every consolidated norm (law, decree, order, resolution…) is one node.

  id               String   BOE identifier     "BOE-A-1992-26318"
  titulo           String   Full title         "Ley 30/1992, de 26 de noviembre…"
  numero_oficial   String?  Official number    "30/1992"  |  "416/2026"
  rango            String   Norm type          "Ley" | "Ley Orgánica" | "Real Decreto"
                                               | "Real Decreto-ley"
                                               | "Real Decreto Legislativo"
                                               | "Orden" | "Resolución" | "Decreto"
  ambito           String   Scope              "Estatal" | "Autonómico"
  departamento     String   Issuing body       "Ministerio de Justicia"
                                               | "Jefatura del Estado" | …
  fecha_disposicion  String  Date YYYYMMDD     "19921126"  (= 26 Nov 1992)
  fecha_publicacion  String  Publication date  "19921127"
  fecha_derogacion   String? Repeal date       "20210402"
  estatus_derogacion String  "S" = repealed, "N" = in force
  vigencia_agotada   String  "S" = expired,  "N" = valid
  is_dead            Boolean true  ↔  repealed OR expired OR annulled
  in_corpus          Boolean true for the 12 288 corpus norms; false for stubs
  url_html           String? URL on boe.es

Relationships — all DIRECTED from acting norm → affected norm:

  (:Norm)-[:AMENDS   {relacion_codigo, relacion_texto, detail}          ]->(:Norm)
      A modified B  (MODIFICA, AÑADE, SUSTITUYE, DEJA SIN EFECTO,
                     SUSPENDE, SUPRIME, PRORROGA, AMPLÍA)

  (:Norm)-[:REPEALS  {relacion_codigo, relacion_texto, detail, is_partial}]->(:Norm)
      A derogated B  (DEROGA).  is_partial=true when specific articles only.

  (:Norm)-[:CITES    {relacion_codigo, relacion_texto, detail}          ]->(:Norm)
      A invokes B as legal basis  (CITA, DE CONFORMIDAD, SE DESARROLLA,
                                   TRANSPONE, DECLARA la vigencia)

  (:Norm)-[:CORRECTS {relacion_codigo, relacion_texto, detail}          ]->(:Norm)
      A is an erratum correction for B.

══ KEY CYPHER PATTERNS ═══════════════════════════════════════════════

In-force norms:     WHERE n.is_dead = false AND n.in_corpus = true
Dead/repealed:      WHERE n.is_dead = true  AND n.in_corpus = true
National norms:     WHERE n.ambito = 'Estatal'
Leyes only:         WHERE n.rango = 'Ley'
Title search:       WHERE toLower(n.titulo) CONTAINS toLower('texto')
Official number:    WHERE n.numero_oficial = '30/1992' AND n.rango = 'Ley'
Year:               WHERE n.fecha_disposicion STARTS WITH '1992'
Decade:             WHERE n.fecha_disposicion >= '19800101'
                      AND n.fecha_disposicion <= '19891231'

Most amended (in-degree on AMENDS):
  MATCH (:Norm)-[:AMENDS]->(n:Norm)
  WHERE n.is_dead = false AND n.in_corpus = true
  RETURN n.titulo, count(*) AS amendments
  ORDER BY amendments DESC LIMIT 10

Top omnibus (out-degree on AMENDS + REPEALS):
  MATCH (n:Norm)-[:AMENDS|REPEALS]->(target:Norm)
  WHERE n.in_corpus = true
  RETURN n.titulo, count(DISTINCT target) AS targets
  ORDER BY targets DESC LIMIT 10

Ghost citations (in-force norms citing dead law):
  MATCH (live:Norm {is_dead: false})-[:CITES]->(dead:Norm {is_dead: true})
  WHERE live.in_corpus = true AND dead.in_corpus = true
  RETURN live.titulo, dead.titulo AS cita_fantasma, dead.fecha_derogacion
  LIMIT 20

══ OUTPUT FORMAT ═════════════════════════════════════════════════════

Respond with exactly:
1. One sentence (max two) explaining what the query answers — plain language,
   no mention of Cypher or graph internals.
2. A single Cypher query in a ```cypher code block.

Rules:
• Use ONLY: MATCH, OPTIONAL MATCH, RETURN, WITH, WHERE, ORDER BY, LIMIT,
  UNWIND, DISTINCT, count(), collect(), sum(), avg(), min(), max(), type(),
  startNode(), endNode(), toLower(), coalesce(), CASE WHEN … END.
• NEVER use: CREATE, MERGE, DELETE, SET, REMOVE, DROP, FOREACH, CALL.
• Always add LIMIT ≤ 50 unless the question asks for an aggregate count.
• Filter to in_corpus = true unless the question explicitly asks about stubs.
• For title search always wrap both sides in toLower().
• Return column aliases that a minister can read (e.g. AS ley, AS modificaciones).
"""


# ── Main function ─────────────────────────────────────────────────────────────

_client: AsyncAnthropic | None = None


def get_client() -> AsyncAnthropic:
    global _client
    if _client is None:
        _client = AsyncAnthropic()   # reads ANTHROPIC_API_KEY from env
    return _client


async def ask(question: str) -> dict:
    """
    Call the LLM, extract and validate the Cypher.

    Returns a dict with keys: explanation, cypher.
    Raises ValueError if no Cypher is found.
    Raises PermissionError if the Cypher contains write keywords.
    Propagates anthropic.APIError on API failures.
    """
    client = get_client()

    message = await client.messages.create(
        model="claude-sonnet-4-5",
        max_tokens=1024,
        system=[
            {
                "type": "text",
                "text": SYSTEM_PROMPT,
                "cache_control": {"type": "ephemeral"},   # cache the 700-token schema
            }
        ],
        messages=[{"role": "user", "content": question}],
    )

    response_text: str = message.content[0].text  # type: ignore[index]

    cypher = extract_cypher(response_text)
    if not cypher:
        # LLM explained why it can't answer — surface that explanation
        raise ValueError(response_text.strip())

    if not is_safe_cypher(cypher):
        # Surface the matched keywords for transparency
        found = _WRITE_RE.findall(cypher.upper())
        raise PermissionError(
            f"La consulta generada contiene operaciones de escritura "
            f"({', '.join(set(found))}) y ha sido bloqueada."
        )

    explanation = extract_explanation(response_text, cypher)

    return {
        "explanation": explanation,
        "cypher": cypher,
        "usage": {
            "input_tokens":      message.usage.input_tokens,
            "output_tokens":     message.usage.output_tokens,
            "cache_read_tokens": getattr(message.usage, "cache_read_input_tokens", 0),
        },
    }
