#!/usr/bin/env python3
"""
load_neo4j.py — Load BOE consolidated legislation graph into Neo4j.

Reads data/raw/*.json produced by ingest.py.
Idempotent: uses MERGE for both nodes and relationships.
Safe to re-run; each re-run updates stale properties.

Environment variables (all optional except NEO4J_PASSWORD):
  NEO4J_URI       bolt://localhost:7687
  NEO4J_USER      neo4j
  NEO4J_PASSWORD  (required)

Usage:
  python load_neo4j.py                     # load / refresh
  python load_neo4j.py --reset             # wipe :Norm nodes, then reload
  python load_neo4j.py --data-dir data/raw --batch-size 500
"""
from __future__ import annotations

import argparse
import hashlib
import json
import logging
import os
import sys
import time
from collections import defaultdict
from pathlib import Path

from neo4j import GraphDatabase
from neo4j.exceptions import ServiceUnavailable

# ── Constants ──────────────────────────────────────────────────────────────────

DEFAULT_DATA_DIR  = Path("data/raw")
DEFAULT_BATCH_SIZE = 1000
LOG_FILE = Path("load_neo4j.log")

# Relation code → graph edge type  (SCHEMA.md §2–3)
AMENDS_CODES   = {270, 407, 245, 230,   # MODIFICA, AÑADE, SUSTITUYE, DEJA SIN EFECTO
                   231, 235, 401, 406}  # SUSPENDE, SUPRIME, PRORROGA, AMPLÍA
REPEALS_CODES  = {210}                  # DEROGA
CITES_CODES    = {330, 440, 490, 331,   # CITA, DE CONFORMIDAD, SE DESARROLLA, EN RELACIÓN
                   426, 480}            # TRANSPONE, DECLARA la vigencia
CORRECTS_CODES = {201}                  # CORRECCIÓN de errores
DROP_CODES     = {470, 530, 402}        # SE DECLARA (judicial), Cuestión, SE INTERPRETA

# ── Logging ────────────────────────────────────────────────────────────────────

def setup_logging() -> None:
    fmt = "%(asctime)s %(levelname)-8s %(message)s"
    logging.basicConfig(
        level=logging.INFO,
        format=fmt,
        datefmt="%Y-%m-%d %H:%M:%S",
        handlers=[
            logging.StreamHandler(sys.stdout),
            logging.FileHandler(LOG_FILE, encoding="utf-8"),
        ],
    )

log = logging.getLogger(__name__)

# ── Data helpers ───────────────────────────────────────────────────────────────

def _int(v) -> int | None:
    """Safe int cast; returns None on failure."""
    if v is None:
        return None
    try:
        return int(v)
    except (TypeError, ValueError):
        return None


def flatten_refs(block, key: str) -> list[dict]:
    """
    Normalise the three nesting shapes the BOE API produces for
    anteriores / posteriores blocks.

    Absent → []
    Single: {"anterior": {…}}        → [item]
    Multi:  [{"anterior": […]}]      → flat list
    """
    if not block:
        return []
    if isinstance(block, list):                 # [{"anterior": [...]}]
        wrapper = block[0] if block else {}
        inner   = wrapper.get(key, [])
    elif isinstance(block, dict):               # {"anterior": {…}} or {"anterior": […]}
        inner = block.get(key, [])
    else:
        return []

    if isinstance(inner, list):
        return inner
    if isinstance(inner, dict):
        return [inner]
    return []


def stub_id(text: str) -> str:
    """
    Deterministic surrogate ID for norms referenced by free text only
    (empty id_norma — regional/historical norms not in the BOE corpus).
    """
    h = hashlib.sha1(text.encode("utf-8", errors="replace")).hexdigest()[:16]
    return f"STUB::{h}"


def is_partial_repeal(detail: str) -> bool:
    """Heuristic: partial repeal if detail names specific provisions."""
    low = (detail or "").lower()
    return any(m in low for m in ("art.", "arts.", "disposición", "capítulo", "título", "apartado", "párrafo"))


def derive_is_dead(meta: dict) -> bool:
    return (
        meta.get("vigencia_agotada")   == "S"
        or meta.get("estatus_derogacion") == "S"
        or meta.get("estatus_anulacion")  == "S"
    )


