"""Neo4j driver singleton — one driver, one connection pool, sessions per request."""
from __future__ import annotations

import os

from neo4j import GraphDatabase, Driver

_driver: Driver | None = None


def get_driver() -> Driver:
    global _driver
    if _driver is None:
        _driver = GraphDatabase.driver(
            os.environ.get("NEO4J_URI",  "bolt://localhost:7687"),
            auth=(
                os.environ.get("NEO4J_USER",     "neo4j"),
                os.environ.get("NEO4J_PASSWORD",  ""),
            ),
        )
    return _driver


def close_driver() -> None:
    global _driver
    if _driver is not None:
        _driver.close()
        _driver = None


def ping() -> bool:
    """Return True if Neo4j is reachable."""
    try:
        get_driver().verify_connectivity()
        return True
    except Exception:
        return False
