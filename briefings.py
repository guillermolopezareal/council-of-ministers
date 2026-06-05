#!/usr/bin/env python3
"""
briefings.py — Run the four Council of Ministers briefings against Neo4j.

Produces:
  BRIEFINGS.md                   plain-language answers, tables, Cypher
  data/briefings/1.json – 4.json structured data for the frontend

Environment (same as load_neo4j.py):
  NEO4J_URI       bolt://localhost:7687
  NEO4J_USER      neo4j
  NEO4J_PASSWORD  (required)

Usage:
  python briefings.py
  python briefings.py --top-n 10 --out-dir reports
"""
from __future__ import annotations

import argparse
import json
import logging
import os
import sys
import time
from datetime import datetime, timezone
from pathlib import Path
from textwrap import dedent

from neo4j import GraphDatabase
from neo4j.exceptions import ServiceUnavailable

# ── Constants ──────────────────────────────────────────────────────────────────

DEFAULT_TOP_N   = 5
DEFAULT_OUT_DIR = Path("data/briefings")
MD_FILE         = Path("BRIEFINGS.md")
LOG_FILE        = Path("briefings.log")

# ── Logging ────────────────────────────────────────────────────────────────────

def setup_logging() -> None:
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(levelname)-8s %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
        handlers=[
            logging.StreamHandler(sys.stdout),
            logging.FileHandler(LOG_FILE, encoding="utf-8"),
        ],
    )

log = logging.getLogger(__name__)

# ── Helpers ────────────────────────────────────────────────────────────────────

def _elapsed_ms(t0: float) -> float:
    return round((time.perf_counter() - t0) * 1000, 1)


def _pct(num: int, denom: int) -> float:
    return round(num / denom * 100, 1) if denom else 0.0


def _short(text: str | None, n: int = 80) -> str:
    if not text:
        return "—"
    return text if len(text) <= n else text[:n - 1] + "…"


def _val(v) -> str:
    """Format a value for a Markdown table cell."""
    if v is None:
        return "—"
    return str(v)


def md_table(headers: list[str], rows: list[list]) -> str:
    """Render a Markdown table with auto-fitted column widths."""
    str_rows = [[_val(c) for c in row] for row in rows]
    widths = [
        max(len(h), max((len(r[i]) for r in str_rows), default=0))
        for i, h in enumerate(headers)
    ]

    def line(cells: list[str]) -> str:
        return "| " + " | ".join(c.ljust(widths[i]) for i, c in enumerate(cells)) + " |"

    sep = "| " + " | ".join("-" * w for w in widths) + " |"
    return "\n".join([line(headers), sep] + [line(r) for r in str_rows])


def run_query(session, cypher: str, params: dict = None) -> tuple[list[dict], float]:
    """Execute a Cypher query; return (records as dicts, elapsed_ms)."""
    t0 = time.perf_counter()
    result = session.run(cypher, params or {})
    records = [dict(r) for r in result]
    return records, _elapsed_ms(t0)

# ── Briefing 1 ─────────────────────────────────────────────────────────────────

B1_CYPHER = dedent("""\
    // Briefing 1 — Norms most amended by other norms
    // Counts incoming AMENDS edges + partial REPEALS edges (article-level derogations).
    // Restricted to in-corpus, in-force norms so we surface today's problem laws.
    MATCH (src:Norm)-[r]->(n:Norm)
    WHERE n.in_corpus = true
      AND n.is_dead   = false
      AND (
            type(r) = 'AMENDS'
        OR (type(r) = 'REPEALS' AND r.is_partial = true)
      )
    WITH  n,
          count(r)           AS amendment_count,
          count(DISTINCT src) AS unique_amenders
    ORDER BY amendment_count DESC
    LIMIT $top_n
    RETURN
      n.id             AS id,
      n.titulo         AS titulo,
      n.numero_oficial AS numero_oficial,
      n.rango          AS rango,
      n.fecha_disposicion AS fecha_disposicion,
      amendment_count,
      unique_amenders
""")


