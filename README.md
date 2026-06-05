# Reversa — Council of Ministers

> Turn the Spanish BOE into a knowledge graph. Answer the four questions the Council of Ministers will actually ask in that room.

12 288 consolidated norms. Two centuries of amendments, repeals, and citations. Mapped as a graph, queried in milliseconds, presented as a briefing a minister can read without touching a query.

---

## The four answers

| # | The question | The answer |
|---|---|---|
| **01** | Which laws have become unreadable? | The **Código Civil** has been amended **85 times** by **52 different acts** since 1889 — the most fragmented law in Spain |
| **02** | Who made the mess? | The **Ley de Presupuestos 2023** rewrote **71 distinct laws** in a single omnibus act |
| **03** | How much statute book rests on dead law? | **36 %** of in-force norms — **3 276 of 9 100** — cite at least one repealed law |
| **04** | What is the blast radius of Ley 30/1992? | **287 in-force norms** still invoke a statute formally repealed on 2 April 2021 |

---

## Screenshot

![Explorer and Briefing 01](docs/screenshot.png)
*The graph explorer (left) and Briefing 01 as seen by a minister (right). Every briefing opens with the answer in the first sentence — no query, no jargon.*

---

## Local setup — three commands

**Prerequisites:** Python 3.10 +, Node.js 17 +, Neo4j 4.4 + running locally (default bolt://localhost:7687).

```bash
# Copy env template and fill in your Neo4j password
cp .env.example .env
```

```bash
# 1 — Download the full BOE corpus, build the graph, compute the briefings
#     (~15 min on first run; subsequent runs skip already-fetched norms)
python ingest.py && \
python load_neo4j.py --reset && \
python briefings.py
```

```bash
# 2 — Start the API  (port 8000)
uvicorn api.main:app --reload
```

```bash
# 3 — Start the frontend  (port 3000)
cd web && npm install && npm run dev
```

Open [http://localhost:3000](http://localhost:3000). The four briefing cards load data from the API. The graph explorer seeds from the top briefing results.

### Environment variables

| Variable | Default | Required |
|---|---|---|
| `NEO4J_URI` | `bolt://localhost:7687` | No |
| `NEO4J_USER` | `neo4j` | No |
| `NEO4J_PASSWORD` | — | **Yes** |
| `NEXT_PUBLIC_API_URL` | `http://localhost:8000` | No |

Create `.env` in the project root; `ingest.py`, `load_neo4j.py`, `briefings.py`, and the FastAPI server all read from it.

---

## Architecture

```
BOE API (boe.es/datosabiertos)
    │
    ▼
ingest.py          — async download, 10 concurrent, resumable
    │  data/raw/<id>.json
    ▼
load_neo4j.py      — MERGE nodes + edges, batched 1 000, idempotent
    │  Neo4j graph DB
    ▼
briefings.py       — four parameterized Cypher queries → data/briefings/*.json
    │
    ├── api/       — FastAPI, briefings served from memory, /norm, /search, /subgraph
    │
    └── web/       — Next.js 13 App Router + Tailwind + react-force-graph-2d
```

---

## Repository structure

```
.
├── ingest.py              Async BOE corpus downloader
├── load_neo4j.py          Graph loader (MERGE nodes + edges)
├── briefings.py           Four briefing queries → MD + JSON
├── api/
│   ├── main.py            FastAPI app, CORS, lifespan
│   ├── queries.py         All Cypher lives here
│   └── db.py              Neo4j driver singleton
├── web/
│   ├── app/               Next.js App Router pages
│   │   ├── page.tsx       Landing — four briefing cards
│   │   ├── briefings/[id] One page per question
│   │   └── explore/       Full graph explorer
│   └── components/        SubGraph, GraphExplorer, NodePanel
├── data/
│   ├── raw/               <id>.json per norm + _index.json
│   └── briefings/         1.json – 4.json (frontend data)
├── PLAN.md                Initial challenge analysis
├── DISCOVERY.md           BOE API exploration notes
├── SCHEMA.md              Graph schema with all decisions
├── DESIGN.md              One-page design document (this challenge's deliverable 3)
└── BRIEFINGS.md           Live briefing output with Cypher
```

---

## Stack

| Layer | Choice | Why |
|---|---|---|
| Corpus download | Python + httpx + asyncio | Async, resumable, zero extra deps |
| Graph database | Neo4j 4.4 | Native graph queries; MATCH path syntax for BFS |
| API | FastAPI | Thin, async, auto-docs, easy CORS |
| Frontend | Next.js 13 + Tailwind | Server components for briefing pages; clean build with Node 17 |
| Graph rendering | react-force-graph-2d | Canvas-based, 2 000 + nodes, no WebGL dependency |

---

## Re-running

Every script is idempotent. Run any command again safely:

- `ingest.py` — skips files already on disk; `--refresh-index` re-fetches the catalogue
- `load_neo4j.py` — MERGE never duplicates; `--reset` wipes and reloads
- `briefings.py` — overwrites `data/briefings/*.json` and `BRIEFINGS.md`

---

*Built by Guille · Reversa AI technical challenge · June 2026*
