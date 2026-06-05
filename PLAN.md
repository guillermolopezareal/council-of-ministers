# Reversa — Council of Ministers: Challenge Plan

## What We're Building

A knowledge graph of the entire Spanish BOE consolidated-legislation corpus, served as a web platform with an interactive graph and four pre-computed briefings. The audience is a government minister: the answers must be self-evident on screen without reading a single query.

---

## The Four Briefings

### 01 — Diagnosis: which laws are unreadable?
**Metric:** count of *incoming* `amended_by` edges per norm (how many other laws have amended it).  
**Output:** top 5 norms with the highest in-degree on the "amended_by" relationship.  
**Why it matters:** a law amended dozens of times has likely been reduced to an incoherent patchwork — first candidate for a clean rewrite.

### 02 — Root cause: the omnibus offenders
**Metric:** count of *outgoing* `amends` edges per norm (how many other laws it has modified).  
**Output:** top 5 norms that amend the most other norms.  
**Why it matters:** these are the "legislative omnibuses" — sprawling acts that silently rewrote unrelated statutes and are the structural cause of the mess in Briefing 01.

### 03 — The rot: live law on dead foundations
**Metric:** for each in-force norm, check whether any of its `cites` targets have `estatus_derogacion` = repealed.  
**Output:** (a) percentage of in-force norms that cite at least one repealed norm; (b) top 5 repealed norms most cited by in-force norms.  
**Why it matters:** these "ghost citations" represent legal uncertainty — live law referencing legal ground that no longer exists.

### 04 — The scalpel: Ley 30/1992 blast radius
**Metric:** filter in-force norms whose `cites` list includes Ley 30/1992 directly.  
**Output:** the full worklist of in-force norms that still cite Ley 30/1992 (repealed 2015, replaced by Leyes 39/2015 and 40/2015).  
**Why it matters:** this is a concrete, actionable cleanup task — the Council can assign these orphan references to ministries and close the repeal operation.

---

## Data Source & Key Fields

- **API:** `boe.es/datosabiertos` — paginated, public, uniform.
- **`analisis` block per norm:** contains the edges we need — `amends`, `amended_by`, `repeals`, `repealed_by`, `cites`.
- **`estatus_derogacion`:** the in-force status. Three meaningful states:
  - In force (possibly with amendments)
  - Partially repealed
  - Totally repealed
  The distinction matters critically for Briefings 03 and 04 — partially-repealed norms require care.

---

## Deliverables

| # | What |
|---|------|
| 1 | Code in a public repository |
| 2 | Web platform: interactive graph (zoom, filters, search) + four briefings embedded |
| 3 | 1-page design doc: schema and rationale |
| 4 | 5-minute video addressed to the Council |
| Bonus | Something we weren't asked for |

**Timeline:** one week.  
**Stack:** free choice — judgment on prioritization is what's being evaluated.

---

## Riskiest Parts

### 1. API scale and ingestion time — HIGH RISK
The corpus covers two centuries of legislation. "Large but paginated" could mean 30,000–100,000+ norms. A naive sequential ingest could take many hours. If ingestion breaks halfway through, we need idempotent resumption, not a restart. **Mitigation:** async/parallel fetching with a local checkpoint (SQLite or similar), rate-limit-aware, restartable.

### 2. `estatus_derogacion` nuances — HIGH RISK
The brief explicitly warns to "read it carefully." Misclassifying a partially-repealed law as "in force" inflates the ghost-citation count; misclassifying it as "repealed" deflates Briefing 04's worklist. **Mitigation:** enumerate all values that appear in the wild before writing any filter logic; treat partial repeal as a distinct state, not a binary.

### 3. `analisis` block completeness — MEDIUM RISK
Older or less-digitized norms may have sparse or missing `analisis` data. If the relationship edges are absent, Briefings 01 and 02 silently under-count. **Mitigation:** log norms with empty `analisis` blocks; report coverage percentage alongside results so the Council understands data quality.

### 4. Identifying Ley 30/1992 reliably — MEDIUM RISK
Briefing 04 requires matching a specific law by its identifier across `cites` fields. The BOE identifier format needs to be confirmed (likely `BOE-A-1992-XXXXX`), and `cites` entries may use short-form references that don't match the canonical ID. **Mitigation:** look up the exact BOE document ID early in ingestion; test string matching against a sample before running the full filter.

### 5. Graph visualization at scale — MEDIUM RISK
An interactive graph of tens of thousands of nodes with citation edges will not render in a browser naively. Rendering everything at once will be unusable for a minister. **Mitigation:** display the graph as ego-networks (node + direct neighbors) or curated subgraphs (e.g., top 100 most-connected norms), not the full corpus at once. The briefing answers are pre-computed — the graph is for exploration, not the primary answer surface.

### 6. Data quality across two centuries — LOW-MEDIUM RISK
Encoding inconsistencies, missing metadata, and structural variations in older laws are likely. **Mitigation:** defensive parsing, log anomalies, don't let one malformed record crash the ingest.

---

## What I'm Deliberately Not Building (yet)

- Full-text search of law content (not asked for, high complexity)
- Real-time API sync / webhooks (out of scope for one week)
- Authentication / access control (single-user demo context)
- Natural-language Q&A over the corpus (tempting but not the brief)

---

## Waiting for first prompt.
