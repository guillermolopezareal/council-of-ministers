# Reversa — Council of Ministers

> Turn the Spanish BOE into a knowledge graph. Answer the four questions the Council of Ministers will actually ask in that room.

12 045 consolidated norms. Two centuries of amendments, repeals, and citations. Mapped as a graph, queried in milliseconds, presented as a briefing a minister can read without touching a query. A dedicated `/ask` console lets ministers pose their own questions in plain Spanish — the system generates the Cypher, runs it, and reveals the query on request.

---

## The four answers

| # | The question | The answer |
|---|---|---|
| **01** | Which laws have become unreadable? | The **Ley del IRPF (35/2006)** has been amended **87 times** by 87 different acts — the most fragmented law in Spain |
| **02** | Who made the mess? | **Ley 5/2017** rewrote **282 distinct laws** in a single omnibus act |
| **03** | How much statute book rests on dead law? | **17.6 %** of in-force norms — **1 709 of 9 716** — cite at least one repealed law |
| **04** | What is the blast radius of Ley 30/1992? | **275 in-force norms** still invoke a statute formally repealed on 2 April 2021 |

---

## Local setup

**Prerequisites:**
- Python 3.10+
- Node.js 17+
- Docker (for Neo4j — no account needed)

### 1 — Clone and configure

```bash
git clone https://github.com/guillermolopezareal/council-of-ministers.git
cd council-of-ministers
cp .env.example .env
```

Edit `.env` and set at minimum:
```
NEO4J_PASSWORD=password
ANTHROPIC_API_KEY=sk-ant-...   # optional — only needed for the /ask page
```

Create `web/.env.local`:
```
NEXT_PUBLIC_API_URL=http://127.0.0.1:8000
```

### 2 — Start Neo4j (Docker, no account)

```bash
docker run --name neo4j-boe \
  -p 7474:7474 -p 7687:7687 \
  -e NEO4J_AUTH=neo4j/password \
  --restart unless-stopped \
  -d neo4j:5
```

### 3 — Download corpus, build graph, compute briefings (~15 min first run)

**Windows (PowerShell):**
```powershell
.\.venv\Scripts\Activate.ps1  # or: python -m venv .venv first
pip install httpx neo4j fastapi uvicorn anthropic

# Load env vars
Get-Content .env | ForEach-Object {
    if ($_ -match '^([^#=]+)=(.+)$') {
        [System.Environment]::SetEnvironmentVariable($matches[1].Trim(), $matches[2].Trim(), 'Process')
    }
}

python ingest.py
python load_neo4j.py --reset
python briefings.py
```

**Linux / macOS:**
```bash
python -m venv .venv && source .venv/bin/activate
pip install httpx neo4j fastapi uvicorn anthropic
export $(grep -v '^#' .env | xargs)
python ingest.py && python load_neo4j.py --reset && python briefings.py
```

### 4 — Start the API (port 8000)

```powershell
# Windows — in a dedicated terminal with env loaded
uvicorn api.main:app --reload
```

### 5 — Start the frontend (port 3000)

```powershell
# Windows — in a second terminal
cd web
npm install
npm run dev
```

Open **http://localhost:3000**.

---

## Environment variables

| Variable | Default | Required |
|---|---|---|
| `NEO4J_URI` | `bolt://localhost:7687` | No |
| `NEO4J_USER` | `neo4j` | No |
| `NEO4J_PASSWORD` | — | **Yes** |
| `ANTHROPIC_API_KEY` | — | No (activates the `/ask` page) |
| `NEXT_PUBLIC_API_URL` | `http://localhost:8000` | Set to `http://127.0.0.1:8000` in `web/.env.local` on Windows |

---

## Architecture

