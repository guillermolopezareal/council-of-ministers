#!/usr/bin/env python3
"""
ingest.py — BOE consolidated legislation ingestion pipeline.

Downloads every norm (metadatos + analisis) to data/raw/<id>.json.
Idempotent: skips files that already exist on disk.
Safe to interrupt and resume at any time.

Usage:
    python ingest.py                     # full run, concurrency=10
    python ingest.py --limit 50          # dev/smoke-test
    python ingest.py --concurrency 20    # faster for good connections
    python ingest.py --refresh-index     # force re-fetch of norm list
"""

from __future__ import annotations

import argparse
import asyncio
import json
import logging
import os
import sys
from datetime import datetime, timezone
from pathlib import Path

import httpx

# ── Constants ──────────────────────────────────────────────────────────────────

BASE_URL = "https://boe.es/datosabiertos/api/legislacion-consolidada"
HEADERS = {"Accept": "application/json"}

DEFAULT_CONCURRENCY = 10
DEFAULT_OUTPUT_DIR = Path("data/raw")
LOG_FILE = Path("ingest.log")

# Per-request timeout (connect / read / write / pool)
TIMEOUT = httpx.Timeout(connect=15.0, read=60.0, write=10.0, pool=10.0)
# Longer timeout for the single full-index call (limit=-1)
INDEX_TIMEOUT = httpx.Timeout(connect=15.0, read=180.0, write=10.0, pool=10.0)
INDEX_PAGE_SIZE = 500   # norms per pagination request (limit=-1 is server-capped at 10 000)

MAX_RETRIES = 5
BACKOFF_BASE = 2.0          # retry delay = BACKOFF_BASE ** attempt  → 1s, 2s, 4s, 8s, 16s
TRANSIENT_STATUSES = {429, 500, 502, 503, 504}

PROGRESS_EVERY = 500        # log progress every N norms

# ── Logging ────────────────────────────────────────────────────────────────────

def setup_logging() -> None:
    fmt = "%(asctime)s %(levelname)-8s %(message)s"
    datefmt = "%Y-%m-%d %H:%M:%S"
    logging.basicConfig(
        level=logging.INFO,
        format=fmt,
        datefmt=datefmt,
        handlers=[
            logging.StreamHandler(sys.stdout),
            logging.FileHandler(LOG_FILE, encoding="utf-8"),
        ],
    )


log = logging.getLogger(__name__)

# ── HTTP layer ─────────────────────────────────────────────────────────────────

async def get_json(
    client: httpx.AsyncClient,
    url: str,
    semaphore: asyncio.Semaphore,
    timeout: httpx.Timeout = TIMEOUT,
) -> dict | None:
    """
    GET *url* inside the semaphore, unwrap the BOE response envelope, and
    return the first data element.

    Returns:
        dict  — success (may be {} for a valid empty response)
        None  — permanent failure (404, or all retries exhausted)
    """
    for attempt in range(MAX_RETRIES):
        try:
            async with semaphore:
                resp = await client.get(url, headers=HEADERS, timeout=timeout)

            if resp.status_code == 200:
                body = resp.json()
                payload = body.get("data")
                # API quirk: empty results come as "" (string), not [] or {}
                if not payload or payload in ("", {}):
                    return {}
                if isinstance(payload, list):
                    return payload[0] if payload else {}
                return payload  # should not happen for per-norm endpoints

            if resp.status_code == 404:
                log.debug("404 %s", url)
                return None  # permanent — don't retry

            if resp.status_code in TRANSIENT_STATUSES:
                wait = BACKOFF_BASE ** attempt
                log.warning(
                    "HTTP %d %s (attempt %d/%d) — retrying in %.0fs",
                    resp.status_code, url, attempt + 1, MAX_RETRIES, wait,
                )
                await asyncio.sleep(wait)
                continue

            log.error("Unexpected HTTP %d: %s", resp.status_code, url)
            return None  # don't retry unknown status codes

        except (httpx.TimeoutException, httpx.ConnectError, httpx.RemoteProtocolError) as exc:
            wait = BACKOFF_BASE ** attempt
            log.warning(
                "Network error (%s) %s (attempt %d/%d) — retrying in %.0fs",
                type(exc).__name__, url, attempt + 1, MAX_RETRIES, wait,
            )
            await asyncio.sleep(wait)

    log.error("Gave up after %d attempts: %s", MAX_RETRIES, url)
    return None