def build_norm_props(meta: dict, in_corpus: bool) -> dict:
    """Extract flat scalar properties for a :Norm node from its metadatos dict."""
    def sub(field: str, key: str):
        v = meta.get(field)
        return v.get(key) if isinstance(v, dict) else None

    return {
        "titulo":              meta.get("titulo"),
        "numero_oficial":      meta.get("numero_oficial"),
        "rango":               sub("rango",       "texto"),
        "rango_codigo":        _int(sub("rango",  "codigo")),
        "ambito":              sub("ambito",       "texto"),
        "departamento":        sub("departamento", "texto"),
        "fecha_publicacion":   meta.get("fecha_publicacion"),
        "fecha_disposicion":   meta.get("fecha_disposicion"),
        "fecha_vigencia":      meta.get("fecha_vigencia"),
        "fecha_derogacion":    meta.get("fecha_derogacion"),
        "estatus_derogacion":  meta.get("estatus_derogacion"),
        "vigencia_agotada":    meta.get("vigencia_agotada"),
        "estatus_anulacion":   meta.get("estatus_anulacion"),
        "is_dead":             derive_is_dead(meta),
        "url_eli":             meta.get("url_eli"),
        "url_html":            meta.get("url_html_consolidada"),
        "in_corpus":           in_corpus,
        "fecha_actualizacion": meta.get("fecha_actualizacion"),
    }


# ── File parsing ───────────────────────────────────────────────────────────────

def parse_files(data_dir: Path) -> tuple[dict[str, dict], list[dict]]:
    """
    Read every BOE-*.json file and extract:
      nodes  — {norm_id: props}  (corpus norms + stub nodes for out-of-corpus refs)
      edges  — [{type, source_id, target_id, ...}]  from anteriores only

    Returns (nodes, edges).
    """
    nodes: dict[str, dict] = {}
    edges: list[dict]      = []

    files = sorted(data_dir.glob("BOE-*.json"))
    if not files:
        log.error("No BOE-*.json files found in %s", data_dir)
        sys.exit(1)
    log.info("Parsing %d norm files...", len(files))

    stubs_created  = 0
    no_analisis    = 0
    unknown_codes: set[int] = set()

    for fpath in files:
        try:
            record = json.loads(fpath.read_text(encoding="utf-8"))
        except (json.JSONDecodeError, OSError) as exc:
            log.warning("Skipping %s: %s", fpath.name, exc)
            continue

        norm_id = record.get("identificador", "").strip()
        if not norm_id:
            continue

        meta  = record.get("metadatos", {})
        nodes[norm_id] = build_norm_props(meta, in_corpus=True)

        analisis = record.get("analisis") or {}
        if not analisis:
            no_analisis += 1
            continue

        refs      = analisis.get("referencias") or {}
        ant_block = refs.get("anteriores")
        items     = flatten_refs(ant_block, "anterior")

        for ref in items:
            codigo = _int((ref.get("relacion") or {}).get("codigo"))

            # Determine relationship type
            if codigo in AMENDS_CODES:
                etype = "AMENDS"
            elif codigo in REPEALS_CODES:
                etype = "REPEALS"
            elif codigo in CITES_CODES:
                etype = "CITES"
            elif codigo in CORRECTS_CODES:
                etype = "CORRECTS"
            elif codigo in DROP_CODES or codigo is None:
                continue  # intentionally dropped
            else:
                unknown_codes.add(codigo)
                continue

            target_id = (ref.get("id_norma") or "").strip()
            detail    = (ref.get("texto")    or "").strip()
            rel_texto = ((ref.get("relacion") or {}).get("texto") or "").strip()

            if not target_id:
                target_id = stub_id(detail or f"{norm_id}:{rel_texto}")
                if target_id not in nodes:
                    nodes[target_id] = {
                        "titulo":    detail[:200] or None,
                        "in_corpus": False,
                        "is_dead":   None,
                    }
                    stubs_created += 1

            # Ensure referenced corpus norms (not yet parsed) get a placeholder
            # that will be overwritten when their own file is processed.
            if target_id not in nodes:
                nodes[target_id] = {"in_corpus": False, "is_dead": None}

            edges.append({
                "type":           etype,
                "source_id":      norm_id,
                "target_id":      target_id,
                "relacion_codigo": codigo,
                "relacion_texto":  rel_texto,
                "detail":          detail[:1000] or None,
                "is_partial":      is_partial_repeal(detail) if etype == "REPEALS" else False,
            })

    if unknown_codes:
        log.warning("Unknown relation codes (dropped): %s", sorted(unknown_codes))

    corpus_count = sum(1 for p in nodes.values() if p.get("in_corpus") is True)
    log.info(
        "Parsed: %d corpus norms, %d stub nodes, %d edges  (%d norms had no analisis)",
        corpus_count, stubs_created, len(edges), no_analisis,
    )
    return nodes, edges