```
BOE API (boe.es/datosabiertos)
    │
    ▼
ingest.py          — async download, 10 concurrent, resumable, idempotent
    │  data/raw/<id>.json  (12 045 files)
    ▼
load_neo4j.py      — MERGE nodes + edges, batched 1 000
    │  Neo4j 5 — 25 864 nodes, 54 406 edges
    ▼
briefings.py       — four parameterized Cypher queries → data/briefings/*.json
    │
    ├── api/       FastAPI
    │   ├── /briefings/{n}   served from memory (<1 ms)
    │   ├── /norm/{id}       1-hop neighbourhood
    │   ├── /search          substring search
    │   ├── /subgraph        bounded BFS for explorer
    │   └── /ask             LLM → Cypher → result (claude-sonnet-4-5)
    │
    └── web/       Next.js 13 + Tailwind — editorial, serif/sans, single accent
        ├── /                single-sentence opening + four briefings as numbered rows
        ├── /briefings/[id]  answer-first layout, table, embedded subgraph + caption
        ├── /explore         curated graph explorer (Wikipedia-infobox side panel)
        └── /ask             dedicated natural-language console (typewriter reveal)
```

---

## Repository structure

```
.
├── ingest.py              Async BOE corpus downloader
├── load_neo4j.py          Graph loader (MERGE nodes + edges)
├── briefings.py           Four briefing queries → MD + JSON
├── api/
│   ├── main.py            FastAPI app, CORS, lifespan, /ask endpoint
│   ├── queries.py         All Cypher lives here
│   ├── llm.py             Anthropic integration + Cypher safety gate
│   └── db.py              Neo4j driver singleton
├── web/
│   ├── app/               Next.js App Router pages
│   │   ├── page.tsx       Landing — single sentence + briefings as numbered rows
│   │   ├── briefings/[id] Answer-first layout, one page per question
│   │   ├── explore/       Curated graph explorer
│   │   └── ask/           Dedicated natural-language console
│   └── components/        SubGraph, GraphExplorer, NodePanel, AskConsole, CypherDisclosure
├── data/
│   ├── raw/               <id>.json per norm + _index.json
│   └── briefings/         1.json – 4.json (frontend data)
├── PLAN.md                Initial challenge analysis
├── DISCOVERY.md           BOE API exploration notes
├── SCHEMA.md              Graph schema with all decisions (incl. full relation code table)
├── DESIGN.md              One-page design document (Deliverable 3)
├── BRIEFINGS.md           Live briefing output with Cypher
├── PITCH_SCRIPT.md        5-minute video script for the Council (Deliverable 4)
└── PROJECT_OVERVIEW.md    Full project narrative — problem, pipeline, deliverables
```

---

## Stack

| Layer | Choice | Why |
|---|---|---|
| Corpus download | Python + httpx + asyncio | Async, resumable, 10 concurrent, zero extra deps |
| Graph database | Neo4j 5 (Docker) | Native graph queries; MATCH path syntax for BFS |
| API | FastAPI | Thin, async, auto-docs at `/docs`, open CORS |
| LLM | Anthropic claude-sonnet-4-5 | Schema prompt cached; safety gate blocks write Cypher |
| Frontend | Next.js 13 + Tailwind | Server components for briefings; works with Node 17 |
| Graph rendering | react-force-graph-2d | Canvas-based, 2 000+ nodes, no WebGL dependency |

---

## Re-running

Every script is idempotent:

- `ingest.py` — skips files already on disk; `--refresh-index` re-fetches the catalogue
- `load_neo4j.py` — MERGE never duplicates; `--reset` wipes and reloads
- `briefings.py` — overwrites `data/briefings/*.json` and `BRIEFINGS.md`; restart the API after to load fresh data into memory

---

## Deliverables

| # | Deliverable | File / URL |
|---|---|---|
| 1 | Code in a public repository | This repo |
| 2 | Web platform with graph + four briefings | `web/` — runs at localhost:3000 |
| 3 | 1-page design doc | `DESIGN.md` |
| 4 | 5-minute video for the Council | `PITCH_SCRIPT.md` (script for the recorded video) |
| Bonus | Natural-language `/ask` assistant | Dedicated console at `/ask` — typewriter reveal, hidden Cypher disclosure |

---

*Built by Guille · Reversa AI founding engineer challenge · June 2026*
