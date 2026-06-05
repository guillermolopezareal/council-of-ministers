"""
BOE Legislative Graph — FastAPI backend.

Endpoints
─────────
GET  /health                                  liveness + DB check
GET  /briefings/{n}       n ∈ {1,2,3,4}      pre-computed briefing (in-memory)
GET  /norm/{id}                               norm detail + 1-hop neighbourhood
GET  /search?q=&limit=                        full-title / id / numero_oficial search
GET  /subgraph?root=&depth=&types=&limit=     bounded graph for the explorer
POST /ask  {question}                         natural-language → Cypher → result

CORS is open (no auth).  All Cypher lives in api/queries.py.
LLM logic (prompt, safety check, extraction) lives in api/llm.py.
"""
from __future__ import annotations

import asyncio
import json
import logging
import os
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Annotated

from fastapi import Depends, FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from neo4j import Session
from pydantic import BaseModel, Field

import api.queries as queries
import api.llm as llm
from api.db import close_driver, get_driver, ping

# ── Configuration ──────────────────────────────────────────────────────────────

BRIEFINGS_DIR = Path(os.environ.get("BRIEFINGS_DIR", "data/briefings"))
VALID_BRIEFINGS = {1, 2, 3, 4}
VALID_EDGE_TYPES = {"AMENDS", "REPEALS", "CITES", "CORRECTS"}

log = logging.getLogger(__name__)

# ── Startup / shutdown ─────────────────────────────────────────────────────────

def _load_briefings() -> dict[int, dict]:
    """Read briefing JSON files into memory at startup."""
    loaded: dict[int, dict] = {}
    for n in VALID_BRIEFINGS:
        path = BRIEFINGS_DIR / f"{n}.json"
        if path.exists():
            try:
                loaded[n] = json.loads(path.read_text(encoding="utf-8"))
                log.info("Briefing %d loaded from %s", n, path)
            except Exception as exc:
                log.warning("Could not load briefing %d: %s", n, exc)
        else:
            log.warning("Briefing file not found: %s (run briefings.py first)", path)
    return loaded


@asynccontextmanager
async def lifespan(app: FastAPI):
    # ── Startup ────────────────────────────────────────────────────────────
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(levelname)-8s %(message)s",
    )
    app.state.briefings = _load_briefings()

    # Check LLM availability (ANTHROPIC_API_KEY must be set)
    llm_key_present = bool(os.environ.get("ANTHROPIC_API_KEY"))
    app.state.llm_ready = llm_key_present
    if llm_key_present:
        log.info("ANTHROPIC_API_KEY present — /ask endpoint enabled.")
    else:
        log.warning("ANTHROPIC_API_KEY not set — /ask will return 503.")

    log.info(
        "Startup complete — %d/%d briefings in memory",
        len(app.state.briefings), len(VALID_BRIEFINGS),
    )
    yield
    # ── Shutdown ───────────────────────────────────────────────────────────
    close_driver()
    log.info("Neo4j driver closed.")

# ── App factory ────────────────────────────────────────────────────────────────

app = FastAPI(
    title="BOE Legislative Graph API",
    description="Graph of 12 000+ Spanish consolidated norms — Reversa Council of Ministers",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)

# ── Session dependency ─────────────────────────────────────────────────────────

def get_session() -> Session:
    """Yield a Neo4j session; always closed after the request."""
    session = get_driver().session()
    try:
        yield session
    finally:
        session.close()


SessionDep = Annotated[Session, Depends(get_session)]

# ── /health ────────────────────────────────────────────────────────────────────

@app.get("/health", tags=["meta"])
def health():
    """Liveness check: returns DB connectivity and in-memory briefing count."""
    db_ok = ping()
    norm_count: int | None = None

    if db_ok:
        try:
            with get_driver().session() as s:
                norm_count = queries.corpus_stats(s)["total"]
        except Exception:
            db_ok = False

    return {
        "status":           "healthy" if db_ok else "degraded",
        "neo4j":            "ok" if db_ok else "unreachable",
        "norm_count":       norm_count,
        "briefings_loaded": len(app.state.briefings),
        "briefings_missing": sorted(VALID_BRIEFINGS - set(app.state.briefings)),
    }

# ── /briefings/{n} ────────────────────────────────────────────────────────────

@app.get("/briefings/{n}", tags=["briefings"])
def get_briefing(n: int):
    """
    Return one of the four pre-computed Council briefings.
    Served from memory — no DB call.
    """
    if n not in VALID_BRIEFINGS:
        raise HTTPException(
            status_code=400,
            detail=f"n must be one of {sorted(VALID_BRIEFINGS)}",
        )
    data = app.state.briefings.get(n)
    if data is None:
        raise HTTPException(
            status_code=404,
            detail=f"Briefing {n} not found — run briefings.py to generate it.",
        )
    return data

