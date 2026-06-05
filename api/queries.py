"""
All Cypher queries and Neo4j execution functions.

Route handlers in main.py call these functions; no Cypher lives elsewhere.
Each function receives an open neo4j.Session and returns plain Python dicts/lists.
"""
from __future__ import annotations

from neo4j import Session

# ── Helpers ────────────────────────────────────────────────────────────────────

def _node(n) -> dict:
    """Convert a neo4j Node (or mapping) to a plain dict, dropping nulls."""
    return {k: v for k, v in dict(n).items() if v is not None}


def _row(r) -> dict:
    """Convert a neo4j Record row to a plain dict."""
    return dict(r)

# ── Norm detail + 1-hop neighbourhood ─────────────────────────────────────────

_NORM_Q = "MATCH (n:Norm {id: $id}) RETURN n"

# Undirected match captures all connections (in + out).
# startNode / endNode preserve the original edge direction.
# Pattern comprehension [(...) | ...] always returns a list (empty if none),
# so the query always yields exactly one row when the norm exists.
_NEIGHBOURHOOD_Q = """
MATCH (n:Norm {id: $id})
WITH n,
     [(n)-[r]-(nb:Norm) | [r, nb]][..500] AS hits
RETURN n AS center,
       [h IN hits | {
           id:             h[1].id,
           titulo:         h[1].titulo,
           rango:          h[1].rango,
           numero_oficial: h[1].numero_oficial,
           is_dead:        h[1].is_dead,
           in_corpus:      h[1].in_corpus,
           ambito:         h[1].ambito
       }]   AS neighbors,
       [h IN hits | {
           source:        startNode(h[0]).id,
           target:        endNode(h[0]).id,
           type:          type(h[0]),
           relacion_texto: h[0].relacion_texto,
           detail:        h[0].detail,
           is_partial:    coalesce(h[0].is_partial, false)
       }]   AS edges
"""


def get_norm(session: Session, norm_id: str) -> dict | None:
    r = session.run(_NORM_Q, id=norm_id).single()
    return _node(r["n"]) if r else None


def get_neighbourhood(session: Session, norm_id: str) -> dict | None:
    """
    Return center norm + all 1-hop neighbours + edges between them.
    Returns None when the norm does not exist.
    Deduplication is done client-side (pattern comprehension may repeat
    the same edge when traversed in both directions).
    """
    r = session.run(_NEIGHBOURHOOD_Q, id=norm_id).single()
    if r is None:
        return None

    # Deduplicate neighbours by id
    seen_nb: set[str] = set()
    neighbors: list[dict] = []
    for nb in r["neighbors"]:
        nid = nb.get("id")
        if nid and nid not in seen_nb:
            seen_nb.add(nid)
            neighbors.append({k: v for k, v in nb.items() if v is not None})

    # Deduplicate edges by (source, target, type)
    seen_e: set[tuple] = set()
    edges: list[dict] = []
    for e in r["edges"]:
        key = (e.get("source"), e.get("target"), e.get("type"))
        if None not in key and key not in seen_e:
            seen_e.add(key)
            edges.append({k: v for k, v in e.items() if v is not None})

    return {
        "norm":      _node(r["center"]),
        "neighbors": neighbors,
        "edges":     edges,
    }

# ── Search ─────────────────────────────────────────────────────────────────────

# Ordering: exact ID match first, then by alive-before-dead, then most-recently
# updated.  toLower(COALESCE(..., '')) avoids null errors on numero_oficial.
_SEARCH_Q = """
MATCH (n:Norm)
WHERE n.in_corpus = true
  AND (
        toLower(n.titulo)                             CONTAINS toLower($q)
     OR n.id                                          CONTAINS $q
     OR toLower(coalesce(n.numero_oficial, ''))        CONTAINS toLower($q)
  )
RETURN
  n.id              AS id,
  n.titulo          AS titulo,
  n.rango           AS rango,
  n.numero_oficial  AS numero_oficial,
  n.fecha_disposicion AS fecha_disposicion,
  n.departamento    AS departamento,
  n.ambito          AS ambito,
  n.is_dead         AS is_dead
ORDER BY
  CASE WHEN n.id = $q THEN 0
       WHEN n.id CONTAINS $q THEN 1
       ELSE 2 END,
  n.is_dead,
  n.fecha_actualizacion DESC
LIMIT toInteger($limit)
"""


