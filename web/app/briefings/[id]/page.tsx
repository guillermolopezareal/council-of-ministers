import { notFound } from 'next/navigation'
import Link from 'next/link'
import {
  getBriefing, getSubgraph, formatDate, shortTitle,
} from '@/lib/api'
import type { Briefing, BriefingResult, SubgraphData } from '@/lib/types'
import SubGraph, { SubGraphLegend } from '@/components/SubGraph'

// Force dynamic rendering — never cache this page
export const dynamic = 'force-dynamic'

// ── Metadata ──────────────────────────────────────────────────────────────────

export function generateStaticParams() {
  return [{ id: '1' }, { id: '2' }, { id: '3' }, { id: '4' }]
}

// ── Answer (first sentence, shown before any query or table) ──────────────────

function firstSentence(b: Briefing): string {
  switch (b.briefing) {
    case 1: {
      const top = b.results?.[0]
      if (!top) return 'No hay datos suficientes. Ejecute briefings.py para generar el análisis.'
      return `El ${shortTitle(top.titulo, 90)} es la ley con más modificaciones acumuladas en España: ha sido alterada ${top.amendment_count} veces por ${top.unique_amenders} normas distintas.`
    }
    case 2: {
      const top = b.results?.[0]
      if (!top) return 'No hay datos suficientes. Ejecute briefings.py para generar el análisis.'
      const name = top.numero_oficial ? `La ley ${top.numero_oficial}` : shortTitle(top.titulo, 60)
      return `${name} es la norma que más estatutos ha reescrito en un solo acto: modificó ${top.unique_targets} leyes distintas en ${top.total_actions} acciones legislativas.`
    }
    case 3: {
      const pct = b.percentage
      if (!pct) return 'No hay datos suficientes. Ejecute briefings.py para generar el análisis.'
      return `El ${pct.pct_citing_dead}% del ordenamiento jurídico en vigor —${pct.citing_dead.toLocaleString('es-ES')} de ${pct.total_in_force.toLocaleString('es-ES')} normas— invoca al menos una ley derogada como si aún fuese derecho válido.`
    }
    case 4: {
      const n = b.results?.length ?? 0
      if (b.warning) return 'Ley 30/1992 no encontrada en la base de datos. Cargue el corpus completo.'
      return `${n} leyes en vigor siguen citando la Ley 30/1992 de forma directa, casi seis años después de su derogación formal el 2 de abril de 2021.`
    }
  }
}

function contextParagraph(briefingId: 1 | 2 | 3 | 4): string {
  const ctx: Record<number, string> = {
    1: 'Una ley modificada decenas de veces por distintos legisladores es ya ininteligible para el jurista que la aplica. La superposición de enmiendas parciales erosiona la coherencia interna del texto, genera contradicciones no intencionales y multiplica el riesgo de nulidad. Estas son las primeras candidatas a redacción limpia.',
    2: 'Las leyes ómnibus —textos que modifican docenas de estatutos no relacionados en un solo acto— son el mecanismo principal por el que se fragmenta el libro de estatutos. Habitualmente se articulan como disposiciones adicionales o finales de leyes de acompañamiento a los Presupuestos Generales del Estado. El Consejo puede restringir esta práctica con un simple instrumento de técnica legislativa.',
    3: 'Cuando una ley se deroga, todas las normas que la citan deberían actualizarse para referenciar la legislación sustitutiva. En la práctica, esta limpieza nunca ocurre. Las citas fantasma generan inseguridad jurídica: el ciudadano o el funcionario que sigue la remisión llega a una norma inexistente. En casos extremos, constituyen motivo de impugnación.',
    4: 'La Ley 30/1992 fue derogada por las Leyes 39/2015 y 40/2015. La derogación fue escalonada, con efectos finales el 2 de abril de 2021. Seis años después, la limpieza de referencias no se ha completado. Cada norma de la lista siguiente requiere una modificación puntual para actualizar sus remisiones al nuevo marco normativo.',
  }
  return ctx[briefingId]
}

// ── Subgraph seed selection ───────────────────────────────────────────────────