# ── Cypher queries ─────────────────────────────────────────────────────────────

_CONSTRAINT = """
CREATE CONSTRAINT norm_id IF NOT EXISTS
FOR (n:Norm) REQUIRE n.id IS UNIQUE
"""

_INDEXES = [
    # The briefings filter heavily on status fields
    "CREATE INDEX norm_estatus    IF NOT EXISTS FOR (n:Norm) ON (n.estatus_derogacion)",
    "CREATE INDEX norm_is_dead    IF NOT EXISTS FOR (n:Norm) ON (n.is_dead)",
    "CREATE INDEX norm_vigencia   IF NOT EXISTS FOR (n:Norm) ON (n.vigencia_agotada)",
    "CREATE INDEX norm_in_corpus  IF NOT EXISTS FOR (n:Norm) ON (n.in_corpus)",
]

_MERGE_NODES = """
UNWIND $batch AS row
MERGE (n:Norm {id: row.id})
SET n += row.props
"""

# One query per relationship type — Cypher does not support dynamic rel types.
# MERGE key: (source, target, relacion_codigo) — unique identifier for one
# directed legislative action.  Subsequent SET refreshes text properties.
_MERGE_EDGES: dict[str, str] = {
    t: f"""
UNWIND $batch AS row
MATCH (a:Norm {{id: row.source_id}})
MATCH (b:Norm {{id: row.target_id}})
MERGE (a)-[r:{t} {{relacion_codigo: row.relacion_codigo}}]->(b)
SET   r.relacion_texto = row.relacion_texto,
      r.detail         = row.detail,
      r.is_partial     = row.is_partial
"""
    for t in ("AMENDS", "REPEALS", "CITES", "CORRECTS")
}

# ── Neo4j write helpers ────────────────────────────────────────────────────────

def _tx_run(tx, query: str, batch: list) -> None:
    tx.run(query, batch=batch)


def _batched_write(session, query: str, items: list, batch_size: int, label: str) -> int:
    """
    Write *items* to Neo4j in chunks of *batch_size* using execute_write.
    Returns total items written.
    """
    total = len(items)
    written = 0
    for i in range(0, total, batch_size):
        chunk = items[i : i + batch_size]
        session.execute_write(_tx_run, query, chunk)
        written += len(chunk)
        if written % max(batch_size * 5, 5000) == 0 or written == total:
            log.info("  %s: %d / %d", label, written, total)
    return written


# ── Schema setup ───────────────────────────────────────────────────────────────

def setup_schema(session) -> None:
    """Create uniqueness constraint and performance indexes (IF NOT EXISTS)."""
    log.info("Creating constraint and indexes...")
    session.run(_CONSTRAINT)
    for q in _INDEXES:
        session.run(q)
    log.info("Schema ready.")


# ── Reset ──────────────────────────────────────────────────────────────────────

def reset_db(session) -> None:
    """
    Delete all :Norm nodes (and their relationships) in rolling batches.
    Batching avoids heap exhaustion on large graphs.
    """
    log.warning("--reset: deleting all :Norm nodes and their relationships...")
    total = 0
    while True:
        result  = session.run(
            "MATCH (n:Norm) WITH n LIMIT 10000 DETACH DELETE n RETURN count(n) AS d"
        )
        deleted = result.single()["d"]
        total  += deleted
        if deleted == 0:
            break
    log.info("  Deleted %d :Norm nodes.", total)


# ── Final summary ──────────────────────────────────────────────────────────────

