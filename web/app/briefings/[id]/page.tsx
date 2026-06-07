import { notFound } from 'next/navigation'
import Link from 'next/link'
import {
  getBriefing, getSubgraph, formatDate, shortTitle,
} from '@/lib/api'
import type { Briefing, BriefingResult, SubgraphData } from '@/lib/types'
import SubGraph, { SubGraphLegend } from '@/components/SubGraph'
import CypherDisclosure from '@/components/CypherDisclosure'

// Force dynamic rendering — never cache this page
export const dynamic = 'force-dynamic'

export function generateStaticParams() {
  return [{ id: '1' }, { id: '2' }, { id: '3' }, { id: '4' }]
}

// ── Editorial labels ──────────────────────────────────────────────────────────

const BRIEFING_LABELS: Record<number, string> = {
  1: 'Diagnóstico',
  2: 'Causa raíz',
  3: 'La podredumbre',
  4: 'El bisturí',
}

// ── The answer (first and largest element on the page) ────────────────────────

function answer(b: Briefing): string {
  switch (b.briefing) {
    case 1: {
      const top = b.results?.[0]
      if (!top) return 'No hay datos suficientes. Ejecute briefings.py para generar el análisis.'
      const name = top.numero_oficial ? `La Ley ${top.numero_oficial}` : shortTitle(top.titulo, 60)
      return `${name} es la norma con más modificaciones acumuladas de España.`
    }
    case 2: {
      const top = b.results?.[0]
      if (!top) return 'No hay datos suficientes. Ejecute briefings.py para generar el análisis.'
      const name = top.numero_oficial ? `La Ley ${top.numero_oficial}` : shortTitle(top.titulo, 60)
      return `${name} es la norma que más estatutos ha reescrito en un solo acto.`
    }
    case 3: {
      const pct = b.percentage
      if (!pct) return 'No hay datos suficientes. Ejecute briefings.py para generar el análisis.'
      return 'Casi dos de cada diez normas vigentes citan una ley que ya no existe.'
    }
    case 4: {
      if (b.warning) return 'Ley 30/1992 no encontrada en la base de datos. Cargue el corpus completo.'
      return 'Seis años después de su derogación, la Ley 30/1992 sigue gobernando por referencia.'
    }
  }
}

// ── Headline figure: the single number this briefing is about ────────────────

function headlineFigure(b: Briefing): { value: string; caption: string } | null {
  switch (b.briefing) {
    case 1: {
      const top = b.results?.[0]
      if (!top) return null
      return {
        value: String(top.amendment_count ?? '—'),
        caption: `modificaciones acumuladas, por ${top.unique_amenders} normas distintas`,
      }
    }
    case 2: {
      const top = b.results?.[0]
      if (!top) return null
      return {
        value: String(top.unique_targets ?? '—'),
        caption: `leyes reescritas en ${top.total_actions} acciones de un único acto legislativo`,
      }
    }
    case 3: {
      const pct = b.percentage
      if (!pct) return null
      return {
        value: `${pct.pct_citing_dead}%`,
        caption: `${pct.citing_dead.toLocaleString('es-ES')} de ${pct.total_in_force.toLocaleString('es-ES')} normas vigentes citan al menos una ley derogada`,
      }
    }
    case 4: {
      if (b.warning || !b.results) return null
      return {
        value: String(b.results.length),
        caption: 'normas en vigor citan directamente la Ley 30/1992, derogada el 2 de abril de 2021',
      }
    }
  }
}