def run_briefing_1(session, top_n: int) -> dict:
    log.info("Running Briefing 1 (most amended norms)...")
    rows, ms = run_query(session, B1_CYPHER, {"top_n": top_n})
    return {
        "briefing": 1,
        "title": "Diagnosis: which laws have become unreadable?",
        "question": f"Top {top_n} norms most amended by other norms",
        "elapsed_ms": ms,
        "cypher": B1_CYPHER,
        "results": [
            {
                "rank": i + 1,
                "id": r["id"],
                "titulo": r["titulo"],
                "numero_oficial": r["numero_oficial"],
                "rango": r["rango"],
                "fecha_disposicion": r["fecha_disposicion"],
                "amendment_count": r["amendment_count"],
                "unique_amenders": r["unique_amenders"],
            }
            for i, r in enumerate(rows)
        ],
    }

# ── Briefing 2 ─────────────────────────────────────────────────────────────────

B2_CYPHER = dedent("""\
    // Briefing 2 — Omnibus laws: norms that amend the most others
    // Counts distinct targets of outgoing AMENDS + REPEALS edges.
    // Not filtered by is_dead: historical omnibus laws still caused the mess.
    MATCH (n:Norm)-[r]->(target:Norm)
    WHERE n.in_corpus = true
      AND type(r) IN ['AMENDS', 'REPEALS']
    WITH  n,
          count(r)              AS total_actions,
          count(DISTINCT target) AS unique_targets
    ORDER BY unique_targets DESC
    LIMIT $top_n
    RETURN
      n.id             AS id,
      n.titulo         AS titulo,
      n.numero_oficial AS numero_oficial,
      n.rango          AS rango,
      n.fecha_disposicion AS fecha_disposicion,
      n.is_dead        AS is_dead,
      total_actions,
      unique_targets
""")


def run_briefing_2(session, top_n: int) -> dict:
    log.info("Running Briefing 2 (omnibus offenders)...")
    rows, ms = run_query(session, B2_CYPHER, {"top_n": top_n})
    return {
        "briefing": 2,
        "title": "Root cause: who made the mess?",
        "question": f"Top {top_n} norms that amend/repeal the most other norms",
        "elapsed_ms": ms,
        "cypher": B2_CYPHER,
        "results": [
            {
                "rank": i + 1,
                "id": r["id"],
                "titulo": r["titulo"],
                "numero_oficial": r["numero_oficial"],
                "rango": r["rango"],
                "fecha_disposicion": r["fecha_disposicion"],
                "is_dead": r["is_dead"],
                "total_actions": r["total_actions"],
                "unique_targets": r["unique_targets"],
            }
            for i, r in enumerate(rows)
        ],
    }

# ── Briefing 3 ─────────────────────────────────────────────────────────────────

B3_PCT_CYPHER = dedent("""\
    // Briefing 3a — What fraction of in-force law cites dead law?
    MATCH (live:Norm)
    WHERE live.in_corpus = true AND live.is_dead = false
    WITH count(live) AS total_live
    MATCH (src:Norm)-[:CITES]->(dead:Norm)
    WHERE src.in_corpus = true
      AND src.is_dead   = false
      AND dead.is_dead  = true
    WITH total_live, count(DISTINCT src) AS citing_live
    RETURN
      total_live,
      citing_live,
      round(toFloat(citing_live) / total_live * 100, 1) AS pct_citing_dead
""")

B3_GHOST_CYPHER = dedent("""\
    // Briefing 3b — Top ghost norms: dead laws most cited by living law
    MATCH (live:Norm)-[:CITES]->(dead:Norm)
    WHERE live.in_corpus = true
      AND live.is_dead   = false
      AND dead.is_dead   = true
    WITH  dead, count(DISTINCT live) AS cited_by_count
    ORDER BY cited_by_count DESC
    LIMIT $top_n
    RETURN
      dead.id              AS id,
      dead.titulo          AS titulo,
      dead.numero_oficial  AS numero_oficial,
      dead.rango           AS rango,
      dead.fecha_derogacion AS fecha_derogacion,
      cited_by_count
""")


