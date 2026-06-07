# Project Overview — BOE Legislative Knowledge Graph
### Reversa AI · Founding Engineer Challenge · June 2026

---

## 1. The Problem

The Spanish statute book is broken in a way that is invisible to the people who govern it. Over two centuries of legislation, each new law has silently modified, repealed, or referenced dozens of others — through omnibus acts, budget riders, and patchwork amendments. The result is a corpus of consolidated legislation where:

- Individual laws have been amended dozens or hundreds of times by different governments
- Acts of Parliament have rewritten hundreds of unrelated statutes in a single stroke
- A significant fraction of in-force law still cites norms that were repealed years ago
- Specific repeal operations (like Ley 30/1992, repealed in 2015) have never been fully cleaned up

The BOE (Boletín Oficial del Estado) publishes a machine-readable API of all consolidated legislation. The data is public and structured. No one had ever built the graph.

**The challenge:** take the entire BOE consolidated legislation corpus, model it as a knowledge graph, and answer four specific questions the Council of Ministers would actually need answered.

---

## 2. Deliverables

| # | Deliverable | Status |
|---|---|---|
| 1 | Code in a public GitHub repository | ✅ |
| 2 | Web platform: interactive graph + four briefing pages | ✅ |
| 3 | One-page design document (schema and rationale) | ✅ `DESIGN.md` |
| 4 | Five-minute video addressed to the Council | ✅ `PITCH_SCRIPT.md` |
| Bonus | Natural-language `/ask` chat assistant (LLM → Cypher → result) | ✅ |

---

## 3. Data Pipeline

### 3.1 Discovery

Before writing a single line of production code, the BOE API was reverse-engineered end-to-end:

- Enumerated all endpoints: `/legislacion-consolidada`, `/id/{id}/metadatos`, `/id/{id}/analisis`
- Confirmed the corpus size by binary search on the `offset` parameter: **~12,200–12,250 norms** as of June 2026
- Mapped the full JSON shape of metadatos and analisis responses
- Identified all relation codes in the `anteriores` block: 10 distinct codes including DEROGA (210), MODIFICA (270), CITA (330), AÑADE (407)
- Identified four critical API quirks: mandatory `Accept: application/json` header, empty lists returning `""` (string) not `[]`, double-nested `anteriores`/`posteriores` wrapper structure, and `estatus_derogacion` being absent from the list endpoint
- Confirmed the canonical identifier for Ley 30/1992: `BOE-A-1992-26318`

All findings documented in `DISCOVERY.md`.

### 3.2 Ingestion (`ingest.py`)

An async Python pipeline built with `httpx` and `asyncio`:

- **Concurrency:** 10 simultaneous HTTP requests (conservative, no documented rate limit)
- **Resumable:** skips files already on disk — safe to interrupt and restart at any point
- **Idempotent:** running twice produces exactly the same result
- **Retry logic:** exponential backoff on 429/5xx (2s → 4s → 8s → 16s → 32s), up to 5 attempts per request
- **Output:** one JSON file per norm at `data/raw/<id>.json`, containing merged metadatos + analisis
- **Pagination:** the index is fetched in pages of 500 (server caps at 10,000 per call); full index cached to `data/raw/_index.json`
- **Result:** **12,045 norms** downloaded, covering the full consolidated legislation corpus

### 3.3 Graph Loading (`load_neo4j.py`)

Loads the raw JSON into Neo4j using MERGE (no duplicates on re-run):

- One `:Norm` node per norm, with properties: `id`, `titulo`, `rango`, `numero_oficial`, `fecha_disposicion`, `departamento`, `is_dead` (derived boolean), `in_corpus`, `estatus_derogacion`, `vigencia_agotada`
- **`is_dead` design decision:** derived from three raw fields (`estatus_derogacion`, `vigencia_agotada`, `estatus_anulacion`) into a single boolean at load time, making every briefing query simpler without losing auditability
- Four edge types, all pointing from acting norm → acted-on norm:
  - **:AMENDS** — codes 270 (MODIFICA) and 407 (AÑADE)
  - **:REPEALS** — code 210 (DEROGA), with `is_partial` flag for article-level derogations
  - **:CITES** — codes 330 (CITA), 440 (SE DICTA DE CONFORMIDAD), 490 (SE DESARROLLA), 331 (SE DICTA EN RELACIÓN)
  - **:CORRECTS** — code 201 (CORRECCIÓN de errores)
- Dropped edge types: codes 470 (Constitutional Court declarations) and 530 (pending constitutional questions) connect to judicial documents outside the legislative domain
- Batched in groups of 1,000 for performance
- **Result:** **25,864 nodes** and **54,406 edges** in the graph

---

## 4. The Four Briefings (`briefings.py`)

