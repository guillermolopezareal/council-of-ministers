'use client'

import dynamic from 'next/dynamic'
import { useMemo } from 'react'
import type { Norm, NormEdge } from '@/lib/types'

// SSR-safe dynamic import — react-force-graph-2d uses canvas APIs
const ForceGraph2D = dynamic(() => import('react-force-graph-2d'), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-full text-ink-faint text-sm font-sans">
      Cargando diagrama…
    </div>
  ),
})

interface SubGraphProps {
  nodes: Norm[]
  edges: NormEdge[]
  highlightIds?: string[]       // the briefing's focal norms — drawn in accent
  height?: number
}

// ── Muted, editorial color encoding — values rather than a rainbow legend ────

const EDGE_COLOR: Record<string, string> = {
  AMENDS:   '#9b9892',              // ink-faint
  REPEALS:  'rgba(122,46,42,0.55)', // danger, dimmed — repeal carries semantic weight
  CITES:    '#c7c3ba',              // lighter warm grey
  CORRECTS: '#5c5a55',              // ink-secondary
}

const ACCENT  = '#1f6b4a'
const INK     = '#1a1a1a'
const DANGER  = '#7a2e2a'
const STUB    = '#bab6ad'

function nodeColor(n: Norm): string {
  if (!n.in_corpus) return STUB
  if (n.is_dead)    return DANGER
  return INK
}

// Canvas `font` strings cannot resolve CSS custom properties — `var(--font-sans)`
// is invalid and silently ignored, leaving the canvas at its default size.
// Resolve the actual font-family list from the CSS variable once, at runtime.
function resolveSansFont(): string {
  if (typeof window === 'undefined') return 'system-ui, sans-serif'
  const v = getComputedStyle(document.documentElement).getPropertyValue('--font-sans').trim()
  return v || 'system-ui, sans-serif'
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function SubGraph({
  nodes,
  edges,
  highlightIds = [],
  height = 340,
}: SubGraphProps) {
  const highlightSet = useMemo(() => new Set(highlightIds), [highlightIds])
  const sansFont      = useMemo(() => resolveSansFont(), [])

  const graphData = useMemo(() => ({
    nodes: nodes.map(n => ({ ...n })),   // clone so ForceGraph2D can mutate
    links: edges.map(e => ({
      source: e.source,
      target: e.target,
      type:   e.type,
      color:  EDGE_COLOR[e.type] ?? '#c7c3ba',
    })),
  }), [nodes, edges])

  if (!nodes.length) {
    return (
      <div
        style={{ height }}
        className="flex items-center justify-center text-ink-faint text-sm font-sans border border-rule"
      >
        Sin datos de diagrama disponibles
      </div>
    )
  }

  return (
    <div className="graph-canvas border border-rule overflow-hidden" style={{ height }}>
      <ForceGraph2D
        graphData={graphData}
        width={undefined}               // flex to container
        height={height}
        nodeId="id"
        linkSource="source"
        linkTarget="target"
        linkColor={(l: any) => l.color ?? '#c7c3ba'}
        linkWidth={1}
        linkDirectionalArrowLength={3.5}
        linkDirectionalArrowRelPos={1}
        nodeCanvasObject={(node: any, ctx, globalScale) => {
          const isHl = highlightSet.has(node.id)
          const r    = isHl ? 6 : 4

          // Highlight ring — accent, drawn once, no glow/animation
          if (isHl) {
            ctx.beginPath()
            ctx.arc(node.x, node.y, r + 3, 0, 2 * Math.PI)
            ctx.strokeStyle = ACCENT
            ctx.lineWidth = 1.5
            ctx.stroke()
          }

          // Node circle
          ctx.beginPath()
          ctx.arc(node.x, node.y, r, 0, 2 * Math.PI)
          ctx.fillStyle = isHl ? ACCENT : nodeColor(node as Norm)
          ctx.fill()

          // Label — restrained, always visible (the diagram is small)
          const label = (
            (node as Norm).numero_oficial
              ? `Ley ${(node as Norm).numero_oficial}`
              : (node as Norm).titulo?.slice(0, 22) ?? node.id
          )
          // Keep label size constant on screen — don't let it balloon when zooming in
          const fontSize = 10 / globalScale
          ctx.font = `${fontSize}px ${sansFont}`
          ctx.textAlign = 'center'
          ctx.textBaseline = 'top'
          ctx.fillStyle = isHl ? '#1a1a1a' : '#5c5a55'
          ctx.fillText(label, node.x, node.y + r + 3)
        }}
        nodePointerAreaPaint={(node: any, color, ctx) => {
          ctx.beginPath()
          ctx.arc(node.x, node.y, 8, 0, 2 * Math.PI)
          ctx.fillStyle = color
          ctx.fill()
        }}
        cooldownTicks={80}
        d3VelocityDecay={0.45}
        backgroundColor="#fafaf7"
      />
    </div>
  )
}

// ── Legend — text only, no chrome ─────────────────────────────────────────────

export function SubGraphLegend() {
  return (
    <div className="flex flex-wrap gap-x-6 gap-y-1.5 font-sans text-xs text-ink-faint">
      {[
        { color: INK,    label: 'En vigor' },
        { color: DANGER, label: 'Derogada' },
        { color: STUB,   label: 'Sin ID BOE' },
        { color: ACCENT, label: 'Norma del informe', ring: true },
      ].map(({ color, label, ring }) => (
        <span key={label} className="flex items-center gap-1.5">
          <span
            className="w-2 h-2 rounded-full inline-block flex-shrink-0"
            style={ring ? { border: `1.5px solid ${color}` } : { background: color }}
          />
          {label}
        </span>
      ))}
    </div>
  )
}
