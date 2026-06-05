'use client'

import dynamic from 'next/dynamic'
import { useMemo } from 'react'
import type { Norm, NormEdge } from '@/lib/types'

// SSR-safe dynamic import — react-force-graph-2d uses canvas APIs
const ForceGraph2D = dynamic(() => import('react-force-graph-2d'), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-full text-slate-400 text-sm">
      Cargando grafo…
    </div>
  ),
})

interface SubGraphProps {
  nodes: Norm[]
  edges: NormEdge[]
  highlightIds?: string[]       // drawn larger + ring
  height?: number
}

// ── Color encoding ────────────────────────────────────────────────────────────

const EDGE_COLOR: Record<string, string> = {
  AMENDS:   '#3b82f6',   // blue
  REPEALS:  '#ef4444',   // red
  CITES:    '#10b981',   // green
  CORRECTS: '#f59e0b',   // amber
}

function nodeColor(n: Norm, highlighted: boolean): string {
  if (highlighted) return '#f59e0b'           // amber ring handled separately
  if (!n.in_corpus)  return '#9ca3af'         // stub → gray
  if (n.is_dead)     return '#991b1b'         // dead → dark red
  return '#1e3a5f'                             // alive → navy
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function SubGraph({
  nodes,
  edges,
  highlightIds = [],
  height = 340,
}: SubGraphProps) {
  const highlightSet = useMemo(() => new Set(highlightIds), [highlightIds])

  const graphData = useMemo(() => ({
    nodes: nodes.map(n => ({ ...n })),   // clone so ForceGraph2D can mutate
    links: edges.map(e => ({
      source: e.source,
      target: e.target,
      type:   e.type,
      color:  EDGE_COLOR[e.type] ?? '#94a3b8',
    })),
  }), [nodes, edges])

  if (!nodes.length) {
    return (
      <div
        style={{ height }}
        className="flex items-center justify-center text-slate-400 text-sm border border-slate-100 rounded"
      >
        Sin datos de grafo disponibles
      </div>
    )
  }

  return (
    <div className="graph-canvas border border-slate-100 rounded overflow-hidden" style={{ height }}>
      <ForceGraph2D
        graphData={graphData}
        width={undefined}               // flex to container
        height={height}
        nodeId="id"
        linkSource="source"
        linkTarget="target"
        linkColor={(l: any) => l.color ?? '#94a3b8'}
        linkWidth={1.5}
        linkDirectionalArrowLength={4}
        linkDirectionalArrowRelPos={1}
        nodeCanvasObject={(node: any, ctx, globalScale) => {
          const isHl = highlightSet.has(node.id)
          const r    = isHl ? 7 : 5

          // Highlight ring
          if (isHl) {
            ctx.beginPath()
            ctx.arc(node.x, node.y, r + 3, 0, 2 * Math.PI)
            ctx.fillStyle = 'rgba(245,158,11,0.25)'
            ctx.fill()
          }

          // Node circle
          ctx.beginPath()
          ctx.arc(node.x, node.y, r, 0, 2 * Math.PI)
          ctx.fillStyle = nodeColor(node as Norm, isHl)
          ctx.fill()

          // Label — always visible (small graph)
          const label = (
            (node as Norm).numero_oficial
              ? `Ley ${(node as Norm).numero_oficial}`
              : (node as Norm).titulo?.slice(0, 22) ?? node.id
          )
          const fontSize = Math.max(8, 11 / globalScale)
          ctx.font = `${fontSize}px Inter, sans-serif`
          ctx.textAlign = 'center'
          ctx.textBaseline = 'top'
          ctx.fillStyle = '#1e293b'
          ctx.fillText(label, node.x, node.y + r + 2)
        }}
        nodePointerAreaPaint={(node: any, color, ctx) => {
          ctx.beginPath()
          ctx.arc(node.x, node.y, 8, 0, 2 * Math.PI)
          ctx.fillStyle = color
          ctx.fill()
        }}
        cooldownTicks={80}
        d3VelocityDecay={0.4}
        backgroundColor="white"
      />
    </div>
  )
}

// ── Legend ────────────────────────────────────────────────────────────────────

export function SubGraphLegend() {
  return (
    <div className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-slate-500">
      {[
        { color: '#1e3a5f', label: 'En vigor' },
        { color: '#991b1b', label: 'Derogada' },
        { color: '#9ca3af', label: 'Sin ID BOE' },
      ].map(({ color, label }) => (
        <span key={label} className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ background: color }} />
          {label}
        </span>
      ))}
      <span className="text-slate-300 hidden sm:inline">·</span>
      {Object.entries(EDGE_COLOR).map(([type, color]) => (
        <span key={type} className="flex items-center gap-1.5 hidden sm:flex">
          <span className="w-4 h-0.5 inline-block" style={{ background: color }} />
          {type}
        </span>
      ))}
    </div>
  )
}