def print_summary(session) -> None:
    total      = session.run("MATCH (n:Norm)               RETURN count(n) AS c").single()["c"]
    in_corpus  = session.run("MATCH (n:Norm {in_corpus: true})  RETURN count(n) AS c").single()["c"]
    dead       = session.run("MATCH (n:Norm {is_dead: true})    RETURN count(n) AS c").single()["c"]
    stubs      = total - in_corpus

    sep = "─" * 58
    log.info(sep)
    log.info("LOAD COMPLETE — FINAL COUNTS")
    log.info("  :Norm nodes          : %d", total)
    log.info("    in_corpus = true   : %d", in_corpus)
    log.info("    is_dead   = true   : %d", dead)
    log.info("    stubs              : %d", stubs)
    log.info("  Relationships:")
    for rec in session.run(
        "MATCH ()-[r]->() RETURN type(r) AS t, count(r) AS c ORDER BY c DESC"
    ):
        log.info("    %-12s : %d", rec["t"], rec["c"])
    log.info(sep)


# ── Main ───────────────────────────────────────────────────────────────────────

def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(
        description="Load BOE consolidated legislation into Neo4j",
        formatter_class=argparse.ArgumentDefaultsHelpFormatter,
    )
    p.add_argument("--data-dir",   default=str(DEFAULT_DATA_DIR),  metavar="DIR",
                   help="Directory containing BOE-*.json files")
    p.add_argument("--batch-size", default=DEFAULT_BATCH_SIZE, type=int, metavar="N",
                   help="Nodes/edges per Neo4j transaction")
    p.add_argument("--reset",      action="store_true",
                   help="Delete all :Norm nodes before loading")
    return p.parse_args()


def main() -> None:
    setup_logging()
    args = parse_args()

    uri  = os.environ.get("NEO4J_URI",      "bolt://localhost:7687")
    user = os.environ.get("NEO4J_USER",     "neo4j")
    pw   = os.environ.get("NEO4J_PASSWORD", "")
    if not pw:
        log.error("NEO4J_PASSWORD is not set. Export it before running.")
        sys.exit(1)

    log.info("Connecting to %s as '%s'...", uri, user)
    try:
        driver = GraphDatabase.driver(uri, auth=(user, pw))
        driver.verify_connectivity()
        log.info("Connection OK.")
    except ServiceUnavailable as exc:
        log.error("Cannot reach Neo4j: %s", exc)
        sys.exit(1)

    # ── 1. Parse all raw files ─────────────────────────────────────────────
    nodes, edges = parse_files(Path(args.data_dir))

    # ── 2. Prepare edge rows per type (avoids re-grouping inside the loop) ─
    edges_by_type: dict[str, list[dict]] = defaultdict(list)
    for e in edges:
        edges_by_type[e["type"]].append({
            "source_id":      e["source_id"],
            "target_id":      e["target_id"],
            "relacion_codigo": e["relacion_codigo"],
            "relacion_texto":  e["relacion_texto"],
            "detail":          e["detail"],
            "is_partial":      e["is_partial"],
        })

    node_rows = [{"id": nid, "props": props} for nid, props in nodes.items()]

    with driver.session() as session:

        # ── 3. Optional reset ──────────────────────────────────────────────
        if args.reset:
            reset_db(session)

        # ── 4. Schema (idempotent) ─────────────────────────────────────────
        setup_schema(session)

        # ── 5. Merge nodes ─────────────────────────────────────────────────
        log.info("Loading %d nodes (batch=%d)...", len(node_rows), args.batch_size)
        t0 = time.perf_counter()
        _batched_write(session, _MERGE_NODES, node_rows, args.batch_size, "nodes")
        node_elapsed = time.perf_counter() - t0
        log.info(
            "Nodes done: %.1fs  (%.0f nodes/sec)",
            node_elapsed, len(node_rows) / max(node_elapsed, 1e-6),
        )

        # ── 6. Merge edges ─────────────────────────────────────────────────
        total_edges = len(edges)
        log.info("Loading %d edges (batch=%d)...", total_edges, args.batch_size)
        t1 = time.perf_counter()
        for etype, rows in edges_by_type.items():
            _batched_write(session, _MERGE_EDGES[etype], rows, args.batch_size, etype)
        edge_elapsed = time.perf_counter() - t1
        log.info(
            "Edges done: %.1fs  (%.0f edges/sec)",
            edge_elapsed, total_edges / max(edge_elapsed, 1e-6),
        )

        # ── 7. Summary ─────────────────────────────────────────────────────
        print_summary(session)

    driver.close()
    log.info(
        "Throughput — nodes: %.0f/sec, edges: %.0f/sec",
        len(node_rows) / max(node_elapsed, 1e-6),
        total_edges     / max(edge_elapsed, 1e-6),
    )


if __name__ == "__main__":
    main()
