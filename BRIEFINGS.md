# Council of Ministers — Legislative Briefings

Generated: 2026-06-05 16:19 UTC
Corpus: **12,045 consolidated norms** (9,716 in force) in Neo4j.

---

## Briefing 01 — Diagnosis: which laws have become unreadable?

The **5** in-force laws amended most often by subsequent legislation — the primary candidates for a clean rewrite — are listed below. **Ley 35/2006, de 28 de noviembre, del Impuesto sobre la Rent…** leads with **87 cumulative amendments** from 87 different laws.

| # | ID               | Número oficial | Rango                    | Amendments | By # laws |
| - | ---------------- | -------------- | ------------------------ | ---------- | --------- |
| 1 | BOE-A-2006-20764 | 35/2006        | Ley                      | 87         | 87        |
| 2 | BOE-A-1992-28740 | 37/1992        | Ley                      | 78         | 78        |
| 3 | BOE-A-1993-25359 | 1/1993         | Real Decreto Legislativo | 69         | 69        |
| 4 | BOE-A-2000-323   | 1/2000         | Ley                      | 64         | 64        |
| 5 | BOE-A-1992-28741 | 38/1992        | Ley                      | 57         | 57        |

*Query time: 69.1 ms*

```cypher
// Briefing 1 — Norms most amended by other norms
// Counts incoming AMENDS edges + partial REPEALS edges (article-level derogations).
// Restricted to in-corpus, in-force norms so we surface today's problem laws.
MATCH (src:Norm)-[r]->(n:Norm)
WHERE n.in_corpus = true
  AND n.is_dead   = false
  AND (
        type(r) = 'AMENDS'
    OR (type(r) = 'REPEALS' AND r.is_partial = true)
  )
WITH  n,
      count(r)           AS amendment_count,
      count(DISTINCT src) AS unique_amenders
ORDER BY amendment_count DESC
LIMIT $top_n
RETURN
  n.id             AS id,
  n.titulo         AS titulo,
  n.numero_oficial AS numero_oficial,
  n.rango          AS rango,
  n.fecha_disposicion AS fecha_disposicion,
  amendment_count,
  unique_amenders
```

---

## Briefing 02 — Root cause: who made the mess?

These are the **omnibus laws** — single acts that silently rewrote dozens of unrelated statutes at once. They are the structural cause of the consolidation backlog. **Ley 5/2017, de 28 de marzo, de medidas fiscales, administra…** is the worst offender, touching **282 distinct laws** in 282 amendment actions.

| # | ID               | Número oficial | Rango        | Laws touched | Total actions | Still in force |
| - | ---------------- | -------------- | ------------ | ------------ | ------------- | -------------- |
| 1 | BOE-A-2017-7353  | 5/2017         | Ley          | 282          | 282           | Yes            |
| 2 | BOE-A-2011-9736  | 776/2011       | Real Decreto | 183          | 183           | Yes            |
| 3 | BOE-A-1968-1060  | 2114/1968      | Decreto      | 168          | 168           | Yes            |
| 4 | BOE-A-1990-24442 | 1211/1990      | Real Decreto | 162          | 162           | Yes            |
| 5 | BOE-A-2020-17274 | 1085/2020      | Real Decreto | 133          | 133           | Yes            |

*Query time: 71.3 ms*

```cypher
// Briefing 2 — Omnibus laws: norms that amend the most others
// Counts distinct targets of outgoing AMENDS + REPEALS edges.
// Not filtered by is_dead: historical omnibus laws still caused the mess.
MATCH (n:Norm)-[r]->(target:Norm)
WHERE n.in_corpus = true
  AND type(r) IN ['AMENDS', 'REPEALS']
WITH  n,
      count(r)              AS total_actions,
      count(DISTINCT target) AS unique_targets
ORDER BY unique_targets DESC
LIMIT $top_n
RETURN
  n.id             AS id,
  n.titulo         AS titulo,
  n.numero_oficial AS numero_oficial,
  n.rango          AS rango,
  n.fecha_disposicion AS fecha_disposicion,
  n.is_dead        AS is_dead,
  total_actions,
  unique_targets
```

---

## Briefing 03 — The rot: how much of the statute book rests on dead law?

**17.6% of in-force Spanish law** (1,709 of 9,716 norms) cites at least one repealed norm — operating on legal ground that no longer exists. The dead law most propped up by living statutes is **Ley 30/1992, de 26 de noviembre, de Régimen Jurídico de las…**, still cited by 275 in-force norms.

### Summary
| Metric | Value |
|---|---|
| In-force norms (corpus) | 9,716 |
| Citing ≥1 repealed norm | 1,709 |
| **Share on dead ground** | **17.6%** |

### Top ghost norms

| # | ID               | Número oficial | Rango                    | Repealed | Cited by # live norms |
| - | ---------------- | -------------- | ------------------------ | -------- | --------------------- |
| 1 | BOE-A-1992-26318 | 30/1992        | Ley                      | 20210402 | 275                   |
| 2 | BOE-A-1982-20821 | 10/1982        | Ley Orgánica             | 20181106 | 131                   |
| 3 | BOE-A-1997-7878  | 6/1997         | Ley                      | 20161002 | 83                    |
| 4 | BOE-A-2020-3692  | 463/2020       | Real Decreto             | —        | 69                    |
| 5 | BOE-A-1994-14960 | 1/1994         | Real Decreto Legislativo | 20160102 | 65                    |

*Query time: (part_a: 49.3 ms, part_b: 45.0 ms)*

**part_a**
```cypher
// Briefing 3a — What fraction of in-force law cites dead law?
MATCH (live:Norm)
WHERE live.in_corpus = true AND live.is_dead = false
WITH count(live) AS total_live
MATCH (src:Norm)-[:CITES]->(dead:Norm)
WHERE src.in_corpus = true
  AND src.is_dead   = false
  AND dead.is_dead  = true
WITH total_live, count(DISTINCT src) AS citing_live
RETURN
  total_live,
  citing_live,
  round(toFloat(citing_live) / total_live * 100, 1) AS pct_citing_dead
```