Four parameterized Cypher queries, run once against Neo4j, results written to `data/briefings/1.json` through `4.json` and to `BRIEFINGS.md`. The API serves them from memory (<1 ms response time).

### Briefing 01 — Diagnosis: which laws are unreadable?

**Question:** Which in-force laws have been modified most often by subsequent legislation?

**Cypher logic:** Count incoming `:AMENDS` edges and partial `:REPEALS` edges per in-force, in-corpus norm. Rank descending.

**Answer:** The **Ley 35/2006, de 28 de noviembre, del Impuesto sobre la Renta de las Personas Físicas** leads with **87 cumulative amendments** from 87 different acts — the most fragmented law in Spain.

**Why it matters:** A law amended 87 times by 87 different governments is no longer coherent legislation. It is a palimpsest. The minister needs to know which laws are first in line for a clean rewrite.

### Briefing 02 — Root cause: who made the mess?

**Question:** Which laws have modified the most other laws in a single act?

**Cypher logic:** Count outgoing `:AMENDS` and `:REPEALS` edges per in-corpus norm. Rank by distinct targets descending.

**Answer:** **Ley 5/2017** rewrote **282 distinct laws** in a single omnibus act.

**Why it matters:** These are the structural cause of Briefing 01's problem. Omnibus acts — typically disguised as budget riders or "accompanying laws" — silently rewrite dozens of unrelated statutes. The Council can restrict this practice with a single instrument of legislative technique.

### Briefing 03 — The rot: how much statute book rests on dead law?

**Question:** What fraction of in-force norms cite at least one repealed norm?

**Cypher logic (part a):** Count in-force norms that have at least one `:CITES` edge pointing to a dead norm. Divide by total in-force norms.

**Cypher logic (part b):** Count how many living norms cite each dead norm. Rank to find the "ghost norms" most cited by living law.

**Answer:** **17.6% of in-force Spanish law** — 1,709 of 9,716 norms — cites at least one repealed norm as if it still exists.

**Why it matters:** Every ghost citation is a legal trap. The citizen or official who follows the reference arrives at a norm that no longer exists. In extreme cases this constitutes grounds for legal challenge.

### Briefing 04 — The scalpel: the unfinished repeal of Ley 30/1992

**Question:** How many in-force norms still directly cite Ley 30/1992, formally repealed on 2 April 2021?

**Cypher logic:** Locate `BOE-A-1992-26318` dynamically (by `numero_oficial` + `rango`), then count in-force norms with a `:CITES` edge pointing to it.

**Answer:** **275 in-force norms** still invoke Ley 30/1992, almost six years after its formal repeal.

**Why it matters:** This is the most actionable finding. Each norm in the list is a concrete update task that can be assigned to a specific ministry. The Council can close the repeal operation with a targeted directive.

---

## 5. API (`api/`)

A FastAPI application with five endpoints:

| Endpoint | Method | Description |
|---|---|---|
| `/health` | GET | Liveness + Neo4j connectivity + norm count |
| `/briefings/{n}` | GET | Pre-computed briefing (served from memory, <1 ms) |
| `/norm/{id}` | GET | Full norm metadata + 1-hop neighbourhood |
| `/search` | GET | Case-insensitive substring search on title/id/numero_oficial |
| `/subgraph` | GET | Bounded BFS from a root norm (depth 1–3, up to 500 nodes) |
| `/ask` | POST | Natural-language question → Cypher → result table |

Key design decisions:
- **Pre-computed briefings:** The four answers are computed once and held in memory. No Neo4j round-trip on page load. Sub-millisecond response.
- **`/ask` safety gate:** A word-boundary regex blocks any Cypher containing CREATE, MERGE, DELETE, SET, REMOVE, DROP, or FOREACH before execution. The API is read-only.
- **`/ask` prompt caching:** The graph schema system prompt is marked for Anthropic prompt caching, reducing latency and cost on repeated questions.
- **python-dotenv:** The `.env` file is loaded automatically at startup — no manual environment variable export required.

---

## 6. Frontend (`web/`)

A Next.js 13 app with Tailwind CSS. Chose Next.js 13 specifically for Node.js 17.6.0 compatibility (Next.js 14+ requires Node 18+).

### Pages

**Landing page (`/`)**
- Animated particle-graph canvas in the hero (75 floating nodes + connecting edges, simulating the legislative graph)
- Real Reversa logo (white PNG) in the navigation bar
- SVG favicon matching the logo
- Four briefing cards with dark gradient backgrounds unique to each briefing (blue/amber/red/emerald) and colored accent borders
- Corpus statistics: 12,288 norms, ~9,100 in force, 100,000+ relationships mapped
- Each card displays the live answer distilled from the pre-computed briefing data