def run_briefing_3(session, top_n: int) -> dict:
    log.info("Running Briefing 3a (ghost-citation percentage)...")
    pct_rows, ms_pct = run_query(session, B3_PCT_CYPHER)
    pct_data = pct_rows[0] if pct_rows else {"total_live": 0, "citing_live": 0, "pct_citing_dead": 0.0}

    log.info("Running Briefing 3b (top ghost norms)...")
    ghost_rows, ms_ghost = run_query(session, B3_GHOST_CYPHER, {"top_n": top_n})

    return {
        "briefing": 3,
        "title": "The rot: how much of the statute book rests on dead law?",
        "question": "% of in-force norms citing ≥1 repealed norm + top 5 most-cited ghosts",
        "elapsed_ms": {"part_a": ms_pct, "part_b": ms_ghost},
        "cypher": {"part_a": B3_PCT_CYPHER, "part_b": B3_GHOST_CYPHER},
        "percentage": {
            "total_in_force":     pct_data.get("total_live", 0),
            "citing_dead":        pct_data.get("citing_live", 0),
            "pct_citing_dead":    pct_data.get("pct_citing_dead", 0.0),
        },
        "ghost_norms": [
            {
                "rank": i + 1,
                "id": r["id"],
                "titulo": r["titulo"],
                "numero_oficial": r["numero_oficial"],
                "rango": r["rango"],
                "fecha_derogacion": r["fecha_derogacion"],
                "cited_by_count": r["cited_by_count"],
            }
            for i, r in enumerate(ghost_rows)
        ],
    }

# ── Briefing 4 ─────────────────────────────────────────────────────────────────

B4_FIND_CYPHER = dedent("""\
    // Briefing 4 — Locate Ley 30/1992 by numero_oficial + rango
    MATCH (n:Norm)
    WHERE n.numero_oficial = $numero_oficial
      AND n.rango          = $rango
      AND n.in_corpus      = true
    RETURN n.id AS id, n.titulo AS titulo
    LIMIT 1
""")

B4_BLAST_CYPHER = dedent("""\
    // Briefing 4 — In-force norms that still cite Ley 30/1992 directly
    // "Cite" covers CITES edges (codes 330 CITA, 440 DE CONFORMIDAD,
    //  490 SE DESARROLLA, 331 SE DICTA EN RELACIÓN).
    MATCH (live:Norm)-[r:CITES]->(ley30:Norm {id: $ley30_id})
    WHERE live.in_corpus = true
      AND live.is_dead   = false
    RETURN
      live.id             AS id,
      live.titulo         AS titulo,
      live.numero_oficial AS numero_oficial,
      live.rango          AS rango,
      live.fecha_disposicion AS fecha_disposicion,
      live.departamento   AS departamento,
      r.relacion_texto    AS relacion_tipo,
      r.detail            AS detail
    ORDER BY live.fecha_disposicion
""")


def run_briefing_4(session) -> dict:
    log.info("Running Briefing 4 (Ley 30/1992 blast radius)...")

    # Step 1: find Ley 30/1992's BOE ID dynamically
    find_rows, ms_find = run_query(
        session, B4_FIND_CYPHER,
        {"numero_oficial": "30/1992", "rango": "Ley"},
    )

    if not find_rows:
        log.warning("Ley 30/1992 not found in Neo4j — load the full corpus first.")
        return {
            "briefing": 4,
            "title": "The scalpel: the unfinished repeal",
            "question": "In-force norms that still cite Ley 30/1992 directly",
            "elapsed_ms": ms_find,
            "cypher": {"find": B4_FIND_CYPHER, "blast": B4_BLAST_CYPHER},
            "ley30": None,
            "results": [],
            "warning": "Ley 30/1992 not found in the database.",
        }

    ley30_id    = find_rows[0]["id"]
    ley30_titulo = find_rows[0]["titulo"]
    log.info("  Found Ley 30/1992: %s", ley30_id)

    # Step 2: blast radius
    blast_rows, ms_blast = run_query(
        session, B4_BLAST_CYPHER, {"ley30_id": ley30_id}
    )

    return {
        "briefing": 4,
        "title": "The scalpel: the unfinished repeal",
        "question": "In-force norms that still cite Ley 30/1992 directly",
        "elapsed_ms": {"find": ms_find, "blast": ms_blast},
        "cypher": {"find": B4_FIND_CYPHER, "blast": B4_BLAST_CYPHER},
        "ley30": {"id": ley30_id, "titulo": ley30_titulo},
        "results": [
            {
                "rank": i + 1,
                "id": r["id"],
                "titulo": r["titulo"],
                "numero_oficial": r["numero_oficial"],
                "rango": r["rango"],
                "fecha_disposicion": r["fecha_disposicion"],
                "departamento": r["departamento"],
                "relacion_tipo": r["relacion_tipo"],
                "detail": r["detail"],
            }
            for i, r in enumerate(blast_rows)
        ],
    }