# ── /norm/{id} ────────────────────────────────────────────────────────────────

@app.get("/norm/{norm_id:path}", tags=["graph"])
def get_norm(norm_id: str, session: SessionDep):
    """
    Return full norm metadata plus its complete 1-hop neighbourhood:
    all directly connected norms and the edges between them.
    """
    result = queries.get_neighbourhood(session, norm_id)
    if result is None:
        raise HTTPException(status_code=404, detail=f"Norm '{norm_id}' not found.")
    return result

# ── /search ───────────────────────────────────────────────────────────────────

@app.get("/search", tags=["graph"])
def search(
    session: SessionDep,
    q: Annotated[str, Query(min_length=2, description="Search term")],
    limit: Annotated[int, Query(ge=1, le=100, description="Max results")] = 20,
):
    """
    Case-insensitive substring search on norm título, BOE id, and número oficial.
    Results ordered: exact ID match → id prefix → everything else; alive before dead.
    """
    results = queries.search_norms(session, q, limit)
    return {"query": q, "count": len(results), "results": results}

# ── /subgraph ─────────────────────────────────────────────────────────────────

@app.get("/subgraph", tags=["graph"])
def subgraph(
    session: SessionDep,
    root:  Annotated[str, Query(description="Root norm BOE id")],
    depth: Annotated[int, Query(ge=1, le=3, description="Hop depth (max 3)")] = 1,
    types: Annotated[str, Query(description="Comma-separated edge types to include; empty = all")] = "",
    limit: Annotated[int, Query(ge=1, le=500, description="Max nodes to return")] = 150,
):
    """
    Return a bounded subgraph for the interactive explorer.

    Traverses up to `depth` hops from `root` (undirected), caps at `limit` unique
    nodes, then returns all edges between those nodes (optionally filtered by type).

    Valid types: AMENDS, REPEALS, CITES, CORRECTS.
    """
    # Parse and validate relationship types
    type_list: list[str] = []
    if types:
        type_list = [t.strip().upper() for t in types.split(",") if t.strip()]
        unknown = set(type_list) - VALID_EDGE_TYPES
        if unknown:
            raise HTTPException(
                status_code=400,
                detail=f"Unknown edge type(s): {sorted(unknown)}. "
                       f"Valid: {sorted(VALID_EDGE_TYPES)}",
            )

    result = queries.get_subgraph(session, root, depth, type_list, limit)
    if result is None:
        raise HTTPException(status_code=404, detail=f"Root norm '{root}' not found.")
    return result

# ── /ask ──────────────────────────────────────────────────────────────────────

class AskRequest(BaseModel):
    question: str = Field(..., min_length=2, max_length=1000,
                          description="Natural-language question in Spanish or English")


@app.post("/ask", tags=["ask"])
async def ask(body: AskRequest, session: SessionDep):
    """
    Natural-language → Cypher → result table.

    1. Sends the question to claude-sonnet-4-5 with the graph schema in the
       system prompt (prompt-cached for speed).
    2. Extracts the Cypher from the response and rejects any write keywords
       (CREATE / MERGE / DELETE / SET / REMOVE / DROP / FOREACH).
    3. Executes the read-only query against Neo4j and returns both the Cypher
       and the result rows so the minister sees how the answer was derived.
    """
    if not app.state.llm_ready:
        raise HTTPException(
            status_code=503,
            detail="LLM not configured. Set ANTHROPIC_API_KEY and restart.",
        )

    # ── Step 1: generate Cypher via LLM ───────────────────────────────────
    try:
        llm_result = await llm.ask(body.question)
    except PermissionError as exc:
        raise HTTPException(status_code=403, detail=str(exc))
    except ValueError as exc:
        # LLM could not formulate a query — return its explanation as the answer
        return {
            "question": body.question,
            "explanation": str(exc),
            "cypher": None,
            "columns": [],
            "rows": [],
            "row_count": 0,
            "error": None,
        }
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"LLM error: {exc}")

    cypher: str = llm_result["cypher"]
    explanation: str = llm_result["explanation"]

    # ── Step 2: execute against Neo4j (in a thread — session is sync) ─────
    def _run_query():
        result = session.run(cypher)
        return llm.serialize_results(result)

    try:
        columns, rows = await asyncio.to_thread(_run_query)
    except Exception as exc:
        # Return the generated Cypher alongside the error so the minister can
        # see what was attempted and report a meaningful bug.
        return {
            "question": body.question,
            "explanation": explanation,
            "cypher": cypher,
            "columns": [],
            "rows": [],
            "row_count": 0,
            "error": str(exc),
            "usage": llm_result.get("usage"),
        }

    return {
        "question":    body.question,
        "explanation": explanation,
        "cypher":      cypher,
        "columns":     columns,
        "rows":        rows,
        "row_count":   len(rows),
        "error":       None,
        "usage":       llm_result.get("usage"),
    }