# ── File I/O ───────────────────────────────────────────────────────────────────

def atomic_write(path: Path, content: str) -> None:
    """Write *content* to *path* via a temp file, then rename — avoids partial writes."""
    tmp = path.parent / f".{path.name}.tmp"
    tmp.write_text(content, encoding="utf-8")
    os.replace(tmp, path)  # atomic on POSIX; best-effort on Windows

# ── Per-norm ingestion ─────────────────────────────────────────────────────────

async def ingest_norm(
    client: httpx.AsyncClient,
    norm_entry: dict,
    semaphore: asyncio.Semaphore,
    out_dir: Path,
) -> str:
    """
    Fetch and save one norm.  Returns 'fetched', 'skipped', or 'failed'.

    Output file structure:
        {
          "identificador": "BOE-A-...",
          "metadatos":  { ...from /metadatos endpoint... },
          "analisis":   { ...from /analisis endpoint...  },
          "fetched_at": "2026-..."
        }

    Skipped if the output file already exists (idempotent).
    Failed only if metadatos cannot be fetched (analisis absence is tolerated).
    """
    norm_id = norm_entry["identificador"]
    out_path = out_dir / f"{norm_id}.json"

    if out_path.exists():
        return "skipped"

    meta_url = f"{BASE_URL}/id/{norm_id}/metadatos"
    analisis_url = f"{BASE_URL}/id/{norm_id}/analisis"

    # Both requests use the shared semaphore independently — they run concurrently
    # and each consumes one slot while active.
    metadatos, analisis = await asyncio.gather(
        get_json(client, meta_url, semaphore),
        get_json(client, analisis_url, semaphore),
    )

    if metadatos is None:
        # metadatos is required (contains estatus_derogacion, titulo, etc.)
        log.error("metadatos unavailable for %s — marking failed", norm_id)
        return "failed"

    record = {
        "identificador": norm_id,
        "metadatos": metadatos,
        "analisis": analisis if analisis is not None else {},
        "fetched_at": datetime.now(timezone.utc).isoformat(),
    }

    atomic_write(out_path, json.dumps(record, ensure_ascii=False, indent=2))
    log.debug("Saved %s", norm_id)
    return "fetched"

# ── Index fetch ────────────────────────────────────────────────────────────────

async def _fetch_index_page(
    client: httpx.AsyncClient, offset: int, page_size: int
) -> list[dict]:
    """Fetch one page of the norm list. Returns [] when exhausted."""
    resp = await client.get(
        f"{BASE_URL}?limit={page_size}&offset={offset}",
        headers=HEADERS,
        timeout=INDEX_TIMEOUT,
    )
    resp.raise_for_status()
    body = resp.json()
    page = body.get("data", [])
    # API quirk: empty results return "" (string) not []
    if not page or not isinstance(page, list):
        return []
    return page


async def load_index(
    client: httpx.AsyncClient,
    out_dir: Path,
    refresh: bool,
) -> list[dict]:
    """
    Return the full list of norm entries from the BOE API.

    Caches to *out_dir/_index.json* and reuses it on subsequent runs unless
    *refresh* is True.  Each entry has at minimum: identificador, vigencia_agotada,
    titulo, fecha_actualizacion.

    NOTE: the server caps ``limit=-1`` at 10 000 items.  We paginate with
    ``limit=INDEX_PAGE_SIZE`` until we get an empty page to capture all norms.
    """
    index_path = out_dir / "_index.json"

    if index_path.exists() and not refresh:
        log.info("Loading cached norm index from %s", index_path)
        norms = json.loads(index_path.read_text(encoding="utf-8"))
        if not isinstance(norms, list):
            raise ValueError("Cached index corrupt — re-run with --refresh-index.")
        return norms

    log.info("Fetching full norm index (paginated, page_size=%d)...", INDEX_PAGE_SIZE)
    all_norms: list[dict] = []
    offset = 0

    while True:
        page = await _fetch_index_page(client, offset, INDEX_PAGE_SIZE)
        if not page:
            break
        all_norms.extend(page)
        log.info("  Index page offset=%d — got %d norms (total so far: %d)",
                 offset, len(page), len(all_norms))
        if len(page) < INDEX_PAGE_SIZE:
            break  # last (possibly partial) page
        offset += INDEX_PAGE_SIZE

    # Deduplicate by identificador preserving order (guard against overlap quirks)
    seen: set[str] = set()
    unique: list[dict] = []
    for n in all_norms:
        nid = n.get("identificador", "")
        if nid and nid not in seen:
            seen.add(nid)
            unique.append(n)

    log.info("Index complete: %d norms (%d duplicates removed)",
             len(unique), len(all_norms) - len(unique))
    atomic_write(index_path, json.dumps(unique, ensure_ascii=False))
    log.info("Index cached to %s", index_path)
    return unique