function contextParagraph(briefingId: 1 | 2 | 3 | 4): string {
  const ctx: Record<number, string> = {
    1: 'Una ley modificada decenas de veces por distintos legisladores es ya ininteligible para el jurista que la aplica. La superposición de enmiendas parciales erosiona la coherencia interna del texto y multiplica el riesgo de contradicción. Estas son las primeras candidatas a una redacción limpia.',
    2: 'Las leyes ómnibus —textos que modifican docenas de estatutos no relacionados en un solo acto— son el mecanismo principal por el que se fragmenta el libro de estatutos. Habitualmente se articulan como disposiciones adicionales o finales de las leyes de acompañamiento a los Presupuestos Generales del Estado.',
    3: 'Cuando una ley se deroga, las normas que la citan deberían actualizarse para referenciar la legislación sustitutiva. En la práctica, esa limpieza casi nunca ocurre: el ciudadano o el funcionario que sigue la remisión llega a una norma que ya no existe. En casos extremos, constituye motivo de impugnación.',
    4: 'La Ley 30/1992 fue sustituida por las Leyes 39/2015 y 40/2015, con efectos finales el 2 de abril de 2021. Cada norma del inventario siguiente requiere una modificación puntual para actualizar sus remisiones al nuevo marco normativo.',
  }
  return ctx[briefingId]
}

// ── Cypher behind disclosure (static — these are the four pre-computed queries) ──

const CYPHER: Record<number, { label: string; query: string }[]> = {
  1: [{
    label: 'Consulta',
    query:
`MATCH (src:Norm)-[r]->(n:Norm)
WHERE n.in_corpus = true
  AND n.is_dead   = false
  AND (
        type(r) = 'AMENDS'
    OR (type(r) = 'REPEALS' AND r.is_partial = true)
  )
WITH  n,
      count(r)            AS amendment_count,
      count(DISTINCT src) AS unique_amenders
ORDER BY amendment_count DESC
LIMIT 5
RETURN n.id, n.titulo, n.numero_oficial, n.rango,
       n.fecha_disposicion, amendment_count, unique_amenders`,
  }],
  2: [{
    label: 'Consulta',
    query:
`MATCH (n:Norm)-[r]->(target:Norm)
WHERE n.in_corpus = true
  AND type(r) IN ['AMENDS', 'REPEALS']
WITH  n,
      count(r)               AS total_actions,
      count(DISTINCT target) AS unique_targets
ORDER BY unique_targets DESC
LIMIT 5
RETURN n.id, n.titulo, n.numero_oficial, n.rango,
       n.fecha_disposicion, n.is_dead, total_actions, unique_targets`,
  }],
  3: [
    {
      label: 'Consulta — porcentaje',
      query:
`MATCH (live:Norm)
WHERE live.in_corpus = true AND live.is_dead = false
WITH count(live) AS total_live
MATCH (src:Norm)-[:CITES]->(dead:Norm)
WHERE src.in_corpus = true
  AND src.is_dead   = false
  AND dead.is_dead  = true
WITH total_live, count(DISTINCT src) AS citing_live
RETURN total_live, citing_live,
       round(toFloat(citing_live) / total_live * 100, 1) AS pct_citing_dead`,
    },
    {
      label: 'Consulta — leyes fantasma',
      query:
`MATCH (live:Norm)-[:CITES]->(dead:Norm)
WHERE live.in_corpus = true
  AND live.is_dead   = false
  AND dead.is_dead   = true
WITH  dead, count(DISTINCT live) AS cited_by_count
ORDER BY cited_by_count DESC
LIMIT 5
RETURN dead.id, dead.titulo, dead.numero_oficial, dead.rango,
       dead.fecha_derogacion, cited_by_count`,
    },
  ],
  4: [{
    label: 'Consulta',
    query:
`MATCH (live:Norm)-[r:CITES]->(ley30:Norm {id: $ley30_id})
WHERE live.in_corpus = true
  AND live.is_dead   = false
RETURN live.id, live.titulo, live.numero_oficial, live.rango,
       live.fecha_disposicion, live.departamento,
       r.relacion_texto AS relacion_tipo, r.detail
ORDER BY live.fecha_disposicion`,
  }],
}

// ── Subgraph seed selection ───────────────────────────────────────────────────

async function fetchBriefingSubgraph(b: Briefing): Promise<SubgraphData | null> {
  let rootId: string | undefined
  let limit = 40

  if ((b.briefing === 1 || b.briefing === 2) && b.results?.[0]) {
    rootId = b.results[0].id
  } else if (b.briefing === 3 && b.ghost_norms?.[0]) {
    rootId = b.ghost_norms[0].id
  } else if (b.briefing === 4 && b.ley30) {
    rootId = b.ley30.id
    limit  = 80
  }

  if (!rootId) return null
  return getSubgraph(rootId, 1, [], limit)
}