# ── Corpus stats (for context in the report) ───────────────────────────────────

STATS_CYPHER = dedent("""\
    MATCH (n:Norm {in_corpus: true})
    RETURN
      count(n)                          AS total,
      sum(CASE WHEN n.is_dead = false THEN 1 ELSE 0 END) AS alive,
      sum(CASE WHEN n.is_dead = true  THEN 1 ELSE 0 END) AS dead
""")

def corpus_stats(session) -> dict:
    rows, _ = run_query(session, STATS_CYPHER)
    return rows[0] if rows else {"total": 0, "alive": 0, "dead": 0}

# ── Markdown output ────────────────────────────────────────────────────────────

def _ms_str(ms) -> str:
    if isinstance(ms, dict):
        parts = ", ".join(f"{k}: {v} ms" for k, v in ms.items())
        return f"({parts})"
    return f"{ms} ms"


def _cypher_block(cypher) -> str:
    if isinstance(cypher, dict):
        parts = []
        for label, q in cypher.items():
            parts.append(f"**{label}**\n```cypher\n{q.strip()}\n```")
        return "\n\n".join(parts)
    return f"```cypher\n{str(cypher).strip()}\n```"


def build_markdown(b1: dict, b2: dict, b3: dict, b4: dict, stats: dict, top_n: int) -> str:
    now = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
    alive = stats.get("alive", 0)
    total = stats.get("total", 0)

    sections: list[str] = []

    # ── Header ────────────────────────────────────────────────────────────────
    sections.append(dedent(f"""\
        # Council of Ministers — Legislative Briefings

        Generated: {now}
        Corpus: **{total:,} consolidated norms** ({alive:,} in force) in Neo4j.

        ---
    """))

    # ── Briefing 1 ────────────────────────────────────────────────────────────
    r1 = b1["results"]
    answer1 = (
        f"The **{len(r1)}** in-force laws amended most often by subsequent legislation "
        f"— the primary candidates for a clean rewrite — are listed below. "
    ) + (
        f"**{_short(r1[0]['titulo'], 60)}** leads with "
        f"**{r1[0]['amendment_count']} cumulative amendments** "
        f"from {r1[0]['unique_amenders']} different laws."
        if r1 else "No results found — ensure the full corpus is loaded."
    )

    sections.append(f"## Briefing 01 — {b1['title']}\n")
    sections.append(f"{answer1}\n")
    if r1:
        sections.append(md_table(
            ["#", "ID", "Número oficial", "Rango", "Amendments", "By # laws"],
            [[r["rank"], r["id"], _val(r["numero_oficial"]), _val(r["rango"]),
              r["amendment_count"], r["unique_amenders"]] for r in r1],
        ))
        sections.append("")
    sections.append(f"*Query time: {_ms_str(b1['elapsed_ms'])}*\n")
    sections.append(_cypher_block(b1["cypher"]))
    sections.append("\n---")

    # ── Briefing 2 ────────────────────────────────────────────────────────────
    r2 = b2["results"]
    answer2 = (
        "These are the **omnibus laws** — single acts that silently rewrote dozens of "
        "unrelated statutes at once. They are the structural cause of the consolidation backlog. "
    ) + (
        f"**{_short(r2[0]['titulo'], 60)}** is the worst offender, touching "
        f"**{r2[0]['unique_targets']} distinct laws** in {r2[0]['total_actions']} amendment actions."
        if r2 else "No results found — ensure the full corpus is loaded."
    )

    sections.append(f"\n## Briefing 02 — {b2['title']}\n")
    sections.append(f"{answer2}\n")
    if r2:
        sections.append(md_table(
            ["#", "ID", "Número oficial", "Rango", "Laws touched", "Total actions", "Still in force"],
            [[r["rank"], r["id"], _val(r["numero_oficial"]), _val(r["rango"]),
              r["unique_targets"], r["total_actions"],
              "No" if r["is_dead"] else "Yes"] for r in r2],
        ))
        sections.append("")
    sections.append(f"*Query time: {_ms_str(b2['elapsed_ms'])}*\n")
    sections.append(_cypher_block(b2["cypher"]))
    sections.append("\n---")

    # ── Briefing 3 ────────────────────────────────────────────────────────────
    pct  = b3["percentage"]
    ghosts = b3["ghost_norms"]
    pct_val = pct.get("pct_citing_dead", 0.0)
    citing  = pct.get("citing_dead", 0)
    tlive   = pct.get("total_in_force", 0)

    answer3 = (
        f"**{pct_val}% of in-force Spanish law** ({citing:,} of {tlive:,} norms) "
        f"cites at least one repealed norm — operating on legal ground that no longer exists. "
    ) + (
        f"The dead law most propped up by living statutes is **{_short(ghosts[0]['titulo'], 60)}**, "
        f"still cited by {ghosts[0]['cited_by_count']} in-force norms."
        if ghosts else ""
    )

    sections.append(f"\n## Briefing 03 — {b3['title']}\n")
    sections.append(f"{answer3}\n")
    sections.append(f"### Summary\n| Metric | Value |\n|---|---|\n"
                    f"| In-force norms (corpus) | {tlive:,} |\n"
                    f"| Citing ≥1 repealed norm | {citing:,} |\n"
                    f"| **Share on dead ground** | **{pct_val}%** |")
    sections.append("")
    if ghosts:
        sections.append("### Top ghost norms\n")
        sections.append(md_table(
            ["#", "ID", "Número oficial", "Rango", "Repealed", "Cited by # live norms"],
            [[g["rank"], g["id"], _val(g["numero_oficial"]), _val(g["rango"]),
              _val(g["fecha_derogacion"]), g["cited_by_count"]] for g in ghosts],
        ))
        sections.append("")
    sections.append(f"*Query time: {_ms_str(b3['elapsed_ms'])}*\n")
    sections.append(_cypher_block(b3["cypher"]))
    sections.append("\n---")

    # ── Briefing 4 ────────────────────────────────────────────────────────────
    r4   = b4["results"]
    ley30 = b4.get("ley30") or {}
    warn  = b4.get("warning")

    if warn:
        answer4 = f"⚠️  {warn}"
    else:
        answer4 = (
            f"**{len(r4)} in-force norms** still cite "
            f"**{ley30.get('id', 'Ley 30/1992')}** "
            f"(*{_short(ley30.get('titulo',''), 70)}*), "
            f"which was repealed in 2015 and superseded by Leyes 39/2015 and 40/2015. "
            "Each entry below is a concrete update task for the ministries concerned."
            if r4 else
            f"No in-force norms found citing {ley30.get('id', 'Ley 30/1992')} — "
            "either the corpus is not fully loaded or all references have been cleaned up."
        )

    sections.append(f"\n## Briefing 04 — {b4['title']}\n")
    if ley30:
        sections.append(f"**Target norm:** `{ley30.get('id')}` — {_short(ley30.get('titulo',''), 90)}\n")
    sections.append(f"{answer4}\n")
    if r4:
        sections.append(md_table(
            ["#", "ID", "Número oficial", "Rango", "Date", "Department", "Relation type"],
            [[r["rank"], r["id"], _val(r["numero_oficial"]), _val(r["rango"]),
              _val(r["fecha_disposicion"]), _short(_val(r["departamento"]), 35),
              _val(r["relacion_tipo"])] for r in r4],
        ))
        sections.append("")
    sections.append(f"*Query time: {_ms_str(b4['elapsed_ms'])}*\n")
    sections.append(_cypher_block(b4["cypher"]))

    return "\n".join(sections) + "\n"

