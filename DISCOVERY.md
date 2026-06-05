# BOE API Discovery

Explored 2026-06-04. All findings verified against live API calls.

---

## 1. Enumerating Every Norm in `legislacion-consolidada`

### Endpoint

```
GET https://boe.es/datosabiertos/api/legislacion-consolidada
Accept: application/json        ← REQUIRED (see §5 Quirks)
```

### Parameters

| Param  | Default | Notes |
|--------|---------|-------|
| `offset` | 0 | Zero-based cursor |
| `limit` | 50 | Use `-1` to get **the entire corpus in one call** |
| `from` | oldest | ISO 8601 date (AAAAMMDD) — filters by `fecha_actualizacion` |
| `to` | today | ISO 8601 date (AAAAMMDD) |
| `query` | — | JSON query string with `query_string`, `range`, `sort` |

### Full-dump call (confirmed working)

```bash
curl -X GET -H "Accept: application/json" \
  "https://boe.es/datosabiertos/api/legislacion-consolidada?limit=-1"
```

Results are ordered by `fecha_actualizacion` DESC by default. No `total_count` field is returned — the list is simply the full array.

### Fields returned per norm in the list

`fecha_actualizacion`, `identificador`, `ambito`, `departamento`, `rango`,
`fecha_disposicion`, `numero_oficial`, `titulo`, `diario`, `fecha_publicacion`,
`diario_numero`, `fecha_vigencia`, `vigencia_agotada`, `estado_consolidacion`,
`url_eli`, `url_html_consolidada`

**Critically absent from the list:** `estatus_derogacion`, `estatus_anulacion`, `fecha_derogacion` — these only appear in the `/metadatos` sub-endpoint.

---

## 2. JSON Shape of a Single Norm

### Metadatos (`/id/{id}/metadatos`)

```json
{
  "status": {"code": "200", "text": "ok"},
  "data": [{
    "fecha_actualizacion": "20251217T193413Z",
    "identificador": "BOE-A-1992-26318",
    "ambito": {"codigo": "1", "texto": "Estatal"},
    "departamento": {"codigo": "7723", "texto": "Jefatura del Estado"},
    "rango": {"codigo": "1300", "texto": "Ley"},
    "fecha_disposicion": "19921126",
    "numero_oficial": "30/1992",
    "titulo": "Ley 30/1992 ...",
    "diario": "Boletín Oficial del Estado",
    "fecha_publicacion": "19921127",
    "diario_numero": "285",
    "fecha_vigencia": "19930227",
    "estatus_derogacion": "S",
    "fecha_derogacion": "20210402",
    "estatus_anulacion": "N",
    "vigencia_agotada": "S",
    "estado_consolidacion": {"codigo": "3", "texto": "Finalizado"},
    "url_eli": "https://www.boe.es/eli/es/l/1992/11/26/30",
    "url_html_consolidada": "https://www.boe.es/buscar/act.php?id=BOE-A-1992-26318"
  }]
}
```

### Analisis (`/id/{id}/analisis`) — the graph-critical endpoint

```json
{
  "status": {"code": "200", "text": "ok"},
  "data": [{
    "materias": [{"materia": {"codigo": "6219", "texto": "Responsabilidad Civil..."}}],
    "notas": {"nota": "..."},
    "referencias": {
      "anteriores": [{
        "anterior": [
          {
            "id_norma": "BOE-A-1958-11341",
            "relacion": {"codigo": "210", "texto": "DEROGA"},
            "texto": "parcialmente la Ley sobre procedimiento administrativo..."
          },
          {
            "id_norma": "BOE-A-1985-12666",
            "relacion": {"codigo": "330", "texto": "CITA"},
            "texto": "Ley Orgánica 6/1985, de 1 de julio"
          }
        ]
      }],
      "posteriores": [{
        "posterior": [
          {
            "id_norma": "BOE-A-2015-10565",
            "relacion": {"codigo": "210", "texto": "SE DEROGA"},
            "texto": "en la forma indicada, por Ley 39/2015..."
          },
          {
            "id_norma": "BOE-A-1999-847",
            "relacion": {"codigo": "270", "texto": "SE MODIFICA"},
            "texto": ", por la Ley 4/1999, de 13 de enero"
          }
        ]
      }]
    }
  }]
}
```

### Semantics of `anteriores` vs `posteriores`

