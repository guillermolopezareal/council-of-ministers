'use client'

import { useEffect, useState } from 'react'
import { getNorm, formatDate, shortTitle } from '@/lib/api'
import type { NormDetail, GraphNode, NormEdge } from '@/lib/types'

interface NodePanelProps {
  node: GraphNode | null
  onClose: () => void
  onExpandInGraph: (detail: NormDetail) => void
}

// ── Status — text only, no badge chrome ──────────────────────────────────────

function StatusLine({ node }: { node: GraphNode }) {
  if (!node.in_corpus) return <span className="text-ink-faint">Sin identificador BOE</span>
  if (node.is_dead)    return <span className="text-danger">Derogada</span>
  return <span className="text-ink-secondary">En vigor</span>
}

// ── Edge group — plain text lists, grouped by relation type ──────────────────

const EDGE_LABEL: Record<string, { out: string; in: string }> = {
  AMENDS:   { out: 'Modifica',  in: 'Modificada por' },
  REPEALS:  { out: 'Deroga',    in: 'Derogada por' },
  CITES:    { out: 'Cita',      in: 'Citada por' },
  CORRECTS: { out: 'Corrige',   in: 'Corregida por' },
}

function EdgeList({
  edges, neighbors, nodeId, direction,
}: {
  edges: NormEdge[]
  neighbors: NormDetail['neighbors']
  nodeId: string
  direction: 'out' | 'in'
}) {
  const relevant = edges.filter(e =>
    direction === 'out' ? e.source === nodeId : e.target === nodeId,
  )
  if (!relevant.length) return null

  const neighborMap = new Map(neighbors.map(n => [n.id, n]))

  const byType = new Map<string, NormEdge[]>()
  for (const e of relevant) {
    if (!byType.has(e.type)) byType.set(e.type, [])
    byType.get(e.type)!.push(e)
  }

  return (
    <div className="space-y-5">
      {[...byType.entries()].map(([type, list]) => {
        const meta  = EDGE_LABEL[type] ?? { out: type, in: type }
        const label = direction === 'out' ? meta.out : meta.in
        const shown = list.slice(0, 6)
        const extra = list.length - shown.length

        return (
          <div key={type}>
            <div className="label-kicker mb-2">
              {label} <span className="text-ink-faint">· {list.length}</span>
            </div>
            <ul className="space-y-1.5">
              {shown.map((e, i) => {
                const otherId = direction === 'out' ? e.target : e.source
                const other   = neighborMap.get(otherId)
                return (
                  <li key={i} className="font-serif text-sm text-ink leading-snug">
                    {other ? shortTitle(other.titulo, 60) : otherId}
                    {e.detail && (
                      <span className="font-sans text-xs text-ink-faint"> — {e.detail.slice(0, 60)}</span>
                    )}
                  </li>
                )
              })}
              {extra > 0 && (
                <li className="font-sans text-xs text-ink-faint italic">y {extra} más…</li>
              )}
            </ul>
          </div>
        )
      })}
    </div>
  )
}

// ── Panel — Wikipedia-infobox styling: serif title, key-value metadata ───────

export default function NodePanel({ node, onClose, onExpandInGraph }: NodePanelProps) {
  const [detail, setDetail] = useState<NormDetail | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!node) { setDetail(null); return }
    setDetail(null)
    setLoading(true)
    getNorm(node.id)
      .then(setDetail)
      .finally(() => setLoading(false))
  }, [node?.id])

  if (!node) return null

  const fields: { label: string; value?: string; mono?: boolean }[] = [
    { label: 'Tipo',    value: node.rango },
    { label: 'Fecha',   value: formatDate(node.fecha_disposicion) },
    { label: 'Número',  value: node.numero_oficial },
    { label: 'Ámbito',  value: node.ambito },
    { label: 'ID BOE',  value: node.id, mono: true },
  ]

  return (
    <aside className="flex flex-col h-full bg-paper border-l border-rule w-80 flex-shrink-0">
      {/* Title */}
      <div className="px-6 pt-6 pb-5 border-b border-rule">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="font-sans text-xs mb-2"><StatusLine node={node} /></p>
            <h2 className="font-serif text-lg text-ink leading-snug">
              {shortTitle(node.titulo, 90) || node.id}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-ink-faint hover:text-ink text-xl leading-none flex-shrink-0 mt-0.5"
            aria-label="Cerrar panel"
          >
            ×
          </button>
        </div>
      </div>

      {/* Infobox metadata — compact key-value list */}
      <div className="px-6 py-5 border-b border-rule">
        <dl className="space-y-2">
          {fields.filter(f => f.value).map(({ label, value, mono }) => (
            <div key={label} className="flex gap-4 text-sm">
              <dt className="label-kicker w-16 flex-shrink-0 pt-px">{label}</dt>
              <dd className={`text-ink leading-snug ${mono ? 'font-mono text-xs break-all' : 'font-serif'}`}>
                {value}
              </dd>
            </div>
          ))}
        </dl>
      </div>

      {/* Connections — plain text, grouped by relation */}
      <div className="flex-1 overflow-y-auto thin-scroll px-6 py-5">
        {loading && (
          <p className="font-sans text-xs text-ink-faint">Cargando relaciones…</p>
        )}

        {detail && (
          <div className="space-y-7">
            <EdgeList edges={detail.edges} neighbors={detail.neighbors} nodeId={node.id} direction="out" />
            <EdgeList edges={detail.edges} neighbors={detail.neighbors} nodeId={node.id} direction="in" />
            {!detail.edges.length && (
              <p className="font-sans text-xs text-ink-faint italic">
                Sin relaciones registradas en el corpus.
              </p>
            )}
          </div>
        )}
      </div>

      {/* Actions — text-only, underline-on-hover */}
      <div className="px-6 py-5 border-t border-rule space-y-3">
        {detail && (
          <button
            onClick={() => onExpandInGraph(detail)}
            className="btn-secondary block"
          >
            Expandir vecinos en el grafo
          </button>
        )}
        {node.url_html && (
          <a
            href={node.url_html}
            target="_blank"
            rel="noopener noreferrer"
            className="link-accent font-sans text-sm block"
          >
            Ver texto en BOE.es ↗
          </a>
        )}
        <p className="font-mono text-[10px] text-ink-faint pt-1 break-all">{node.id}</p>
      </div>
    </aside>
  )
}