# ── JSON output ────────────────────────────────────────────────────────────────

def _safe_json(obj):
    """Recursively convert any non-serialisable values (e.g. neo4j types)."""
    if isinstance(obj, dict):
        return {k: _safe_json(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [_safe_json(v) for v in obj]
    if obj is None or isinstance(obj, (str, int, float, bool)):
        return obj
    return str(obj)


def write_json(briefing: dict, out_dir: Path) -> None:
    num = briefing["briefing"]
    out_dir.mkdir(parents=True, exist_ok=True)
    path = out_dir / f"{num}.json"
    payload = {
        **_safe_json(briefing),
        "generated_at": datetime.now(timezone.utc).isoformat(),
    }
    # Exclude raw Cypher strings from the frontend JSON (they live in the MD)
    payload.pop("cypher", None)
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    log.info("  Wrote %s", path)

# ── Main ───────────────────────────────────────────────────────────────────────

def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(
        description="Run BOE legislative briefings against Neo4j",
        formatter_class=argparse.ArgumentDefaultsHelpFormatter,
    )
    p.add_argument("--top-n",   type=int, default=DEFAULT_TOP_N,
                   help="Number of results per briefing")
    p.add_argument("--out-dir", default=str(DEFAULT_OUT_DIR),
                   help="Directory for JSON output files")
    return p.parse_args()


def main() -> None:
    setup_logging()
    args = parse_args()
    out_dir = Path(args.out_dir)

    uri  = os.environ.get("NEO4J_URI",      "bolt://localhost:7687")
    user = os.environ.get("NEO4J_USER",     "neo4j")
    pw   = os.environ.get("NEO4J_PASSWORD", "")
    if not pw:
        log.error("NEO4J_PASSWORD is not set.")
        sys.exit(1)

    log.info("Connecting to %s...", uri)
    try:
        driver = GraphDatabase.driver(uri, auth=(user, pw))
        driver.verify_connectivity()
    except ServiceUnavailable as exc:
        log.error("Cannot reach Neo4j: %s", exc)
        sys.exit(1)

    with driver.session() as session:

        # Corpus stats (context only, not timed as a briefing)
        stats = corpus_stats(session)
        log.info("Corpus in Neo4j: %d total, %d alive, %d dead",
                 stats["total"], stats["alive"], stats["dead"])

        # ── Run briefings ──────────────────────────────────────────────────
        b1 = run_briefing_1(session, args.top_n)
        b2 = run_briefing_2(session, args.top_n)
        b3 = run_briefing_3(session, args.top_n)
        b4 = run_briefing_4(session)

    driver.close()

    # ── Write JSON ─────────────────────────────────────────────────────────
    log.info("Writing JSON files to %s...", out_dir)
    for b in (b1, b2, b3, b4):
        write_json(b, out_dir)

    # ── Write Markdown ─────────────────────────────────────────────────────
    log.info("Writing %s...", MD_FILE)
    md = build_markdown(b1, b2, b3, b4, stats, args.top_n)
    MD_FILE.write_text(md, encoding="utf-8")

    # ── Print timing summary ───────────────────────────────────────────────
    log.info("─" * 58)
    log.info("QUERY TIMING")
    log.info("  Briefing 1 : %s", _ms_str(b1["elapsed_ms"]))
    log.info("  Briefing 2 : %s", _ms_str(b2["elapsed_ms"]))
    log.info("  Briefing 3 : %s", _ms_str(b3["elapsed_ms"]))
    log.info("  Briefing 4 : %s", _ms_str(b4["elapsed_ms"]))
    log.info("─" * 58)
    log.info("Done. Results: %s  |  %s", MD_FILE, out_dir)


if __name__ == "__main__":
    main()