**Briefing pages (`/briefings/1` through `/briefings/4`)**
- Dark navy header with the answer as the first and largest element on the page
- Contextual paragraph explaining the political significance
- Official-style data table with full results
- Embedded subgraph visualization (react-force-graph-2d) showing the 1-hop neighbourhood of the top result
- Breadcrumb navigation and prev/next briefing links

**Graph Explorer (`/explore`)**
- Full-screen interactive force graph
- Search any norm by title, ID, or número oficial
- Click any node to expand its neighbourhood
- NodePanel sidebar with full norm metadata
- Edge filter by type (AMENDS / REPEALS / CITES / CORRECTS)
- Color coding: navy = in force, red = repealed, grey = referenced but not in corpus

**Chat assistant (all pages)**
- Floating "Consultar" button present on every page
- Natural-language questions in Spanish or English
- Powered by `claude-sonnet-4-5` with the graph schema in the system prompt
- Returns the plain-language explanation, the generated Cypher, and the result table
- Ministers can ask their own questions without touching a query

### Components

| Component | Purpose |
|---|---|
| `HeroCanvas` | Client-side animated particle canvas for the hero background |
| `ReversaLogo` | Displays the Reversa brand logo from `/public/reversa-logo-white.png` |
| `GraphExplorer` | Full-screen force graph with search and click-to-expand |
| `SubGraph` | Embedded read-only subgraph for briefing pages |
| `NodePanel` | Slide-in sidebar with norm detail and edge list |
| `ChatPanel` | Floating natural-language assistant |

---

## 7. Stack

| Layer | Technology | Reason |
|---|---|---|
| Corpus download | Python 3.10 + httpx + asyncio | Async, resumable, 10 concurrent workers |
| Graph database | Neo4j 5 (Docker) | Native graph queries, Cypher BFS syntax |
| API | FastAPI + Uvicorn | Thin, async, auto-docs at `/docs` |
| LLM | Anthropic claude-sonnet-4-5 | Schema prompt cached; safety gate on write operations |
| Frontend | Next.js 13 + Tailwind CSS | Server components; Node 17 compatible |
| Graph rendering | react-force-graph-2d | Canvas-based, handles 2,000+ nodes without WebGL |

---

## 8. Key Numbers

| Metric | Value |
|---|---|
| Norms in corpus | 12,045 |
| Nodes in graph | 25,864 |
| Edges in graph | 54,406 |
| In-force norms | 9,716 |
| Most amended law | Ley 35/2006 — 87 amendments |
| Biggest omnibus | Ley 5/2017 — 282 laws rewritten in one act |
| Ghost citation rate | 17.6% of in-force law cites dead law |
| Ley 30/1992 blast radius | 275 in-force norms |

---

## 9. Design Decisions & Tradeoffs

**One node label, four edge types.** Every norm in the corpus carries the same property set regardless of its `rango` (Ley, Real Decreto, Orden…). Splitting by type would add join complexity without enabling anything a property filter can't handle.

**Edges point forward (acting → acted-on).** The BOE `analisis` block encodes each relationship in the source norm's `anteriores`. Processing only `anteriores` produces exactly one edge per relationship with no deduplication logic.

**`is_dead` as a derived boolean.** The status of a norm is encoded across three raw fields. Computing a single boolean at load time makes every briefing query simpler; the raw fields are preserved on the node for auditability.

**Pre-computed briefings over live queries.** The briefings answer strategic policy questions, not real-time monitoring. Computing on page load would add 50–500 ms of Neo4j latency to every request. Serving from memory gives sub-millisecond responses.

**Law-level graph, not article-level.** Parsing article-level amendments from the `texto` block would require NLP to identify article boundaries. The law-level graph answers all four briefings exactly as specified. The `detail` property on each edge preserves the raw article reference text so article-level resolution can be added later.

---

## 10. What Would Come Next

- **Article-level resolution:** Model `(:Artículo)` nodes inside each `(:Norm)`. Briefing 01 becomes surgically precise — "Article 9 of the Código Civil has been amended 11 times."
- **Amendment-path tracing:** A timeline UI showing every intervention on a specific article in chronological order.
- **AI-generated summaries:** Each briefing result is a norm with edges. One LLM prompt produces the plain-language explanation a minister would otherwise need a lawyer for.
- **Incremental ingest:** The `_index.json` carries `fecha_actualizacion` per norm. A nightly scheduler could re-fetch only norms updated since the last run in under two minutes.
- **Production deployment:** Containerise (Neo4j + FastAPI + Next.js), nightly cron, ministry SSO. One Dockerfile per service, one Compose file.

---

*Built by Guille · Reversa AI founding engineer challenge · June 2026*
