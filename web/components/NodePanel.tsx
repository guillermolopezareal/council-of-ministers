'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { getNorm, formatDate, shortTitle } from '@/lib/api'
import type { NormDetail, GraphNode, NormEdge } from '@/lib/types'

interface NodePanelProps {
  node: GraphNode | null
  onClose: () => void
  onExpandInGraph: (detail: NormDetail) => void
}

// ── Status badge ──────────────────────────────────────────────────────────────

function Status({ node }: { node: GraphNode }) {
  if (!node.in_corpus) return (
    <span className="px-2 py-0.5 text-xs bg-slate-100 text-slate-500 border border-slate-200">
      Sin ID BOE
    </span>
  )
  if (node.is_dead) return (
    <span className="px-2 py-0.5 text-xs bg-red-50 text-red-700 border border-red-200">
      Derogada
    </span>
  )
  return (
    <span className="px-2 py-0.5 text-xs bg-emerald-50 text-emerald-700 border border-emerald-200">
      En vigor
    </span>
  )
}

// ── Edge group ────────────────────────────────────────────────────────────────

const EDGE_LABEL: Record<string, { out: string; in: string; color: string }> = {
  AMENDS:   { out: 'Modifica',    in: 'Modificada por',   color: 'text-blue-600' },
  REPEALS:  { out: 'Deroga',      in: 'Derogada por',     color: 'text-red-600' },
  CITES:    { out: 'Cita',        in: 'Citada por',       color: 'text-emerald-600' },
  CORRECTS: { out: 'Corrige',     in: 'Corregida por',    color: 'text-amber-600' },
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

  // Group by type
  const byType = new Map<string, NormEdge[]>()
  for (const e of relevant) {
    const k = e.type
    if (!byType.has(k)) byType.set(k, [])
    byType.get(k)!.push(e)
  }

  return (
    <div className="space-y-4">
      {[...byType.entries()].map(([type, list]) => {
        const meta = EDGE_LABEL[type] ?? { out: type, in: type, color: 'text-slate-600' }
        const label = direction === 'out' ? meta.out : meta.in
        const shown = list.slice(0, 5)
        const extra = list.length - 5

        return (
          <div key={type}>
            <div className={`text-xs font-semibold uppercase tracking-wide mb-2 ${meta.color}`}>
              {label} ({list.length})
            </div>
            <ul className="space-y-1.5">
              {shown.map((e, i) => {
                const otherId = direction === 'out' ? e.target : e.source
                const other   = neighborMap.get(otherId)
                return (
                  <li key={i} className="text-xs text-slate-600 leading-snug">
                    <span className="font-medium text-slate-900">
                      {other
                        ? shortTitle(other.titulo, 55)
                        : otherId
                      }
                    </span>
                    {e.detail && (
                      <span className="text-slate-400 ml-1">— {e.detail.slice(0, 60)}</span>
                    )}
                  </li>
                )
              })}
              {extra > 0 && (
                <li className="text-xs text-slate-400 italic">
                  y {extra} más…
                </li>
              )}
            </ul>
          </div>
        )
      })}
    </div>
  )
}

// ── Panel ─────────────────────────────────────────────────────────────────────

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

  return (
    <aside className="flex flex-col h-full bg-white border-l border-slate-200 w-80 flex-shrink-0">
      {/* Header */}
      <div className="flex items-start justify-between px-5 pt-5 pb-4 border-b border-slate-100">
        <div className="flex-1 pr-3">
          <div className="mb-2">
            <Status node={node} />
          </div>
          <h3 className="text-sm font-semibold text-slate-900 leading-snug">
            {shortTitle(node.titulo, 80) || node.id}
          </h3>
        </div>
        <button
          onClick={onClose}
          className="text-slate-400 hover:text-slate-600 text-lg leading-none flex-shrink-0 mt-0.5"
          aria-label="Cerrar panel"
        >
          ×
        </button>
      </div>

      {/* Metadata */}
      <div className="px-5 py-4 border-b border-slate-100 grid grid-cols-2 gap-x-4 gap-y-3 text-xs">
        {[
          { label: 'Tipo', value: node.rango },
          { label: 'Fecha', value: formatDate(node.fecha_disposicion) },
          { label: 'Número', value: node.numero_oficial },
          { label: 'Ámbito', value: node.ambito },
          { label: 'ID BOE', value: node.id, mono: true },
        ].map(({ label, value, mono }) =>
          value ? (
            <div key={label}>
              <div className="text-slate-400 uppercase tracking-wide mb-0.5" style={{ fontSize: '10px' }}>
                {label}
              </div>
              <div className={`text-slate-700 leading-snug ${mono ? 'font-mono text-[10px]' : ''}`}>
                {value}
              </div>
            </div>
          ) : null,
        )}
      </div>

      {/* Connections */}
      <div className="flex-1 overflow-y-auto thin-scroll px-5 py-4">
        {loading && (
          <p className="text-slate-400 text-xs">Cargando relaciones…</p>
        )}

        {detail && (
          <div className="space-y-6">
            <EdgeList
              edges={detail.edges}
              neighbors={detail.neighbors}
              nodeId={node.id}
              direction="out"
            />
            <EdgeList
              edges={detail.edges}
              neighbors={detail.neighbors}
              nodeId={node.id}
              direction="in"
            />
            {!detail.edges.length && (
              <p className="text-slate-400 text-xs italic">
                Sin relaciones registradas en el corpus.
              </p>
            )}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="px-5 py-4 border-t border-slate-100 space-y-2">
        {detail && (
          <button
            onClick={() => onExpandInGraph(detail)}
            className="w-full text-xs bg-navy-800 text-white px-3 py-2 hover:bg-navy-900 transition-colors text-left"
          >
            Expandir vecinos en el grafo
          </button>
        )}
        {node.url_html && (
          <a
            href={node.url_html}
            target="_blank"
            rel="noopener noreferrer"
            className="block w-full text-xs text-navy-800 border border-navy-200 px-3 py-2 hover:bg-navy-50 transition-colors"
          >
            Ver texto en BOE.es ↗
          </a>
        )}
        <div className="text-xs text-slate-300 font-mono pt-1 truncate">{node.id}</div>
      </div>
    </aside>
  )
}