def search_norms(session: Session, q: str, limit: int) -> list[dict]:
    return [_row(r) for r in session.run(_SEARCH_Q, q=q, limit=limit)]

# ── Subgraph for the explorer ──────────────────────────────────────────────────

# Step 1 — collect all nodes within `depth` hops (undirected, bounded by cap).
# Neo4j 5 does not allow query parameters inside variable-length path bounds
# ([*1..$depth] is rejected as a syntax error). Depth is validated to {1,2,3}
# by the route, so it is safe to embed as a literal via string formatting.
_SUBGRAPH_NODES_Q_TMPL = """
MATCH (root:Norm {{id: $root}})
OPTIONAL MATCH (root)-[*1..{depth}]-(n:Norm)
WITH root, collect(DISTINCT n)[..$cap] AS neighbours
RETURN [root] + neighbours AS nodes
"""

# Step 2 — return all edges between the collected node IDs, filtered by type.
# size($types) = 0 means "all types allowed".
_SUBGRAPH_EDGES_Q = """
MATCH (a:Norm)-[r]->(b:Norm)
WHERE a.id IN $node_ids
  AND b.id IN $node_ids
  AND (size($types) = 0 OR type(r) IN $types)
RETURN
  a.id              AS source,
  b.id              AS target,
  type(r)           AS type,
  r.relacion_texto  AS relacion_texto,
  r.detail          AS detail,
  coalesce(r.is_partial, false) AS is_partial
"""

VALID_EDGE_TYPES = frozenset({"AMENDS", "REPEALS", "CITES", "CORRECTS"})


def get_subgraph(
    session: Session,
    root: str,
    depth: int,
    types: list[str],
    node_limit: int,
) -> dict | None:
    """
    Return a bounded subgraph starting at `root`.

    Steps:
      1. BFS-expand up to `depth` hops, capped at `node_limit` unique nodes.
      2. Retrieve all edges between those nodes, optionally filtered by type.

    Returns None when root does not exist.
    """
    cap = max(0, node_limit - 1)  # reserve 1 slot for root itself
    query = _SUBGRAPH_NODES_Q_TMPL.format(depth=int(depth))  # literal, safe (validated 1-3)
    r = session.run(query, root=root, cap=cap).single()
    if r is None:
        return None

    raw_nodes = r["nodes"] or []
    if not raw_nodes:
        return None  # root not found

    nodes  = [_node(n) for n in raw_nodes]
    nids   = [n["id"] for n in nodes if "id" in n]

    edges_records = session.run(_SUBGRAPH_EDGES_Q, node_ids=nids, types=types)
    edges = [_row(e) for e in edges_records]

    return {
        "root":       root,
        "depth":      depth,
        "node_count": len(nodes),
        "edge_count": len(edges),
        "nodes":      nodes,
        "edges":      edges,
    }

# ── Corpus stats (used by health + briefings context) ─────────────────────────

_STATS_Q = """
MATCH (n:Norm {in_corpus: true})
RETURN
  count(n)                                                      AS total,
  sum(CASE WHEN n.is_dead = false THEN 1 ELSE 0 END)           AS alive,
  sum(CASE WHEN n.is_dead = true  THEN 1 ELSE 0 END)           AS dead
"""


def corpus_stats(session: Session) -> dict:
    r = session.run(_STATS_Q).single()
    return dict(r) if r else {"total": 0, "alive": 0, "dead": 0}
