# Design tokens — editorial redesign

Proposed before implementation. Reference points: NYT Interactive, FT visual journalism,
Stripe docs (typography discipline only). One ink, one paper, one accent for emphasis,
a separate semantic red for danger states.

## Color

| Token | Hex | Use |
|---|---|---|
| `--ink` | `#1a1a1a` | Headlines, body text, primary UI |
| `--ink-secondary` | `#5c5a55` | Secondary text, captions, table body on dark |
| `--ink-faint` | `#9b9892` | Tertiary labels, placeholders, disabled |
| `--paper` | `#fafaf7` | Page background |
| `--paper-raised` | `#f1efe8` | Table header bands, subtle section dividers |
| `--rule` | `#ddd9d0` | Hairline borders — between rows, under headers |
| `--accent` | `#1f6b4a` | THE emphasis color: headline figure per page, primary links, primary buttons |
| `--accent-dim` | `#1f6b4a` @ 8% | Faint backgrounds behind an emphasized figure (rare) |
| `--danger` | `#7a2e2a` | Semantic only: "Derogada" status, error lines — never decorative |
| `--danger-dim` | `#7a2e2a` @ 6% | Background wash behind a danger line, if needed |

No gradients, no glass, no neon. Greys are warm (slightly toward `--ink`/`--paper`'s undertone), not cool slate.

## Typography

**Serif (headlines + body + figures):** Source Serif 4, fallback `Georgia, 'Times New Roman', serif`
**Sans (UI chrome — nav, labels, buttons, table headers):** IBM Plex Sans, fallback `system-ui, sans-serif`

Both load via `next/font/google` — no new dependency.

Scale (px / line-height), used everywhere, no ad-hoc sizes:

| Token | Size | Line-height | Use |
|---|---|---|---|
| `--text-xs` | 13 | 1.4 | Small-caps labels, table headers, captions, breadcrumbs |
| `--text-sm` | 15 | 1.55 | UI chrome, secondary copy, nav |
| `--text-base` | 17 | 1.65 | Body paragraphs, table cells |
| `--text-lg` | 21 | 1.5 | Lead paragraphs, context copy under a headline |
| `--text-xl` | 29 | 1.3 | Section heads within a page |
| `--text-display` | 40 | 1.2 | "The answer" on briefing pages, headline figures |
| `--text-display-lg` | 58 | 1.15 | Landing page opening sentence |

`font-variant-numeric: tabular-nums` on every table cell and every standalone figure.
Small-caps (`font-variant: small-caps` + letter-spacing) for table headers and section labels — sans-serif only.

## Spacing

Base unit 4px. Generous newspaper-column rhythm — sections separate by 64–96px, not 16–24px.

| Token | Value |
|---|---|
| `--space-1` | 4px |
| `--space-2` | 8px |
| `--space-3` | 12px |
| `--space-4` | 16px |
| `--space-6` | 24px |
| `--space-8` | 32px |
| `--space-12` | 48px |
| `--space-16` | 64px |
| `--space-24` | 96px |
| `--space-32` | 128px |

Max content width for reading columns: **720px** (article body / answer / context).
Max content width for tables/diagrams: **920px**.

## Components (rules, not tokens, but binding)

- **Buttons:** rectangular, max 4px radius, no shadow. Primary = filled `--ink` / white text. Secondary = text-only `--ink`, underline on hover. No pill shapes.
- **Tables:** 1px `--rule` between rows only, never around or between cells. Header row: small-caps sans, `--ink-faint`, `--paper-raised` band, no vertical borders. Numeric columns right-aligned, tabular nums. Row height generous (≥48px).
- **Loading:** 2px `--accent` progress bar pinned to top of viewport, or inline "Cargando…" in `--ink-faint`. No spinners (chat input retains a minimal one only because it's inline with the send affordance — will reconsider).
- **Errors:** one line, `--danger`, no icon/border/modal.
- **Links (in-text):** `--accent`, no underline at rest, underline on hover — except nav, which is `--ink-secondary` → `--ink`.
- **Graph (explorer + subgraph):** nodes in `--ink` (alive) / `--danger` (dead) / `--ink-faint` (stub), briefing focal nodes ringed in `--accent`. Thin links in greys, not the current saturated blue/red/green/amber edge palette — restraint over legend-chart vividness. Hover = subtle weight increase only.

## What this replaces

- Drop `navy` Tailwind palette entirely (the current `#1e3a5f`/`#0f1e30` corporate-blue scheme).
- Drop `Inter` as the primary font; keep a sans only for chrome (IBM Plex Sans replaces Inter's role).
- Drop `HeroCanvas` (particle animation) — the landing page opens on a single typeset sentence, not a canvas effect.
- Drop card-grid briefing tiles, gradient backgrounds, KPI-tile dashboards, chat bubbles/avatars.