# ── Main pipeline ──────────────────────────────────────────────────────────────

async def run(args: argparse.Namespace) -> None:
    out_dir = Path(args.output_dir)
    out_dir.mkdir(parents=True, exist_ok=True)

    semaphore = asyncio.Semaphore(args.concurrency)

    # Plain dict is safe here — asyncio is single-threaded; no preemption
    # between non-await statements, so counter[x] += 1 is never interrupted.
    counter: dict[str, int] = {"fetched": 0, "skipped": 0, "failed": 0}

    async with httpx.AsyncClient(follow_redirects=True) as client:

        # ── Phase 1: get the full norm list ────────────────────────────────
        norms = await load_index(client, out_dir, refresh=args.refresh_index)
        log.info("Index contains %d norms", len(norms))

        if args.limit:
            norms = norms[: args.limit]
            log.info("--limit %d: processing %d norms", args.limit, len(norms))

        total = len(norms)
        if total == 0:
            log.warning("No norms to process — exiting.")
            return

        # ── Phase 2: fetch each norm ───────────────────────────────────────
        log.info(
            "Starting ingest — %d norms, concurrency=%d, output=%s",
            total, args.concurrency, out_dir,
        )

        async def process(norm_entry: dict) -> None:
            nonlocal counter
            try:
                result = await ingest_norm(client, norm_entry, semaphore, out_dir)
            except Exception as exc:
                nid = norm_entry.get("identificador", "?")
                log.error("Unexpected error for %s: %s", nid, exc, exc_info=True)
                result = "failed"

            counter[result] += 1
            done = sum(counter.values())
            if done % PROGRESS_EVERY == 0 or done == total:
                log.info(
                    "Progress %d/%d — fetched=%d skipped=%d failed=%d",
                    done, total,
                    counter["fetched"], counter["skipped"], counter["failed"],
                )

        # Create all tasks up-front; the semaphore inside get_json keeps HTTP
        # concurrency bounded regardless of how many tasks are waiting.
        tasks = [asyncio.create_task(process(n)) for n in norms]
        await asyncio.gather(*tasks)

    # ── Summary ────────────────────────────────────────────────────────────
    sep = "=" * 58
    log.info(sep)
    log.info("INGEST COMPLETE")
    log.info("  Fetched : %d", counter["fetched"])
    log.info("  Skipped : %d  (already on disk)", counter["skipped"])
    log.info("  Failed  : %d", counter["failed"])
    log.info(sep)

# ── CLI ────────────────────────────────────────────────────────────────────────

def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(
        description="Ingest BOE consolidated legislation to data/raw/<id>.json",
        formatter_class=argparse.ArgumentDefaultsHelpFormatter,
    )
    p.add_argument(
        "--concurrency",
        type=int,
        default=DEFAULT_CONCURRENCY,
        metavar="N",
        help="Maximum concurrent HTTP requests",
    )
    p.add_argument(
        "--limit",
        type=int,
        default=None,
        metavar="N",
        help="Stop after N norms (development mode)",
    )
    p.add_argument(
        "--output-dir",
        default=str(DEFAULT_OUTPUT_DIR),
        metavar="DIR",
        help="Directory to write per-norm JSON files",
    )
    p.add_argument(
        "--refresh-index",
        action="store_true",
        help="Force re-download of the full norm list even if _index.json exists",
    )
    return p.parse_args()


if __name__ == "__main__":
    setup_logging()
    asyncio.run(run(parse_args()))