| Block | Direction | What it means |
|-------|-----------|---------------|
| `anteriores` | This norm → older norms | Actions THIS norm performs: it DEROGATES, MODIFIES, CITES older laws |
| `posteriores` | Newer norms → this norm | Actions NEWER norms perform ON this norm: it has been SE DEROGATED, SE MODIFIED, SE CITED by newer laws |

For Briefings 01–04:
- **Briefing 01** (most amended): count `posteriores` entries with codes 270/407 per norm
- **Briefing 02** (omnibus offenders): count `anteriores` entries with codes 210/270/407 per norm
- **Briefing 03** (ghost citations): follow `anteriores` CITA (330) edges; check if target has `vigencia_agotada = "S"`
- **Briefing 04** (Ley 30/1992 blast radius): look at `posteriores` of BOE-A-1992-26318; filter to in-force norms

### Relation codes observed

| Code | Text in `anteriores` | Text in `posteriores` | Meaning |
|------|---------------------|----------------------|---------|
| 201 | CORRECCIÓN de errores | — | Erratum |
| 210 | DEROGA | SE DEROGA | Repeal (full or partial) |
| 230 | — | SE DEJA SIN EFECTO | Suspended/nullified |
| 270 | MODIFICA | SE MODIFICA | Amendment |
| 330 | CITA | — | Explicit citation |
| 331 | — | SE DICTA EN RELACIÓN | Issued in connection with |
| 407 | AÑADE | SE AÑADE | Addition of articles |
| 440 | SE DICTA DE CONFORMIDAD | — | Issued pursuant to (legal authority cite) |
| 470 | SE DECLARA | — | Constitutional Court declaration |
| 490 | SE DESARROLLA | — | Implementing regulation |

---

## 3. `estatus_derogacion` Values and Semantics

The field is a `CHAR(1)` with exactly two values. It lives **only in the `/metadatos` endpoint** (absent from the list endpoint).

| Value | Meaning |
|-------|---------|
| `"N"` | Not derogated — the norm is (at least formally) in force. May still be partially amended. |
| `"S"` | Derogated — the norm has been explicitly repealed in full. |

**Three companion fields** are needed together to determine true in-force status:

| Field | Values | Where |
|-------|--------|-------|
| `estatus_derogacion` | S / N | `/metadatos` only |
| `estatus_anulacion` | S / N | `/metadatos` only |
| `vigencia_agotada` | S / N | List endpoint AND `/metadatos` |

**Practical classification for the briefings:**

- **Dead norm**: `vigencia_agotada = "S"` (reliable proxy — always aligns with `estatus_derogacion = "S"` for explicit repeals; also catches expired transitional norms)
- **In-force norm**: `vigencia_agotada = "N"`
- **Partial repeal**: `estatus_derogacion = "N"` but with `posteriores` entries like `"SE DEROGA los arts. X, Y"` — the norm is still alive but imperfectly so. Its `vigencia_agotada` remains `"N"`.

The challenge brief's warning about "nuances" refers to this: a partially-repealed law is still classified as `estatus_derogacion = "N"`. For Briefings 01 and 02, this matters for edge counting (we should count all amendment types, including partial derogations). For Briefings 03 and 04, "in force" = `vigencia_agotada = "N"`.

**Confirmed real data:**
- Ley 30/1992 (BOE-A-1992-26318): `estatus_derogacion = "S"`, `vigencia_agotada = "S"` → fully dead
- Ley Hipotecaria (BOE-A-1946-2453): `estatus_derogacion = "N"`, `vigencia_agotada = "N"` → alive since 1946
- Código Civil (BOE-A-1889-4763): 53 SE MODIFICA, 11 SE DEROGA (partial) in its posteriores — classic "partially amended across 130 years"

---

## 4. Approximate Total Norm Count

Binary-searched using the `offset` parameter:

| Offset | Has data? |
|--------|-----------|
| 12,200 | Yes |
| 12,300 | No |

**Estimate: ~12,200–12,250 consolidated norms** in the corpus as of 2026-06-04.

This is manageable. A full ingest of analisis + metadatos per norm = ~24,400 HTTP requests.

---

## 5. Rate Limits and Quirks

### Rate limits
No `X-RateLimit-*` headers observed. No documented throttling policy. The server returns `Age: 37` suggesting a CDN cache layer is in front. Conservative assumption: stay under 20–50 concurrent requests; back off exponentially on any 5xx.

### Critical quirks

