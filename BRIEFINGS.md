# Council of Ministers — Legislative Briefings

Generated: 2026-06-04 14:10 UTC
Corpus: **12,288 consolidated norms** (9,100 in force) in Neo4j.

---

## Briefing 01 — Diagnosis

The **2** in-force laws amended most often by subsequent legislation — the primary candidates for a clean rewrite — are listed below. **Codigo Civil (1889)** leads with **85 cumulative amendments** from 52 different laws.

| # | ID               | Número oficial | Rango        | Amendments | By # laws |
| - | ---------------- | -------------- | ------------ | ---------- | --------- |
| 1 | BOE-A-1889-4763  | —              | Real Decreto | 85         | 52        |
| 2 | BOE-A-1995-25444 | 10/1995        | Ley Organica | 62         | 41        |

*Query time: 42.3 ms*

```cypher
MATCH ...
```

---

## Briefing 02 — Root cause

These are the **omnibus laws** — single acts that silently rewrote dozens of unrelated statutes at once. They are the structural cause of the consolidation backlog. **Presupuestos 2023** is the worst offender, touching **71 distinct laws** in 89 amendment actions.

| # | ID               | Número oficial | Rango | Laws touched | Total actions | Still in force |
| - | ---------------- | -------------- | ----- | ------------ | ------------- | -------------- |
| 1 | BOE-A-2022-21525 | 31/2022        | Ley   | 71           | 89            | Yes            |

*Query time: 38.1 ms*

```cypher
MATCH ...
```

---

## Briefing 03 — The rot

**36.0% of in-force Spanish law** (3,276 of 9,100 norms) cites at least one repealed norm — operating on legal ground that no longer exists. The dead law most propped up by living statutes is **Ley 30/1992**, still cited by 287 in-force norms.

### Summary
| Metric | Value |
|---|---|
| In-force norms (corpus) | 9,100 |
| Citing ≥1 repealed norm | 3,276 |
| **Share on dead ground** | **36.0%** |

### Top ghost norms

| # | ID               | Número oficial | Rango | Repealed | Cited by # live norms |
| - | ---------------- | -------------- | ----- | -------- | --------------------- |
| 1 | BOE-A-1992-26318 | 30/1992        | Ley   | 20210402 | 287                   |

*Query time: (part_a: 18.7 ms, part_b: 22.4 ms)*

**part_a**
```cypher
M1
```

**part_b**
```cypher
M2
```

---

## Briefing 04 — Scalpel

**Target norm:** `BOE-A-1992-26318` — Ley 30/1992

**1 in-force norms** still cite **BOE-A-1992-26318** (*Ley 30/1992*), which was repealed in 2015 and superseded by Leyes 39/2015 and 40/2015. Each entry below is a concrete update task for the ministries concerned.

| # | ID               | Número oficial | Rango        | Date     | Department | Relation type |
| - | ---------------- | -------------- | ------------ | -------- | ---------- | ------------- |
| 1 | BOE-A-1999-11499 | 772/1999       | Real Decreto | 19990507 | Ministerio | SE DESARROLLA |

*Query time: (find: 5.1 ms, blast: 31.9 ms)*

**find**
```cypher
F
```

**blast**
```cypher
B
```