**part_b**
```cypher
// Briefing 3b — Top ghost norms: dead laws most cited by living law
MATCH (live:Norm)-[:CITES]->(dead:Norm)
WHERE live.in_corpus = true
  AND live.is_dead   = false
  AND dead.is_dead   = true
WITH  dead, count(DISTINCT live) AS cited_by_count
ORDER BY cited_by_count DESC
LIMIT $top_n
RETURN
  dead.id              AS id,
  dead.titulo          AS titulo,
  dead.numero_oficial  AS numero_oficial,
  dead.rango           AS rango,
  dead.fecha_derogacion AS fecha_derogacion,
  cited_by_count
```

---

## Briefing 04 — The scalpel: the unfinished repeal

**Target norm:** `BOE-A-1992-26318` — Ley 30/1992, de 26 de noviembre, de Régimen Jurídico de las Administraciones Públicas y d…

**275 in-force norms** still cite **BOE-A-1992-26318** (*Ley 30/1992, de 26 de noviembre, de Régimen Jurídico de las Administr…*), which was repealed in 2015 and superseded by Leyes 39/2015 and 40/2015. Each entry below is a concrete update task for the ministries concerned.

| #   | ID               | Número oficial | Rango                    | Date     | Department                          | Relation type      |
| --- | ---------------- | -------------- | ------------------------ | -------- | ----------------------------------- | ------------------ |
| 1   | BOE-A-1993-5628  | 49/1993        | Real Decreto             | 19930115 | Ministerio de Relaciones con las C… | CITA               |
| 2   | BOE-A-1993-13993 | 2/1993         | Ley Foral                | 19930305 | Comunidad Foral de Navarra          | CITA               |
| 3   | BOE-A-1993-13321 | 630/1993       | Real Decreto             | 19930504 | Ministerio de Economía y Hacienda   | CITA               |
| 4   | BOE-A-1993-13669 | 682/1993       | Real Decreto             | 19930507 | Ministerio de Cultura               | CITA               |
| 5   | BOE-A-1993-13670 | 683/1993       | Real Decreto             | 19930507 | Ministerio de Cultura               | CITA               |
| 6   | BOE-A-1993-13435 | 677/1993       | Real Decreto             | 19930507 | Ministerio de Industria, Comercio … | CITA               |
| 7   | BOE-A-1993-17031 | 853/1993       | Real Decreto             | 19930604 | Ministerio de Relaciones con las C… | CITA               |
| 8   | BOE-A-1993-17028 | —              | Circular                 | 19930609 | Ministerio de Economía y Hacienda   | CITA               |
| 9   | BOE-A-1993-21947 | 8/1993         | Ley                      | 19930622 | Comunidad de Madrid                 | CITA               |
| 10  | BOE-A-1993-29257 | 3/1993         | Ley                      | 19930716 | Comunidad Autónoma de la Región de… | CITA               |
| 11  | BOE-A-1993-20862 | 1392/1993      | Real Decreto             | 19930804 | Ministerio de Economía y Hacienda   | DE CONFORMIDAD con |
| 12  | BOE-A-1993-24317 | 1572/1993      | Real Decreto             | 19930910 | Ministerio de Economía y Hacienda   | DE CONFORMIDAD con |
| 13  | BOE-A-1993-23229 | —              | Orden                    | 19930910 | Ministerio de Justicia              | CITA               |
| 14  | BOE-A-1993-27920 | 8/1993         | Ley                      | 19931019 | Comunidad Autónoma de Andalucía     | CITA               |
| 15  | BOE-A-1994-5709  | 8/1993         | Ley                      | 19931201 | Comunidad Autónoma de las Islas Ba… | CITA               |
| 16  | BOE-A-1994-5710  | 9/1993         | Ley                      | 19931201 | Comunidad Autónoma de las Islas Ba… | CITA               |
| 17  | BOE-A-1993-30466 | 2119/1993      | Real Decreto             | 19931203 | Ministerio de Economía y Hacienda   | DE CONFORMIDAD con |
| 18  | BOE-A-1994-1915  | 3/1993         | Ley                      | 19931209 | Comunidad Valenciana                | CITA               |
| 19  | BOE-A-1994-5714  | 13/1993        | Ley                      | 19931220 | Comunidad Autónoma de las Islas Ba… | CITA               |
| 20  | BOE-A-1994-5713  | 12/1993        | Ley                      | 19931220 | Comunidad Autónoma de las Islas Ba… | CITA               |
| 21  | BOE-A-1993-31153 | 22/1993        | Ley                      | 19931229 | Jefatura del Estado                 | CITA               |
| 22  | BOE-A-1993-31087 | 21/1993        | Ley                      | 19931229 | Jefatura del Estado                 | CITA               |
| 23  | BOE-A-1994-2866  | 6/1994         | Real Decreto             | 19940114 | Ministerio de Comercio y Turismo    | CITA               |
| 24  | BOE-A-1994-10719 | 1/1994         | Ley                      | 19940221 | Comunidad Autónoma del Principado … | CITA               |
| 25  | BOE-A-1994-7653  | 321/1994       | Real Decreto             | 19940225 | Ministerio de Educación y Ciencia   | CITA               |
| 26  | BOE-A-1994-8985  | 320/1994       | Real Decreto             | 19940225 | Ministerio del Interior             | CITA               |
| 27  | BOE-A-1994-5925  | 1/1994         | Ley                      | 19940311 | Jefatura del Estado                 | CITA               |
| 28  | BOE-A-1994-13809 | 2/1994         | Ley                      | 19940428 | Comunidad Autónoma de Extremadura   | CITA               |
| 29  | BOE-A-1994-14039 | 6/1994         | Ley                      | 19940519 | Comunidad de Castilla y León        | CITA               |
| 30  | BOE-A-1994-13633 | —              | Orden                    | 19940520 | Ministerio de Agricultura, Pesca y… | CITA               |
| 31  | BOE-A-1995-3396  | 1/1994         | Ley                      | 19940524 | Comunidad Autónoma de Castilla-La … | CITA               |
| 32  | BOE-A-1994-13801 | 1099/1994      | Real Decreto             | 19940527 | Ministerio de Defensa               | CITA               |
| 33  | BOE-A-1994-12553 | 13/1994        | Ley                      | 19940601 | Jefatura del Estado                 | CITA               |
| 34  | BOE-A-1994-17681 | 1416/1994      | Real Decreto             | 19940625 | Ministerio de Sanidad y Consumo     | CITA               |
| 35  | BOE-A-1994-18777 | 10/1994        | Ley                      | 19940711 | Comunidad Autónoma de Cataluña      | CITA               |
| 36  | BOE-A-1994-18021 | 1728/1994      | Real Decreto             | 19940729 | Ministerio de Defensa               | DE CONFORMIDAD con |
| 37  | BOE-A-1994-23083 | 5/1994         | Ley                      | 19940801 | Comunidad Autónoma de la Región de… | CITA               |
| 38  | BOE-A-1994-19268 | 1772/1994      | Real Decreto             | 19940805 | Ministerio de Justicia e Interior   | DE CONFORMIDAD con |
| 39  | BOE-A-1994-19272 | 1777/1994      | Real Decreto             | 19940805 | Ministerio de la Presidencia        | DE CONFORMIDAD con |
| 40  | BOE-A-1994-19390 | 1768/1994      | Real Decreto             | 19940805 | Ministerio de Economía y Hacienda   | DE CONFORMIDAD con |
| 41  | BOE-A-1994-19130 | 1765/1994      | Real Decreto             | 19940805 | Ministerio de Justicia e Interior   | DE CONFORMIDAD con |
| 42  | BOE-A-1994-19273 | 1778/1994      | Real Decreto             | 19940805 | Ministerio para las Administracion… | DE CONFORMIDAD con |
| 43  | BOE-A-1994-19267 | 1810/1994      | Real Decreto             | 19940805 | Ministerio de Justicia e Interior   | DE CONFORMIDAD con |
| 44  | BOE-A-1994-20934 | 1812/1994      | Real Decreto             | 19940902 | Ministerio de Obras Públicas, Tran… | CITA               |
| 45  | BOE-A-1994-21762 | 1879/1994      | Real Decreto             | 19940916 | Ministerio de Asuntos Exteriores    | CITA               |
| 46  | BOE-A-1995-2731  | 6/1994         | Ley                      | 19941124 | Comunidad Autónoma de Extremadura   | CITA               |
| 47  | BOE-A-1995-608   | 2364/1994      | Real Decreto             | 19941209 | Ministerio de Justicia e Interior   | CITA               |
| 48  | BOE-A-1995-9734  | 6/1994         | Ley                      | 19941213 | Comunidad Autónoma de las Islas Ba… | CITA               |
| 49  | BOE-A-1995-1741  | 2487/1994      | Real Decreto             | 19941223 | Ministerio de Industria y Energía   | CITA               |
| 50  | BOE-A-1995-3325  | 11/1994        | Ley                      | 19941227 | Comunidad Valenciana                | CITA               |
| 51  | BOE-A-1995-8733  | 15/1994        | Ley                      | 19941228 | Comunidad de Madrid                 | CITA               |
| 52  | BOE-A-1995-3326  | 12/1994        | Ley                      | 19941228 | Comunidad Valenciana                | CITA               |
| 53  | BOE-A-1995-3553  | 2551/1994      | Real Decreto             | 19941229 | Ministerio de la Presidencia        | CITA               |
| 54  | BOE-A-1994-28967 | 41/1994        | Ley                      | 19941230 | Jefatura del Estado                 | CITA               |
| 55  | BOE-A-1994-28968 | 42/1994        | Ley                      | 19941230 | Jefatura del Estado                 | CITA               |
| 56  | BOE-A-1994-28964 | 38/1994        | Ley                      | 19941230 | Jefatura del Estado                 | CITA               |
| 57  | BOE-A-1995-14602 | 1/1995         | Ley                      | 19950102 | Comunidad Autónoma de Galicia       | CITA               |
| 58  | BOE-A-1995-6500  | 2/1995         | Ley                      | 19950130 | Comunidad Autónoma de Canarias      | CITA               |
| 59  | BOE-A-1995-5542  | 203/1995       | Real Decreto             | 19950210 | Ministerio de la Presidencia        | CITA               |
| 60  | BOE-A-1995-5917  | 243/1995       | Real Decreto             | 19950217 | Ministerio de Economía y Hacienda   | CITA               |
| 61  | BOE-A-1995-8877  | 294/1995       | Real Decreto             | 19950224 | Ministerio de Sanidad y Consumo     | CITA               |
| 62  | BOE-A-1995-6058  | 278/1995       | Real Decreto             | 19950224 | Ministerio de la Presidencia        | CITA               |
| 63  | BOE-A-1995-11843 | 2/1995         | Ley                      | 19950308 | Comunidad de Madrid                 | CITA               |
| 64  | BOE-A-1995-8730  | 365/1995       | Real Decreto             | 19950310 | Ministerio para las Administracion… | CITA               |
| 65  | BOE-A-1995-10633 | 2/1995         | Ley                      | 19950313 | Comunidad Autónoma del Principado … | CITA               |
| 66  | BOE-A-1995-13296 | 2/1995         | Ley                      | 19950315 | Comunidad Autónoma de la Región de… | CITA               |
| 67  | BOE-A-1995-10634 | 3/1995         | Ley                      | 19950315 | Comunidad Autónoma del Principado … | CITA               |
| 68  | BOE-A-1995-8876  | 410/1995       | Real Decreto             | 19950317 | Ministerio de Cultura               | CITA               |
| 69  | BOE-A-1995-7241  | 3/1995         | Ley                      | 19950323 | Jefatura del Estado                 | CITA               |
| 70  | BOE-A-1995-18784 | 9/1995         | Ley                      | 19950328 | Comunidad de Madrid                 | CITA               |
| 71  | BOE-A-1995-11842 | 8/1995         | Ley                      | 19950330 | Comunidad Autónoma de las Islas Ba… | CITA               |
| 72  | BOE-A-1995-15188 | 5/1995         | Ley                      | 19950406 | Comunidad Autónoma del Principado … | CITA               |
| 73  | BOE-A-1995-12743 | 2/1995         | Ley                      | 19950406 | Comunidad Autónoma de Extremadura   | CITA               |
| 74  | BOE-A-1995-12102 | 7/1995         | Ley                      | 19950406 | Comunidad Autónoma de Canarias      | CITA               |
| 75  | BOE-A-1995-17372 | 14/1995        | Ley                      | 19950421 | Comunidad de Madrid                 | CITA               |
| 76  | BOE-A-1995-15454 | 7/1995         | Ley                      | 19950427 | Comunidad Autónoma de Extremadura   | CITA               |
| 77  | BOE-A-1995-13291 | 732/1995       | Real Decreto             | 19950505 | Ministerio de Educación y Ciencia   | CITA               |
| 78  | BOE-A-1995-13292 | 733/1995       | Real Decreto             | 19950505 | Ministerio de Educación y Ciencia   | CITA               |
| 79  | BOE-A-1995-15071 | 828/1995       | Real Decreto             | 19950529 | Ministerio de Economía y Hacienda   | CITA               |
| 80  | BOE-A-1995-12915 | 16/1995        | Ley                      | 19950530 | Jefatura del Estado                 | CITA               |
| 81  | BOE-A-1995-16750 | 1050/1995      | Real Decreto             | 19950623 | Ministerio de Economía y Hacienda   | CITA               |
| 82  | BOE-A-1995-16257 | 19/1995        | Ley                      | 19950704 | Jefatura del Estado                 | CITA               |
| 83  | BOE-A-1995-19848 | 1300/1995      | Real Decreto             | 19950721 | Ministerio de la Presidencia        | CITA               |
| 84  | BOE-A-1995-22322 | 1556/1995      | Real Decreto             | 19950921 | Ministerio de Justicia e Interior   | CITA               |
| 85  | BOE-A-1995-22239 | —              | Orden                    | 19951004 | Ministerio de Cultura               | CITA               |
| 86  | BOE-A-1995-24265 | 1693/1995      | Real Decreto             | 19951020 | Ministerio de Educación y Ciencia   | CITA               |
| 87  | BOE-A-1995-24005 | 1799/1995      | Real Decreto             | 19951103 | Ministerio de Agricultura, Pesca y… | CITA               |
| 88  | BOE-A-1995-24292 | 31/1995        | Ley                      | 19951108 | Jefatura del Estado                 | CITA               |
| 89  | BOE-A-1995-24262 | 30/1995        | Ley                      | 19951108 | Jefatura del Estado                 | CITA               |
| 90  | BOE-A-1995-25204 | 33/1995        | Ley                      | 19951120 | Jefatura del Estado                 | CITA               |
| 91  | BOE-A-1995-26896 | 1907/1995      | Real Decreto             | 19951124 | Ministerio de la Presidencia        | CITA               |
| 92  | BOE-A-1995-27264 | 1953/1995      | Real Decreto             | 19951201 | Ministerio de la Presidencia        | CITA               |
| 93  | BOE-A-1995-26716 | 1993/1995      | Real Decreto             | 19951207 | Ministerio de Trabajo y Seguridad … | CITA               |
| 94  | BOE-A-1995-26714 | 35/1995        | Ley                      | 19951211 | Jefatura del Estado                 | CITA               |
| 95  | BOE-A-1995-26836 | 12/1995        | Ley Orgánica             | 19951212 | Jefatura del Estado                 | CITA               |
| 96  | BOE-A-1996-1579  | 2064/1995      | Real Decreto             | 19951222 | Ministerio de Trabajo y Seguridad … | CITA               |
| 97  | BOE-A-1996-2468  | 2200/1995      | Real Decreto             | 19951228 | Ministerio de Industria y Energía   | CITA               |
| 98  | BOE-A-1995-27965 | 2187/1995      | Real Decreto             | 19951228 | Ministerio de Economía y Hacienda   | CITA               |
| 99  | BOE-A-1996-5847  | 8/1995         | Ley                      | 19951229 | Comunidad Valenciana                | CITA               |
| 100 | BOE-A-1996-1866  | 6/1995         | Ley                      | 19951229 | Comunidad Autónoma de Andalucía     | CITA               |
| 101 | BOE-A-1996-754   | 5/1996         | Ley                      | 19960110 | Jefatura del Estado                 | CITA               |
| 102 | BOE-A-1996-750   | 1/1996         | Ley                      | 19960110 | Jefatura del Estado                 | CITA               |
| 103 | BOE-A-1996-2545  | 9/1996         | Real Decreto             | 19960115 | Ministerio de Sanidad y Consumo     | CITA               |
| 104 | BOE-A-1996-3064  | —              | Orden                    | 19960118 | Ministerio de Sanidad y Consumo     | CITA               |
| 105 | BOE-A-1996-1644  | —              | Orden                    | 19960118 | Ministerio de Trabajo y Seguridad … | CITA               |
| 106 | BOE-A-1996-2989  | 40/1996        | Real Decreto             | 19960119 | Ministerio de Economía y Hacienda   | CITA               |
| 107 | BOE-A-1996-4447  | 84/1996        | Real Decreto             | 19960126 | Ministerio de Trabajo y Seguridad … | CITA               |
| 108 | BOE-A-1996-2627  | —              | Orden                    | 19960201 | Ministerio de Economía y Hacienda   | CITA               |
| 109 | BOE-A-1996-3691  | 148/1996       | Real Decreto             | 19960205 | Ministerio de Trabajo y Seguridad … | CITA               |
| 110 | BOE-A-1996-4997  | 208/1996       | Real Decreto             | 19960209 | Ministerio para las Administracion… | DE CONFORMIDAD con |
| 111 | BOE-A-1996-3307  | 190/1996       | Real Decreto             | 19960209 | Ministerio de Justicia e Interior   | CITA               |
| 112 | BOE-A-1996-4716  | 249/1996       | Real Decreto             | 19960216 | Ministerio de Justicia e Interior   | CITA               |
| 113 | BOE-A-1996-4581  | —              | Orden                    | 19960222 | Ministerio de Trabajo y Seguridad … | CITA               |
| 114 | BOE-A-1996-5413  | —              | Resolución               | 19960226 | Ministerio de Educación y Ciencia   | DE CONFORMIDAD con |
| 115 | BOE-A-1996-7391  | 397/1996       | Real Decreto             | 19960301 | Ministerio de Trabajo y Seguridad … | CITA               |
| 116 | BOE-A-1996-5099  | 415/1996       | Real Decreto             | 19960301 | Ministerio de Asuntos Sociales      | CITA               |
| 117 | BOE-A-1996-6171  | 393/1996       | Real Decreto             | 19960301 | Ministerio de Obras Públicas, Tran… | CITA               |
| 118 | BOE-A-1996-10313 | 1/1996         | Ley                      | 19960305 | Comunidad Autónoma de Galicia       | CITA               |
| 119 | BOE-A-1996-7820  | —              | Orden                    | 19960402 | Ministerio de Educación y Ciencia   | CITA               |
| 120 | BOE-A-1996-8930  | 1/1996         | Real Decreto Legislativo | 19960412 | Ministerio de Cultura               | CITA               |
| 121 | BOE-A-1996-10881 | —              | Orden                    | 19960425 | Ministerio de Justicia e Interior   | CITA               |
| 122 | BOE-A-1996-11543 | 693/1996       | Real Decreto             | 19960426 | Ministerio de Educación y Ciencia   | CITA               |
| 123 | BOE-A-1996-11379 | —              | Resolución               | 19960507 | Ministerio de Trabajo y Asuntos So… | CITA               |
| 124 | BOE-A-1996-14650 | 2/1996         | Ley                      | 19960508 | Comunidad Autónoma de Galicia       | CITA               |
| 125 | BOE-A-1996-21848 | 2/1996         | Ley                      | 19960516 | Comunidad Autónoma de la Región de… | CITA               |
| 126 | BOE-A-1996-21849 | 3/1996         | Ley                      | 19960516 | Comunidad Autónoma de la Región de… | CITA               |
| 127 | BOE-A-1996-13286 | 4/1996         | Ley                      | 19960522 | Comunidad Autónoma de Aragón        | CITA               |
| 128 | BOE-A-1996-21850 | 4/1996         | Ley                      | 19960614 | Comunidad Autónoma de la Región de… | CITA               |
| 129 | BOE-A-1996-26265 | 4/1996         | Ley                      | 19960701 | Comunidad de Madrid                 | CITA               |
| 130 | BOE-A-1996-19261 | 6/1996         | Ley                      | 19960709 | Comunidad Autónoma de Galicia       | CITA               |
| 131 | BOE-A-1996-18007 | 3/1996         | Ley                      | 19960711 | Comunidad Autónoma de Canarias      | CITA               |
| 132 | BOE-A-1996-21311 | 2066/1996      | Real Decreto             | 19960913 | Ministerio de Fomento               | CITA               |
| 133 | BOE-A-1997-1256  | 19/1996        | Ley Foral                | 19961104 | Comunidad Foral de Navarra          | CITA               |
| 134 | BOE-A-1996-25833 | 2345/1996      | Real Decreto             | 19961108 | Ministerio de Economía y Hacienda   | CITA               |
| 135 | BOE-A-1997-3983  | 2/1996         | Ley                      | 19961119 | Comunidad Autónoma de las Islas Ba… | CITA               |
| 136 | BOE-A-1997-304   | 16/1996        | Ley                      | 19961127 | Comunidad Autónoma de Cataluña      | CITA               |
| 137 | BOE-A-1997-86    | 2583/1996      | Real Decreto             | 19961213 | Ministerio de Administraciones Púb… | CITA               |
| 138 | BOE-A-1997-4272  | 5/1996         | Ley                      | 19961217 | Comunidad Autónoma de Cantabria     | CITA               |
| 139 | BOE-A-1997-6620  | 11/1996        | Ley                      | 19961219 | Comunidad de Madrid                 | CITA               |
| 140 | BOE-A-1997-2827  | 8/1996         | Ley                      | 19961227 | Comunidad de Castilla y León        | CITA               |
| 141 | BOE-A-1997-18549 | 1/1997         | Ley                      | 19970108 | Comunidad de Madrid                 | CITA               |
| 142 | BOE-A-1997-1287  | —              | Orden                    | 19970109 | Ministerio de Trabajo y Asuntos So… | CITA               |
| 143 | BOE-A-1997-1853  | 39/1997        | Real Decreto             | 19970117 | Ministerio de Trabajo y Asuntos So… | CITA               |
| 144 | BOE-A-1997-1957  | 136/1997       | Real Decreto             | 19970131 | Ministerio de Fomento               | CITA               |
| 145 | BOE-A-1997-2514  | —              | Resolución               | 19970203 | Ministerio de Justicia              | CITA               |
| 146 | BOE-A-1997-5789  | 251/1997       | Real Decreto             | 19970221 | Ministerio de Industria y Energía   | CITA               |
| 147 | BOE-A-1997-5630  | 2/1997         | Ley                      | 19970313 | Jefatura del Estado                 | DE CONFORMIDAD con |
| 148 | BOE-A-1997-12054 | 1/1997         | Ley                      | 19970404 | Comunidad Autónoma del Principado … | CITA               |
| 149 | BOE-A-1997-7699  | —              | Orden                    | 19970409 | Ministerio de Fomento               | CITA               |
| 150 | BOE-A-1997-8204  | 489/1997       | Real Decreto             | 19970414 | Ministerio de la Presidencia        | CITA               |
| 151 | BOE-A-1997-9874  | 577/1997       | Real Decreto             | 19970418 | Ministerio de Administraciones Púb… | CITA               |
| 152 | BOE-A-1997-9336  | —              | Orden                    | 19970424 | Ministerio de la Presidencia        | CITA               |
| 153 | BOE-A-1997-14412 | 5/1997         | Ley                      | 19970424 | Comunidad de Castilla y León        | CITA               |
| 154 | BOE-A-1997-9022  | 16/1997        | Ley                      | 19970425 | Jefatura del Estado                 | CITA               |
| 155 | BOE-A-1997-11538 | 3/1997         | Ley                      | 19970508 | Comunidad Autónoma de Canarias      | CITA               |
| 156 | BOE-A-1997-10333 | 663/1997       | Real Decreto             | 19970512 | Ministerio de la Presidencia        | CITA               |
| 157 | BOE-A-1997-11825 | 705/1997       | Real Decreto             | 19970516 | Ministerio de Agricultura, Pesca y… | CITA               |
| 158 | BOE-A-1997-11411 | 706/1997       | Real Decreto             | 19970516 | Ministerio de la Presidencia        | CITA               |
| 159 | BOE-A-1997-11304 | 738/1997       | Real Decreto             | 19970523 | Ministerio de la Presidencia        | CITA               |
| 160 | BOE-A-1997-12854 | 775/1997       | Real Decreto             | 19970530 | Ministerio de la Presidencia        | CITA               |
| 161 | BOE-A-1997-21861 | 2/1997         | Ley                      | 19970530 | Comunidad Autónoma de Castilla-La … | CITA               |
| 162 | BOE-A-1997-12736 | 774/1997       | Real Decreto             | 19970530 | Ministerio de la Presidencia        | CITA               |
| 163 | BOE-A-1998-7942  | 12/1997        | Ley                      | 19970604 | Comunidad de Madrid                 | CITA               |
| 164 | BOE-A-1997-12508 | 864/1997       | Real Decreto             | 19970606 | Ministerio de la Presidencia        | CITA               |
| 165 | BOE-A-1997-19021 | 11/1997        | Ley Foral                | 19970627 | Comunidad Foral de Navarra          | CITA               |
| 166 | BOE-A-1998-9648  | 17/1997        | Ley                      | 19970704 | Comunidad de Madrid                 | CITA               |
| 167 | BOE-A-1997-17140 | 6/1997         | Ley                      | 19970704 | Comunidad Autónoma de Canarias      | CITA               |
| 168 | BOE-A-1997-16893 | 8/1997         | Ley                      | 19970708 | Comunidad de Castilla y León        | CITA               |
| 169 | BOE-A-1997-18197 | 6/1997         | Ley                      | 19970708 | Comunidad Autónoma de las Islas Ba… | CITA               |
| 170 | BOE-A-1997-21911 | 4/1997         | Ley                      | 19970710 | Comunidad Autónoma de Castilla-La … | CITA               |
| 171 | BOE-A-1997-17133 | 1134/1997      | Real Decreto             | 19970711 | Ministerio de Economía y Hacienda   | CITA               |
| 172 | BOE-A-1997-19436 | 2/1997         | Ley                      | 19970716 | Comunidad Autónoma del Principado … | CITA               |
| 173 | BOE-A-1997-16981 | —              | Orden                    | 19970718 | Ministerio de Trabajo y Asuntos So… | CITA               |
| 174 | BOE-A-1997-16372 | 1214/1997      | Real Decreto             | 19970718 | Ministerio de la Presidencia        | CITA               |
| 175 | BOE-A-1997-21040 | 5/1997         | Ley                      | 19970722 | Comunidad Autónoma de Galicia       | CITA               |
| 176 | BOE-A-1997-25351 | 4/1997         | Ley                      | 19970724 | Comunidad Autónoma de la Región de… | CITA               |
| 177 | BOE-A-1997-17826 | 1269/1997      | Real Decreto             | 19970724 | Ministerio de la Presidencia        | CITA               |
| 178 | BOE-A-1997-20259 | 1424/1997      | Real Decreto             | 19970915 | Ministerio de Defensa               | CITA               |
| 179 | BOE-A-1998-3168  | 5/1997         | Ley                      | 19971013 | Comunidad Autónoma de la Región de… | CITA               |
| 180 | BOE-A-1997-23067 | 1599/1997      | Real Decreto             | 19971017 | Ministerio de Sanidad y Consumo     | CITA               |
| 181 | BOE-A-1997-24104 | 1644/1997      | Real Decreto             | 19971031 | Ministerio de Economía y Hacienda   | CITA               |
| 182 | BOE-A-1997-24617 | 1684/1997      | Real Decreto             | 19971107 | Ministerio de la Presidencia        | CITA               |
| 183 | BOE-A-1997-25340 | 54/1997        | Ley                      | 19971127 | Jefatura del Estado                 | CITA               |
| 184 | BOE-A-1998-1461  | 11/1997        | Ley                      | 19971202 | Comunidad Autónoma de Canarias      | CITA               |
| 185 | BOE-A-1998-1457  | —              | Orden                    | 19971216 | Ministerio de Fomento               | CITA               |
| 186 | BOE-A-1998-1685  | 8/1997         | Ley                      | 19971218 | Comunidad Autónoma de las Islas Ba… | CITA               |
| 187 | BOE-A-1998-2987  | 14/1997        | Ley                      | 19971224 | Comunidad Autónoma de Cataluña      | CITA               |
| 188 | BOE-A-1998-8203  | 14/1997        | Ley                      | 19971226 | Comunidad Valenciana                | CITA               |
| 189 | BOE-A-1998-15064 | 25/1997        | Ley                      | 19971226 | Comunidad de Madrid                 | CITA               |
| 190 | BOE-A-1998-2747  | 7/1997         | Ley                      | 19971230 | Comunidad Autónoma de Cantabria     | CITA               |
| 191 | BOE-A-1998-5831  | 1/1998         | Ley                      | 19980216 | Comunidad Autónoma de Aragón        | CITA               |
| 192 | BOE-A-1998-3823  | 176/1998       | Real Decreto             | 19980216 | Ministerio de la Presidencia        | CITA               |
| 193 | BOE-A-1998-4769  | 1/1998         | Real Decreto-ley         | 19980227 | Jefatura del Estado                 | CITA               |
| 194 | BOE-A-1998-6697  | 389/1998       | Real Decreto             | 19980313 | Ministerio de la Presidencia        | CITA               |
| 195 | BOE-A-1998-19870 | 4/1998         | Ley                      | 19980408 | Comunidad de Madrid                 | CITA               |
| 196 | BOE-A-1998-9963  | 618/1998       | Real Decreto             | 19980417 | Ministerio de la Presidencia        | CITA               |
| 197 | BOE-A-1998-10407 | 13/1998        | Ley                      | 19980504 | Jefatura del Estado                 | CITA               |
| 198 | BOE-A-1998-12816 | 928/1998       | Real Decreto             | 19980514 | Ministerio de Trabajo y Asuntos So… | CITA               |
| 199 | BOE-A-1998-12017 | 991/1998       | Real Decreto             | 19980522 | Ministerio de la Presidencia        | CITA               |
| 200 | BOE-A-1998-20646 | 6/1998         | Ley                      | 19980528 | Comunidad de Madrid                 | CITA               |
| 201 | BOE-A-1998-13082 | 1062/1998      | Real Decreto             | 19980529 | Ministerio de la Presidencia        | CITA               |
| 202 | BOE-A-1998-13841 | —              | Orden                    | 19980610 | Ministerio de Agricultura, Pesca y… | CITA               |
| 203 | BOE-A-1998-18720 | 2/1998         | Ley                      | 19980615 | Comunidad Autónoma de Andalucía     | CITA               |
| 204 | BOE-A-1998-20648 | 8/1998         | Ley                      | 19980615 | Comunidad de Madrid                 | CITA               |
| 205 | BOE-A-1998-17351 | 6/1998         | Ley                      | 19980622 | Comunidad Valenciana                | CITA               |
| 206 | BOE-A-1998-20056 | 3/1998         | Ley                      | 19980624 | Comunidad de Castilla y León        | CITA               |
| 207 | BOE-A-1998-23234 | 2/1998         | Decreto Legislativo      | 19980625 | Comunidad Autónoma del Principado … | CITA               |
| 208 | BOE-A-1998-20256 | 8/1998         | Ley                      | 19980626 | Comunidad Autónoma de Extremadura   | CITA               |
| 209 | BOE-A-1998-16696 | —              | Orden                    | 19980702 | Ministerio de Administraciones Púb… | CITA               |
| 210 | BOE-A-1998-17041 | 1424/1998      | Real Decreto             | 19980703 | Ministerio de Educación y Cultura   | CITA               |
| 211 | BOE-A-1998-20651 | 11/1998        | Ley                      | 19980709 | Comunidad de Madrid                 | CITA               |
| 212 | BOE-A-1998-16716 | 27/1998        | Ley                      | 19980713 | Jefatura del Estado                 | CITA               |
| 213 | BOE-A-1998-16714 | 25/1998        | Ley                      | 19980713 | Jefatura del Estado                 | CITA               |
| 214 | BOE-A-1998-19358 | 1664/1998      | Real Decreto             | 19980724 | Ministerio de Medio Ambiente        | CITA               |
| 215 | BOE-A-1998-21017 | 1649/1998      | Real Decreto             | 19980724 | Ministerio de Economía y Hacienda   | CITA               |
| 216 | BOE-A-1998-18559 | 1733/1998      | Real Decreto             | 19980731 | Ministerio de Economía y Hacienda   | CITA               |
| 217 | BOE-A-1998-20604 | 1753/1998      | Real Decreto             | 19980731 | Ministerio de la Presidencia        | CITA               |
| 218 | BOE-A-1998-20762 | 1760/1998      | Real Decreto             | 19980731 | Ministerio de Medio Ambiente        | CITA               |
| 219 | BOE-A-1998-21615 | 1823/1998      | Real Decreto             | 19980828 | Ministerio de Industria y Energía   | CITA               |
| 220 | BOE-A-1998-23789 | 2114/1998      | Real Decreto             | 19981002 | Ministerio de la Presidencia        | CITA               |
| 221 | BOE-A-1998-23945 | 2110/1998      | Real Decreto             | 19981002 | Ministerio del Interior             | CITA               |
| 222 | BOE-A-1998-23284 | 34/1998        | Ley                      | 19981007 | Jefatura del Estado                 | CITA               |
| 223 | BOE-A-1998-23878 | —              | Orden                    | 19981008 | Ministerio del Interior             | CITA               |
| 224 | BOE-A-1998-26802 | 2396/1998      | Real Decreto             | 19981106 | Ministerio de Asuntos Exteriores    | CITA               |
| 225 | BOE-A-1998-27046 | 2451/1998      | Real Decreto             | 19981113 | Ministerio de Economía y Hacienda   | CITA               |
| 226 | BOE-A-1998-26345 | 37/1998        | Ley                      | 19981116 | Jefatura del Estado                 | CITA               |
| 227 | BOE-A-1998-27047 | 2486/1998      | Real Decreto             | 19981120 | Ministerio de Economía y Hacienda   | CITA               |
| 228 | BOE-A-1998-27709 | 2490/1998      | Real Decreto             | 19981120 | Ministerio de la Presidencia        | CITA               |
| 229 | BOE-A-1998-27865 | —              | Orden                    | 19981124 | Ministerio de Economía y Hacienda   | CITA               |
| 230 | BOE-A-1999-10240 | 670/1999       | Real Decreto             | 19990423 | Ministerio de Administraciones Púb… | DE CONFORMIDAD con |
| 231 | BOE-A-1999-19277 | 1465/1999      | Real Decreto             | 19990917 | Ministerio de Administraciones Púb… | CITA               |
| 232 | BOE-A-2000-1009  | 13/1999        | Ley                      | 19991215 | Comunidad Autónoma de Andalucía     | CITA               |
| 233 | BOE-A-2000-16417 | —              | Acuerdo                  | 20000726 | Consejo General del Poder Judicial  | CITA               |
| 234 | BOE-A-2001-21090 | 4/2001         | Ley Orgánica             | 20011112 | Jefatura del Estado                 | CITA               |
| 235 | BOE-A-2002-7297  | 1/2002         | Ley                      | 20020228 | Comunidad Autónoma de Extremadura   | CITA               |
| 236 | BOE-A-2002-24154 | 1217/2002      | Real Decreto             | 20021122 | Ministerio de Fomento               | DE CONFORMIDAD con |
| 237 | BOE-A-2003-3398  | 1424/2002      | Real Decreto             | 20021227 | Ministerio de Trabajo y Asuntos So… | DE CONFORMIDAD con |
| 238 | BOE-A-2003-4151  | 209/2003       | Real Decreto             | 20030221 | Ministerio de la Presidencia        | DE CONFORMIDAD con |
| 239 | BOE-A-2003-7073  | 286/2003       | Real Decreto             | 20030307 | Ministerio de Trabajo y Asuntos So… | DE CONFORMIDAD con |
| 240 | BOE-A-2003-20977 | 38/2003        | Ley                      | 20031117 | Jefatura del Estado                 | CITA               |
| 241 | BOE-A-2004-5224  | HAC/725/2004   | Orden                    | 20040312 | Ministerio de Hacienda              | DE CONFORMIDAD con |
| 242 | BOE-A-2004-8870  | 600/38077/2004 | Resolución               | 20040326 | Ministerio de Defensa               | DE CONFORMIDAD con |
| 243 | BOE-A-2004-15331 | TAS/2839/2004  | Orden                    | 20040729 | Ministerio de Trabajo y Asuntos So… | CITA               |
| 244 | BOE-A-2005-6098  | INT/985/2005   | Orden                    | 20050407 | Ministerio del Interior             | DE CONFORMIDAD con |
| 245 | BOE-A-2005-10825 | 760/2005       | Real Decreto             | 20050624 | Ministerio de Cultura               | CITA               |
| 246 | BOE-A-2005-12178 | 799/2005       | Real Decreto             | 20050701 | Ministerio de Administraciones Púb… | CITA               |
| 247 | BOE-A-2005-14836 | 951/2005       | Real Decreto             | 20050729 | Ministerio de Administraciones Púb… | DE CONFORMIDAD con |
| 248 | BOE-A-2006-8149  | 523/2006       | Real Decreto             | 20060428 | Ministerio de la Presidencia        | DE CONFORMIDAD con |
| 249 | BOE-A-2006-8148  | 522/2006       | Real Decreto             | 20060428 | Ministerio de la Presidencia        | DE CONFORMIDAD con |
| 250 | BOE-A-2006-19411 | 1267/2006      | Real Decreto             | 20061108 | Ministerio de Cultura               | CITA               |
| 251 | BOE-A-2007-2297  | 126/2007       | Real Decreto             | 20070202 | Ministerio de Medio Ambiente        | CITA               |
| 252 | BOE-A-2008-12493 | 3/2007         | Ley                      | 20070316 | Comunidad Autónoma de la Región de… | CITA               |
| 253 | BOE-A-2007-11514 | EHA/1670/2007  | Orden                    | 20070508 | Ministerio de Economía y Hacienda   | DE CONFORMIDAD con |
| 254 | BOE-A-2007-11515 | —              | Resolución               | 20070604 | Ministerio de Economía y Hacienda   | DE CONFORMIDAD con |
| 255 | BOE-A-2007-13685 | 2/2007         | Ley                      | 20070605 | Comunidad Autónoma de Cataluña      | CITA               |
| 256 | BOE-A-2007-17281 | 1262/2007      | Real Decreto             | 20070921 | Ministerio de la Presidencia        | CITA               |
| 257 | BOE-A-2007-19248 | 1401/2007      | Real Decreto             | 20071029 | Ministerio de la Presidencia        | CITA               |
| 258 | BOE-A-2007-19814 | 37/2007        | Ley                      | 20071116 | Jefatura del Estado                 | CITA               |
| 259 | BOE-A-2007-21492 | 44/2007        | Ley                      | 20071213 | Jefatura del Estado                 | CITA               |
| 260 | BOE-A-2008-1629  | —              | Resolución               | 20071220 | Ministerio de Industria, Turismo y… | CITA               |
| 261 | BOE-A-2008-18494 | 1791/2008      | Real Decreto             | 20081103 | Ministerio de Justicia              | CITA               |
| 262 | BOE-A-2008-18413 | 1803/2008      | Real Decreto             | 20081103 | Ministerio de la Presidencia        | CITA               |
| 263 | BOE-A-2008-17967 | INT/3191/2008  | Orden                    | 20081104 | Ministerio del Interior             | CITA               |
| 264 | BOE-A-2010-3034  | 137/2010       | Real Decreto             | 20100212 | Ministerio de la Presidencia        | DE CONFORMIDAD con |
| 265 | BOE-A-2010-13313 | 26/2010        | Ley                      | 20100803 | Comunidad Autónoma de Cataluña      | DE CONFORMIDAD con |
| 266 | BOE-A-2010-15790 | 7/2010         | Ley                      | 20100929 | Comunidad Autónoma de La Rioja      | DE CONFORMIDAD con |
| 267 | BOE-A-2010-19958 | 1613/2010      | Real Decreto             | 20101207 | Ministerio de Trabajo e Inmigración | CITA               |
| 268 | BOE-A-2011-20269 | —              | Resolución               | 20111216 | Ministerio de Economía y Hacienda   | DE CONFORMIDAD con |
| 269 | BOE-A-2012-8373  | —              | Resolución               | 20120405 | Ministerio de Industria, Energía y… | DE CONFORMIDAD con |
| 270 | BOE-A-2012-8346  | HAP/1335/2012  | Orden                    | 20120614 | Ministerio de Hacienda y Administr… | DE CONFORMIDAD con |
| 271 | BOE-A-2012-10552 | AAA/1745/2012  | Orden                    | 20120726 | Ministerio de Agricultura, Aliment… | DE CONFORMIDAD con |
| 272 | BOE-A-2013-2379  | —              | Resolución               | 20130225 | Ministerio de Hacienda y Administr… | DE CONFORMIDAD con |
| 273 | BOE-A-2014-1937  | DEF/244/2014   | Orden                    | 20140210 | Ministerio de Defensa               | CITA               |
| 274 | BOE-A-2015-8829  | —              | Resolución               | 20150727 | Ministerio de Hacienda y Administr… | DE CONFORMIDAD con |
| 275 | BOE-A-2016-3     | 1113/2015      | Real Decreto             | 20151211 | Ministerio de Sanidad, Servicios S… | CITA               |

*Query time: (find: 10.4 ms, blast: 31.2 ms)*

**find**
```cypher
// Briefing 4 — Locate Ley 30/1992 by numero_oficial + rango
MATCH (n:Norm)
WHERE n.numero_oficial = $numero_oficial
  AND n.rango          = $rango
  AND n.in_corpus      = true
RETURN n.id AS id, n.titulo AS titulo
LIMIT 1
```

**blast**
```cypher
// Briefing 4 — In-force norms that still cite Ley 30/1992 directly
// "Cite" covers CITES edges (codes 330 CITA, 440 DE CONFORMIDAD,
//  490 SE DESARROLLA, 331 SE DICTA EN RELACIÓN).
MATCH (live:Norm)-[r:CITES]->(ley30:Norm {id: $ley30_id})
WHERE live.in_corpus = true
  AND live.is_dead   = false
RETURN
  live.id             AS id,
  live.titulo         AS titulo,
  live.numero_oficial AS numero_oficial,
  live.rango          AS rango,
  live.fecha_disposicion AS fecha_disposicion,
  live.departamento   AS departamento,
  r.relacion_texto    AS relacion_tipo,
  r.detail            AS detail
ORDER BY live.fecha_disposicion
```