async function fetchBriefingSubgraph(b: Briefing): Promise<SubgraphData | null> {
  let rootId: string | undefined
  let limit = 60

  if ((b.briefing === 1 || b.briefing === 2) && b.results?.[0]) {
    rootId = b.results[0].id
  } else if (b.briefing === 3 && b.ghost_norms?.[0]) {
    rootId = b.ghost_norms[0].id
  } else if (b.briefing === 4 && b.ley30) {
    rootId = b.ley30.id
    limit  = 120   // Ley 30/1992 has many citers
  }

  if (!rootId) return null
  return getSubgraph(rootId, 1, [], limit)
}

// ── Status badge ──────────────────────────────────────────────────────────────

function StatusBadge({ isDerogada }: { isDerogada?: boolean }) {
  if (isDerogada) {
    return (
      <span className="inline-block px-2 py-0.5 text-xs font-medium bg-red-50 text-red-700 border border-red-200">
        Derogada
      </span>
    )
  }
  return (
    <span className="inline-block px-2 py-0.5 text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
      En vigor
    </span>
  )
}

// ── Table renderers ───────────────────────────────────────────────────────────

function B1Table({ results }: { results: BriefingResult[] }) {
  return (
    <table className="table-official">
      <thead>
        <tr>
          <th className="w-8">#</th>
          <th>Norma</th>
          <th className="w-24">Tipo</th>
          <th className="w-28 text-right">Modificaciones</th>
          <th className="w-28 text-right">Por N leyes</th>
        </tr>
      </thead>
      <tbody>
        {results.map(r => (
          <tr key={r.id}>
            <td className="text-slate-400 font-mono text-xs">{r.rank}</td>
            <td>
              <div className="font-medium text-slate-900 text-sm leading-snug">
                {shortTitle(r.titulo)}
              </div>
              {r.numero_oficial && (
                <div className="text-xs text-slate-400 mt-0.5">
                  Ley {r.numero_oficial}
                </div>
              )}
            </td>
            <td className="text-slate-500 text-xs">{r.rango ?? '—'}</td>
            <td className="text-right font-semibold text-navy-800">
              {r.amendment_count ?? '—'}
            </td>
            <td className="text-right text-slate-500">
              {r.unique_amenders ?? '—'}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function B2Table({ results }: { results: BriefingResult[] }) {
  return (
    <table className="table-official">
      <thead>
        <tr>
          <th className="w-8">#</th>
          <th>Norma</th>
          <th className="w-24">Tipo</th>
          <th className="w-32 text-right">Leyes distintas</th>
          <th className="w-32 text-right">Acciones totales</th>
          <th className="w-28">Estado</th>
        </tr>
      </thead>
      <tbody>
        {results.map(r => (
          <tr key={r.id}>
            <td className="text-slate-400 font-mono text-xs">{r.rank}</td>
            <td>
              <div className="font-medium text-slate-900 text-sm leading-snug">
                {shortTitle(r.titulo)}
              </div>
              {r.numero_oficial && (
                <div className="text-xs text-slate-400 mt-0.5">
                  {r.numero_oficial} · {formatDate(r.fecha_disposicion)}
                </div>
              )}
            </td>
            <td className="text-slate-500 text-xs">{r.rango ?? '—'}</td>
            <td className="text-right font-semibold text-navy-800">
              {r.unique_targets ?? '—'}
            </td>
            <td className="text-right text-slate-500">
              {r.total_actions ?? '—'}
            </td>
            <td><StatusBadge isDerogada={r.is_dead} /></td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function B3GhostTable({ ghosts }: { ghosts: BriefingResult[] }) {
  return (
    <table className="table-official">
      <thead>
        <tr>
          <th className="w-8">#</th>
          <th>Ley fantasma</th>
          <th className="w-24">Tipo</th>
          <th className="w-32">Derogada</th>
          <th className="w-40 text-right">Citada por N leyes vivas</th>
        </tr>
      </thead>
      <tbody>
        {ghosts.map(g => (
          <tr key={g.id}>
            <td className="text-slate-400 font-mono text-xs">{g.rank}</td>
            <td>
              <div className="font-medium text-slate-900 text-sm leading-snug">
                {shortTitle(g.titulo)}
              </div>
              {g.numero_oficial && (
                <div className="text-xs text-slate-400 mt-0.5">Ley {g.numero_oficial}</div>
              )}
            </td>
            <td className="text-slate-500 text-xs">{g.rango ?? '—'}</td>
            <td className="text-sm text-red-700">{formatDate(g.fecha_derogacion)}</td>
            <td className="text-right font-semibold text-navy-800">
              {g.cited_by_count ?? '—'}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function B4BlastTable({ results }: { results: BriefingResult[] }) {
  return (
    <table className="table-official">
      <thead>
        <tr>
          <th className="w-8">#</th>
          <th>Norma en vigor</th>
          <th className="w-24">Tipo</th>
          <th className="w-40">Fecha</th>
          <th className="w-48">Departamento</th>
          <th className="w-40">Tipo de referencia</th>
        </tr>
      </thead>
      <tbody>
        {results.map(r => (
          <tr key={r.id}>
            <td className="text-slate-400 font-mono text-xs">{r.rank}</td>
            <td>
              <div className="font-medium text-slate-900 text-sm leading-snug">
                {shortTitle(r.titulo)}
              </div>
              {r.numero_oficial && (
                <div className="text-xs text-slate-400 mt-0.5">Ley {r.numero_oficial}</div>
              )}
            </td>
            <td className="text-slate-500 text-xs">{r.rango ?? '—'}</td>
            <td className="text-sm text-slate-600">{formatDate(r.fecha_disposicion)}</td>
            <td className="text-xs text-slate-500">{shortTitle(r.departamento, 35)}</td>
            <td className="text-xs text-slate-500">{r.relacion_tipo ?? '—'}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

// ── Page (server component) ───────────────────────────────────────────────────

const BRIEFING_LABELS: Record<number, string> = {
  1: 'Diagnóstico',
  2: 'Causa raíz',
  3: 'La podredumbre',
  4: 'El bisturí',
}

interface PageProps {
  params: { id: string }
}

export default async function BriefingPage({ params }: PageProps) {
  const { id } = params
  const n = parseInt(id) as 1 | 2 | 3 | 4
  if (isNaN(n) || n < 1 || n > 4) notFound()

  // Fetch briefing + subgraph concurrently where possible
  const briefing = await getBriefing(n)
  if (!briefing) {
    // API is down or data not generated — show a helpful empty state
    return (
      <div className="max-w-3xl mx-auto px-6 py-24 text-center">
        <p className="text-slate-400 text-sm mb-4">
          Los datos del análisis no están disponibles.
        </p>
        <p className="text-slate-500 text-sm">
          Ejecute <code className="bg-slate-100 px-1">briefings.py</code> y
          asegúrese de que la API FastAPI está en ejecución.
        </p>
        <Link href="/" className="mt-8 inline-block text-navy-800 text-sm hover:underline">
          ← Volver
        </Link>
      </div>
    )
  }

  const subgraphData = await fetchBriefingSubgraph(briefing).catch(() => null)

  const answer   = firstSentence(briefing)
  const context  = contextParagraph(n)
  const tagLabel = BRIEFING_LABELS[n]

  return (
    <article>
      {/* ── Header ─────────────────────────────────────────────────── */}
      <header className="bg-navy-950 text-white">
        <div className="max-w-5xl mx-auto px-6 py-16">
          {/* Breadcrumb */}
          <nav className="mb-8 text-navy-300 text-xs flex items-center gap-2">
            <Link href="/" className="hover:text-white transition-colors">
              Inicio
            </Link>
            <span>›</span>
            <span>Análisis legislativo</span>
            <span>›</span>
            <span className="text-white">
              {String(n).padStart(2, '0')} {tagLabel}
            </span>
          </nav>

          <p className="text-navy-300 text-xs font-semibold tracking-widest uppercase mb-4">
            Informes para el Consejo de Ministros · {String(n).padStart(2, '0')}/{4}
          </p>

          {/* THE ANSWER — first and largest element on the page */}
          <h1 className="text-2xl md:text-3xl font-bold leading-snug max-w-3xl mb-8">
            {answer}
          </h1>

          <p className="text-navy-200 text-base leading-relaxed max-w-2xl">
            {context}
          </p>
        </div>
      </header>

      {/* ── Main content ───────────────────────────────────────────── */}
      <div className="max-w-5xl mx-auto px-6 py-16 space-y-16">

        {/* ── Table section ──────────────────────────────────────────── */}
        <section>
          <h2 className="text-xs font-semibold tracking-widest text-slate-400 uppercase mb-6">
            {n === 1 && 'Las 5 normas más modificadas'}
            {n === 2 && 'Las 5 normas ómnibus más agresivas'}
            {n === 3 && 'Dimensión del problema'}
            {n === 4 && `Inventario completo — ${briefing.results?.length ?? 0} normas`}
          </h2>

          {/* B3 summary tiles */}
          {n === 3 && briefing.percentage && (
            <div className="grid grid-cols-3 gap-6 mb-10">
              {[
                {
                  label: 'Normas en vigor',
                  value: briefing.percentage.total_in_force.toLocaleString('es-ES'),
                },
                {
                  label: 'Con citas a ley muerta',
                  value: briefing.percentage.citing_dead.toLocaleString('es-ES'),
                  accent: true,
                },
                {
                  label: 'Porcentaje',
                  value: `${briefing.percentage.pct_citing_dead}%`,
                  accent: true,
                },
              ].map(tile => (
                <div
                  key={tile.label}
                  className={`border p-6 ${tile.accent ? 'border-red-200 bg-red-50' : 'border-slate-200 bg-white'}`}
                >
                  <div className={`text-3xl font-bold mb-1 ${tile.accent ? 'text-red-700' : 'text-navy-800'}`}>
                    {tile.value}
                  </div>
                  <div className="text-xs text-slate-500 uppercase tracking-wide font-medium">
                    {tile.label}
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="bg-white border border-slate-200 overflow-x-auto">
            {n === 1 && briefing.results && <B1Table results={briefing.results} />}
            {n === 2 && briefing.results && <B2Table results={briefing.results} />}
            {n === 3 && briefing.ghost_norms && (
              <>
                <div className="px-6 pt-5 pb-2 text-xs font-semibold tracking-widest text-slate-400 uppercase border-b border-slate-100">
                  Las 5 leyes muertas más citadas por el ordenamiento vivo
                </div>
                <B3GhostTable ghosts={briefing.ghost_norms} />
              </>
            )}
            {n === 4 && briefing.results && <B4BlastTable results={briefing.results} />}
            {((n < 3 && !briefing.results?.length) ||
              (n === 3 && !briefing.ghost_norms?.length) ||
              (n === 4 && !briefing.results?.length)) && (
              <div className="px-6 py-12 text-center text-slate-400 text-sm">
                Sin resultados. Ejecute <code className="bg-slate-100 px-1">briefings.py</code>.
              </div>
            )}
          </div>
        </section>

        {/* ── Subgraph section ───────────────────────────────────────── */}
        {subgraphData && subgraphData.nodes.length > 0 && (
          <section>
            <div className="flex items-baseline justify-between mb-4">
              <h2 className="text-xs font-semibold tracking-widest text-slate-400 uppercase">
                Red de relaciones
              </h2>
              <span className="text-xs text-slate-400">
                {subgraphData.node_count} nodos · {subgraphData.edge_count} aristas
              </span>
            </div>

            <div className="mb-3">
              <SubGraphLegend />
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
              height={400}
            />

            <p className="mt-3 text-xs text-slate-400 leading-relaxed">
              Vecinos inmediatos de la norma principal. Los nodos en{' '}
              <strong className="text-navy-800">azul marino</strong> están en
              vigor; en <strong className="text-red-700">rojo</strong>, derogados.
              Use el{' '}
              <Link href="/explore" className="underline hover:text-navy-800">
                explorador completo
              </Link>{' '}
              para navegar el corpus.
            </p>
          </section>
        )}

        {/* ── Navigation ─────────────────────────────────────────────── */}
        <nav className="flex items-center justify-between pt-8 border-t border-slate-200">
          {n > 1 ? (
            <Link
              href={`/briefings/${n - 1}`}
              className="text-sm text-navy-800 hover:underline"
            >
              ← Informe {String(n - 1).padStart(2, '0')}
            </Link>
          ) : (
            <Link href="/" className="text-sm text-navy-800 hover:underline">
              ← Inicio
            </Link>
          )}

          {n < 4 ? (
            <Link
              href={`/briefings/${n + 1}`}
              className="text-sm text-navy-800 hover:underline"
            >
              Informe {String(n + 1).padStart(2, '0')} →
            </Link>
          ) : (
            <Link href="/explore" className="text-sm text-navy-800 hover:underline">
              Explorador →
            </Link>
          )}
        </nav>
      </div>
    </article>
  )
}