**1. `Accept` header is mandatory.**
Omitting it returns `HTTP 400 — "No reconocido el formato de la cabecera Accept"`. WebFetch-style tools that don't send an Accept header will always fail. Use curl or an HTTP client that allows header control.

**2. Empty list returns `"data": ""` (empty string), not `[]` or `{}`.**
```json
{"status": {"code": "200", "text": "ok"}, "data": ""}
```
JSON parsers will not raise an error but the type changes from array to string. Check `isinstance(data, list)` before iterating.

**3. Strange nesting in `anteriores` / `posteriores`.**
The structure is: `anteriores: [ { "anterior": [...] } ]` — an outer array that always contains exactly one wrapper object, whose `anterior` key contains the actual list of references. Likewise for `posteriores`. The outer array appears to always have one element, but code should not assume this.

**4. `analisis` block is optional `[0..1]`.**
Some norms (especially old ones with no registered relationships) return an analisis with empty/absent `referencias`. Log these for coverage tracking.

**5. Identifier format.**
`BOE-A-YYYY-NNNNN` — three-letter prefix + letter + year + number. The ID is the canonical key across all endpoints. ELI URL form (`boe.es/eli/es/l/1992/11/26/30`) is also present but not required for API calls.

**6. `estatus_derogacion` is absent from the list endpoint.**
If you want `estatus_derogacion` for all norms, you must call `/metadatos` per norm. `vigencia_agotada` IS in the list endpoint and is a reliable proxy for "dead vs alive" for our use case.

**7. Full norm endpoint (`/id/{id}`) is XML-only.**
The endpoint returning the complete norm (metadatos + analisis + texto) only supports `Accept: application/xml`. Individual sub-endpoints (`/metadatos`, `/analisis`) support JSON.

---

## 6. Recommended Ingestion Strategy

### Phase 1 — Enumerate (1 API call)

```bash
GET /legislacion-consolidada?limit=-1&Accept: application/json
```

Returns all ~12,200 norms with `identificador` and `vigencia_agotada`. Save to local store (SQLite or JSON file). This is the checkpoint: all subsequent phases key off this list.

### Phase 2 — Fetch analisis per norm (~12,200 calls)

For each `identificador`:
```bash
GET /legislacion-consolidada/id/{id}/analisis?Accept: application/json
```

Extract and store: `anteriores[]` and `posteriores[]` with their `id_norma`, `relacion.codigo`, `relacion.texto`.

### Phase 3 — Fetch metadatos per norm (~12,200 calls) *(optional)*

Only needed if `vigencia_agotada` from Phase 1 is insufficient (e.g., you want to distinguish `estatus_anulacion = "S"` norms). Given the brief's language, Phase 1's `vigencia_agotada` covers all four briefings adequately.

### Concurrency and retry policy

| Setting | Value | Rationale |
|---------|-------|-----------|
| Concurrency | 20 workers | Conservative; no documented limit; CDN suggests tolerance |
| Batch size | 500 norms per checkpoint flush | Balance between memory and restart cost |
| Retry on 429 | Exponential backoff: 5s → 10s → 20s → give up | |
| Retry on 5xx | Same backoff, max 3 retries | |
| Retry on network error | Same, max 5 retries | |
| Skip on persistent 404 | Log and continue | Some IDs may have been removed |
| Timeout per request | 30s | Analisis responses for heavily-amended norms can be large |

### Estimated time

- 12,200 calls × (1/20 calls per second) ≈ **~10 minutes** for analisis phase at 20 concurrency
- With metadatos phase: ~20 minutes total

### Checkpoint design

```
norms_list.json         ← Phase 1 output: all IDs + vigencia_agotada
analisis/{id}.json      ← Phase 2 output: one file per norm (or SQLite rows)
progress.txt            ← last successfully processed ID for restart
```

A SQLite DB with three tables (`norms`, `edges`, `ingestion_log`) is cleaner than flat files for ~12,200 records.

---

## Key Finding for Ley 30/1992 (Briefing 04)

BOE-A-1992-26318 is confirmed in the corpus. Its `posteriores` block lists all norms that have referenced it since 1992, including SE DICTA DE CONFORMIDAD (norms citing it as legal authority) and SE DESARROLLA (implementing regulations). Filtering `posteriores` to `vigencia_agotada = "N"` norms gives the Briefing 04 worklist directly — no need to scan all 12,200 norms.