// ── Status mark (text only — no badge chrome) ─────────────────────────────────

function StatusMark({ isDerogada }: { isDerogada?: boolean }) {
  return (
    <span className={isDerogada ? 'text-danger' : 'text-ink-secondary'}>
      {isDerogada ? 'Derogada' : 'En vigor'}
    </span>
  )
}

// ── Table renderers — editorial style: thin rules, tabular numerals ──────────

function B1Table({ results }: { results: BriefingResult[] }) {
  return (
    <table className="table-editorial">
      <thead>
        <tr>
          <th className="w-10">N.º</th>
          <th>Norma</th>
          <th className="w-32">Tipo</th>
          <th className="w-40 num">Modificaciones</th>
          <th className="w-32 num">Por N normas</th>
        </tr>
      </thead>
      <tbody>
        {results.map(r => (
          <tr key={r.id}>
            <td className="text-ink-faint">{r.rank}</td>
            <td>
              <div className="text-ink leading-snug">{shortTitle(r.titulo)}</div>
              {r.numero_oficial && (
                <div className="font-sans text-xs text-ink-faint mt-1">Ley {r.numero_oficial}</div>
              )}
            </td>
            <td className="font-sans text-sm text-ink-secondary">{r.rango ?? '—'}</td>
            <td className="num text-accent">{r.amendment_count ?? '—'}</td>
            <td className="num text-ink-secondary">{r.unique_amenders ?? '—'}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function B2Table({ results }: { results: BriefingResult[] }) {
  return (
    <table className="table-editorial">
      <thead>
        <tr>
          <th className="w-10">N.º</th>
          <th>Norma</th>
          <th className="w-32">Tipo</th>
          <th className="w-32 num">Leyes distintas</th>
          <th className="w-32 num">Acciones</th>
          <th className="w-28">Estado</th>
        </tr>
      </thead>
      <tbody>
        {results.map(r => (
          <tr key={r.id}>
            <td className="text-ink-faint">{r.rank}</td>
            <td>
              <div className="text-ink leading-snug">{shortTitle(r.titulo)}</div>
              {r.numero_oficial && (
                <div className="font-sans text-xs text-ink-faint mt-1">
                  {r.numero_oficial} · {formatDate(r.fecha_disposicion)}
                </div>
              )}
            </td>
            <td className="font-sans text-sm text-ink-secondary">{r.rango ?? '—'}</td>
            <td className="num text-accent">{r.unique_targets ?? '—'}</td>
            <td className="num text-ink-secondary">{r.total_actions ?? '—'}</td>
            <td className="font-sans text-sm"><StatusMark isDerogada={r.is_dead} /></td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function B3GhostTable({ ghosts }: { ghosts: BriefingResult[] }) {
  return (
    <table className="table-editorial">
      <thead>
        <tr>
          <th className="w-10">N.º</th>
          <th>Ley fantasma</th>
          <th className="w-32">Tipo</th>
          <th className="w-36">Derogada el</th>
          <th className="w-44 num">Citada por normas vivas</th>
        </tr>
      </thead>
      <tbody>
        {ghosts.map(g => (
          <tr key={g.id}>
            <td className="text-ink-faint">{g.rank}</td>
            <td>
              <div className="text-ink leading-snug">{shortTitle(g.titulo)}</div>
              {g.numero_oficial && (
                <div className="font-sans text-xs text-ink-faint mt-1">Ley {g.numero_oficial}</div>
              )}
            </td>
            <td className="font-sans text-sm text-ink-secondary">{g.rango ?? '—'}</td>
            <td className="font-sans text-sm text-danger">{formatDate(g.fecha_derogacion)}</td>
            <td className="num text-accent">{g.cited_by_count ?? '—'}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function B4BlastTable({ results }: { results: BriefingResult[] }) {
  return (
    <table className="table-editorial">
      <thead>
        <tr>
          <th className="w-10">N.º</th>
          <th>Norma en vigor</th>
          <th className="w-32">Tipo</th>
          <th className="w-36">Fecha</th>
          <th className="w-56">Departamento</th>
          <th className="w-36">Referencia</th>
        </tr>
      </thead>
      <tbody>
        {results.map(r => (
          <tr key={r.id}>
            <td className="text-ink-faint">{r.rank}</td>
            <td>
              <div className="text-ink leading-snug">{shortTitle(r.titulo)}</div>
              {r.numero_oficial && (
                <div className="font-sans text-xs text-ink-faint mt-1">Ley {r.numero_oficial}</div>
              )}
            </td>
            <td className="font-sans text-sm text-ink-secondary">{r.rango ?? '—'}</td>
            <td className="font-sans text-sm text-ink-secondary">{formatDate(r.fecha_disposicion)}</td>
            <td className="font-sans text-sm text-ink-secondary">{shortTitle(r.departamento, 40)}</td>
            <td className="font-sans text-sm text-ink-secondary">{r.relacion_tipo ?? '—'}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

// ── Page (server component) ───────────────────────────────────────────────────

interface PageProps {
  params: { id: string }
}

export default async function BriefingPage({ params }: PageProps) {
  const { id } = params
  const n = parseInt(id) as 1 | 2 | 3 | 4
  if (isNaN(n) || n < 1 || n > 4) notFound()

  const briefing = await getBriefing(n)
  if (!briefing) {
    return (
      <div className="max-w-copy mx-auto px-6 py-28 text-center">
        <p className="font-serif text-lg text-ink-secondary mb-4">
          Los datos del análisis no están disponibles.
        </p>
        <p className="font-sans text-sm text-ink-faint">
          Ejecute <code className="font-mono">briefings.py</code> y asegúrese
          de que la API está en ejecución.
        </p>
        <Link href="/" className="btn-secondary mt-10 inline-block">← Volver</Link>
      </div>
    )
  }

  const subgraphData = await fetchBriefingSubgraph(briefing).catch(() => null)
  const figure  = headlineFigure(briefing)
  const context = contextParagraph(n)
  const tag     = BRIEFING_LABELS[n]

  return (
    <article>
      {/* ── Header: the answer, first and largest ───────────────────── */}
      <header className="border-b border-rule">
        <div className="max-w-table mx-auto px-6 md:px-10 pt-14 pb-16">
          {/* Breadcrumb */}
          <nav className="mb-8 font-sans text-xs text-ink-faint flex items-center gap-2">
            <Link href="/" className="hover:text-ink transition-colors duration-150">Informes</Link>
            <span>/</span>
            <span className="text-ink-secondary">{String(n).padStart(2, '0')} · {tag}</span>
          </nav>

          <p className="label-kicker mb-5">
            Informe {String(n).padStart(2, '0')} de 04 · {tag}
          </p>

          <h1 className="font-serif text-display max-w-copy text-ink leading-tight mb-10 tracking-tight">
            {answer(briefing)}
          </h1>

          <div className="grid md:grid-cols-[auto_1fr] gap-x-12 gap-y-6 items-start max-w-table">
            {figure && (
              <div className="md:min-w-[220px]">
                <div className="font-serif text-display text-accent tabular-nums leading-none mb-2">
                  {figure.value}
                </div>
                <p className="font-sans text-sm text-ink-faint leading-snug max-w-[220px]">
                  {figure.caption}
                </p>
              </div>
            )}
            <p className="font-serif text-lg text-ink-secondary leading-relaxed max-w-copy">
              {context}
            </p>
          </div>
        </div>
      </header>

      {/* ── Main content ───────────────────────────────────────────── */}
      <div className="max-w-table mx-auto px-6 md:px-10 py-16 space-y-20">

        {/* ── Table ──────────────────────────────────────────────────── */}
        <section>
          <div className="flex items-baseline justify-between mb-6 flex-wrap gap-3">
            <h2 className="label-kicker">
              {n === 1 && 'Las cinco normas más modificadas'}
              {n === 2 && 'Las cinco normas ómnibus más agresivas'}
              {n === 3 && 'Las leyes fantasma más citadas'}
              {n === 4 && `Inventario completo — ${briefing.results?.length ?? 0} normas`}
            </h2>
            <div className="space-y-1.5">
              {(CYPHER[n] ?? []).map(c => (
                <CypherDisclosure key={c.label} cypher={c.query} label={c.label === 'Consulta' ? 'Ver consulta' : `Ver ${c.label.split('—')[1]?.trim() ?? c.label}`} />
              ))}
            </div>
          </div>

          {/* B3 summary tiles */}
          {n === 3 && briefing.percentage && (
            <div className="grid grid-cols-3 gap-x-10 mb-12 pb-10 border-b border-rule max-w-table">
              {[
                { label: 'Normas en vigor', value: briefing.percentage.total_in_force.toLocaleString('es-ES') },
                { label: 'Citan ley muerta', value: briefing.percentage.citing_dead.toLocaleString('es-ES'), accent: true },
                { label: 'Proporción', value: `${briefing.percentage.pct_citing_dead}%`, accent: true },
              ].map(tile => (
                <div key={tile.label}>
                  <div className={`font-serif text-xl tabular-nums mb-1 ${tile.accent ? 'text-accent' : 'text-ink'}`}>
                    {tile.value}
                  </div>
                  <div className="font-sans text-xs text-ink-faint uppercase tracking-wide">
                    {tile.label}
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="overflow-x-auto">
            {n === 1 && briefing.results && <B1Table results={briefing.results} />}
            {n === 2 && briefing.results && <B2Table results={briefing.results} />}
            {n === 3 && briefing.ghost_norms && <B3GhostTable ghosts={briefing.ghost_norms} />}
            {n === 4 && briefing.results && <B4BlastTable results={briefing.results} />}
            {((n < 3 && !briefing.results?.length) ||
              (n === 3 && !briefing.ghost_norms?.length) ||
              (n === 4 && !briefing.results?.length)) && (
              <p className="font-sans text-sm text-ink-faint py-12 text-center">
                Sin resultados. Ejecute <code className="font-mono">briefings.py</code>.
              </p>
            )}
          </div>
        </section>

        {/* ── Subgraph ───────────────────────────────────────────────── */}
        {subgraphData && subgraphData.nodes.length > 0 && (
          <section>
            <div className="flex items-baseline justify-between mb-5 flex-wrap gap-2">
              <h2 className="label-kicker">Red de relaciones</h2>
              <span className="font-sans text-xs text-ink-faint tabular-nums">
                {subgraphData.node_count} nodos · {subgraphData.edge_count} aristas
              </span>
            </div>

            <SubGraph
              nodes={subgraphData.nodes}
              edges={subgraphData.edges}
              highlightIds={
                n === 4
                  ? [briefing.ley30?.id ?? ''].filter(Boolean)
                  : briefing.results?.slice(0, 1).map(r => r.id) ??
                    briefing.ghost_norms?.slice(0, 1).map(g => g.id) ?? []
              }
              height={340}
            />

            <div className="mt-4 flex items-baseline justify-between flex-wrap gap-3">
              <SubGraphLegend />
              <Link href="/explore" className="font-sans text-sm text-ink-faint hover:text-ink transition-colors duration-150 whitespace-nowrap">
                Explorador completo →
              </Link>
            </div>
          </section>
        )}

        {/* ── Pagination ─────────────────────────────────────────────── */}
        <nav className="flex items-center justify-between pt-10 border-t border-rule font-sans text-sm">
          {n > 1 ? (
            <Link href={`/briefings/${n - 1}`} className="link-accent">
              ← Informe {String(n - 1).padStart(2, '0')}
            </Link>
          ) : (
            <Link href="/" className="link-accent">← Inicio</Link>
          )}

          {n < 4 ? (
            <Link href={`/briefings/${n + 1}`} className="link-accent">
              Informe {String(n + 1).padStart(2, '0')} →
            </Link>
          ) : (
            <Link href="/explore" className="link-accent">Explorador →</Link>
          )}
        </nav>
      </div>
    </article>
  )
}
