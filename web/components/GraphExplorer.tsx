'use client'

import dynamic from 'next/dynamic'
import {
  useCallback, useEffect, useMemo, useRef, useState,
} from 'react'
import { getBriefing, getSubgraph, searchNorms, getNorm, shortTitle } from '@/lib/api'
import type {
  GraphData, GraphLink, GraphNode, NormDetail, Filters, EdgeType,
} from '@/lib/types'
import NodePanel from './NodePanel'

// SSR-safe dynamic import
const ForceGraph2D = dynamic(() => import('react-force-graph-2d'), {
  ssr: false,
  loading: () => (
    <div className="flex-1 flex items-center justify-center text-ink-faint text-sm font-sans">
      Inicializando el diagrama…
    </div>
  ),
})

// ── Editorial visual encoding — same values as SubGraph, restrained ──────────

const INK    = '#1a1a1a'
const DANGER = '#7a2e2a'
const STUB   = '#bab6ad'
const ACCENT = '#1f6b4a'

const EDGE_COLORS: Record<string, string> = {
  AMENDS:   '#9b9892',
  REPEALS:  'rgba(122,46,42,0.5)',
  CITES:    '#c7c3ba',
  CORRECTS: '#5c5a55',
}

const EDGE_TYPES: { key: EdgeType; label: string; color: string }[] = [
  { key: 'AMENDS',   label: 'Modifica',  color: EDGE_COLORS.AMENDS },
  { key: 'REPEALS',  label: 'Deroga',    color: EDGE_COLORS.REPEALS },
  { key: 'CITES',    label: 'Cita',      color: EDGE_COLORS.CITES },
  { key: 'CORRECTS', label: 'Corrige',   color: EDGE_COLORS.CORRECTS },
]

const DECADE_MIN = 1800
const DECADE_MAX = 2030

function nodeColor(n: GraphNode): string {
  if (!n.in_corpus) return STUB
  if (n.is_dead)    return DANGER
  return INK
}

// ── Graph merging ─────────────────────────────────────────────────────────────

function mergeInto(
  prev: { nodes: GraphNode[]; links: GraphLink[] },
  incoming: { nodes: GraphNode[]; edges: { source: string; target: string; type: string }[] },
): { nodes: GraphNode[]; links: GraphLink[] } {
  const nodeMap = new Map<string, GraphNode>(prev.nodes.map(n => [n.id, n]))
  for (const n of incoming.nodes) {
    if (!nodeMap.has(n.id)) nodeMap.set(n.id, n as GraphNode)
  }

  const linkKey = (l: { source: string | GraphNode; target: string | GraphNode; type: string }) => {
    const s = typeof l.source === 'object' ? l.source.id : l.source
    const t = typeof l.target === 'object' ? l.target.id : l.target
    return `${s}::${t}::${l.type}`
  }
  const seen = new Set(prev.links.map(linkKey))
  const newLinks = [...prev.links]
  for (const e of incoming.edges) {
    const k = `${e.source}::${e.target}::${e.type}`
    if (!seen.has(k)) {
      seen.add(k)
      newLinks.push({ source: e.source, target: e.target, type: e.type as EdgeType })
    }
  }

  return { nodes: [...nodeMap.values()], links: newLinks }
}

// ── Curate the default view: keep the highest-degree nodes + the focal set ───

function curate(
  merged: { nodes: GraphNode[]; links: GraphLink[] },
  focalIds: string[],
  maxNodes = 90,
): { nodes: GraphNode[]; links: GraphLink[] } {
  const degree = new Map<string, number>()
  for (const l of merged.links) {
    const s = typeof l.source === 'object' ? l.source.id : l.source as string
    const t = typeof l.target === 'object' ? l.target.id : l.target as string
    degree.set(s, (degree.get(s) ?? 0) + 1)
    degree.set(t, (degree.get(t) ?? 0) + 1)
  }
  const focalSet = new Set(focalIds)
  const ranked = [...merged.nodes].sort((a, b) => {
    const fa = focalSet.has(a.id) ? 1 : 0
    const fb = focalSet.has(b.id) ? 1 : 0
    if (fa !== fb) return fb - fa
    return (degree.get(b.id) ?? 0) - (degree.get(a.id) ?? 0)
  })
  const kept = ranked.slice(0, maxNodes)
  const keptIds = new Set(kept.map(n => n.id))
  const links = merged.links.filter(l => {
    const s = typeof l.source === 'object' ? l.source.id : l.source as string
    const t = typeof l.target === 'object' ? l.target.id : l.target as string
    return keptIds.has(s) && keptIds.has(t)
  })
  return { nodes: kept, links }
}

// ── Sidebar — minimal, well-typed filters ────────────────────────────────────

function FilterPanel({
  filters, onFilters,
  searchQuery, onSearchQuery,
  searchResults, onSearchSelect,
  loading,
}: {
  filters: Filters
  onFilters: (f: Filters) => void
  searchQuery: string
  onSearchQuery: (q: string) => void
  searchResults: GraphNode[]
  onSearchSelect: (node: GraphNode) => void
  loading: boolean
}) {
  const toggleEdge = (t: EdgeType) => {
    const next = new Set(filters.edgeTypes)
    if (next.has(t)) next.delete(t); else next.add(t)
    onFilters({ ...filters, edgeTypes: next })
  }

  const decadeMin = Math.floor(filters.yearMin / 10) * 10
  const decadeMax = Math.ceil(filters.yearMax / 10) * 10

  return (
    <aside className="w-64 flex-shrink-0 border-r border-rule flex flex-col overflow-y-auto thin-scroll">
      {/* Search */}
      <div className="px-5 pt-6 pb-5 border-b border-rule">
        <label className="label-kicker block mb-2.5">Buscar norma</label>
        <input
          type="search"
          value={searchQuery}
          onChange={e => onSearchQuery(e.target.value)}
          placeholder="Título, ley, número…"
          className="w-full font-sans text-sm border border-rule px-3 py-2 bg-paper focus:outline-none focus:border-ink placeholder-ink-faint"
          style={{ borderRadius: '4px' }}
        />
        {searchResults.length > 0 && (
          <ul className="mt-2 border border-rule divide-y divide-rule max-h-52 overflow-y-auto thin-scroll">
            {searchResults.map(r => (
              <li key={r.id}>
                <button
                  onClick={() => onSearchSelect(r)}
                  className="w-full text-left px-3 py-2.5 font-sans text-xs hover:bg-paper-raised transition-colors duration-150"
                >
                  <div className="text-ink leading-snug">{shortTitle(r.titulo, 55)}</div>
                  {r.numero_oficial && (
                    <div className="text-ink-faint mt-0.5">Ley {r.numero_oficial}</div>
                  )}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Relationship type */}
      <div className="px-5 py-5 border-b border-rule">
        <div className="label-kicker mb-3">Tipo de relación</div>
        <div className="space-y-2.5">
          {EDGE_TYPES.map(({ key, label, color }) => (
            <label key={key} className="flex items-center gap-2.5 cursor-pointer group">
              <input
                type="checkbox"
                checked={filters.edgeTypes.has(key)}
                onChange={() => toggleEdge(key)}
                className="w-3.5 h-3.5 accent-ink"
              />
              <span className="w-4 h-px inline-block" style={{ background: color }} />
              <span className="font-sans text-sm text-ink-secondary group-hover:text-ink transition-colors duration-150">
                {label}
              </span>
            </label>
          ))}
        </div>
      </div>

      {/* Status */}
      <div className="px-5 py-5 border-b border-rule">
        <div className="label-kicker mb-3">Estado</div>
        <label className="flex items-center gap-2.5 cursor-pointer group">
          <input
            type="checkbox"
            checked={filters.liveOnly}
            onChange={e => onFilters({ ...filters, liveOnly: e.target.checked })}
            className="w-3.5 h-3.5 accent-ink"
          />
          <span className="font-sans text-sm text-ink-secondary group-hover:text-ink transition-colors duration-150">
            Solo normas en vigor
          </span>
        </label>
      </div>

      {/* Decade range */}
      <div className="px-5 py-5 border-b border-rule">
        <div className="label-kicker mb-1">Década de disposición</div>
        <div className="font-serif text-sm text-ink tabular-nums mb-3">
          {decadeMin} – {decadeMax}
        </div>
        <div className="space-y-3">
          <div>
            <div className="font-sans text-xs text-ink-faint mb-1">Desde</div>
            <input
              type="range"
              min={DECADE_MIN} max={DECADE_MAX} step={10}
              value={decadeMin}
              onChange={e => {
                const v = parseInt(e.target.value)
                onFilters({ ...filters, yearMin: Math.min(v, filters.yearMax) })
              }}
              className="w-full accent-ink"
            />
          </div>
          <div>
            <div className="font-sans text-xs text-ink-faint mb-1">Hasta</div>
            <input
              type="range"
              min={DECADE_MIN} max={DECADE_MAX} step={10}
              value={decadeMax}
              onChange={e => {
                const v = parseInt(e.target.value)
                onFilters({ ...filters, yearMax: Math.max(v, filters.yearMin) })
              }}
              className="w-full accent-ink"
            />
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="px-5 py-5 mt-auto">
        <div className="label-kicker mb-3">Nodos</div>
        <div className="space-y-2">
          {[
            { color: INK,    label: 'En vigor' },
            { color: DANGER, label: 'Derogada' },
            { color: STUB,   label: 'Sin ID BOE' },
            { color: ACCENT, label: 'Norma señalada en un informe', ring: true },
          ].map(({ color, label, ring }) => (
            <div key={label} className="flex items-center gap-2.5">
              <span
                className="w-2 h-2 rounded-full flex-shrink-0 inline-block"
                style={ring ? { border: `1.5px solid ${color}` } : { background: color }}
              />
              <span className="font-sans text-xs text-ink-faint">{label}</span>
            </div>
          ))}
        </div>
        {loading && (
          <p className="font-sans text-xs text-ink-faint mt-4 italic">Cargando corpus…</p>
        )}
      </div>
    </aside>
  )
}

// ── Main explorer ─────────────────────────────────────────────────────────────

export default function GraphExplorer() {
  const graphRef = useRef<any>(null)

  const [allNodes, setAllNodes] = useState<GraphNode[]>([])
  const [allLinks, setAllLinks] = useState<GraphLink[]>([])
  const [focalIds, setFocalIds] = useState<string[]>([])
  const [loading,  setLoading]  = useState(true)

  const [selected, setSelected] = useState<GraphNode | null>(null)
  const [hovered,  setHovered]  = useState<GraphNode | null>(null)

  const [searchQuery,   setSearchQuery]   = useState('')
  const [searchResults, setSearchResults] = useState<GraphNode[]>([])

  const [filters, setFilters] = useState<Filters>({
    edgeTypes: new Set(['AMENDS', 'REPEALS', 'CITES', 'CORRECTS'] as EdgeType[]),
    liveOnly:  false,
    yearMin:   DECADE_MIN,
    yearMax:   DECADE_MAX,
  })

  const focalSet = useMemo(() => new Set(focalIds), [focalIds])

  // ── Degree map for node sizing ──────────────────────────────────────────────
  const nodeDegree = useMemo(() => {
    const deg = new Map<string, number>()
    for (const l of allLinks) {
      const s = typeof l.source === 'object' ? l.source.id : l.source as string
      const t = typeof l.target === 'object' ? l.target.id : l.target as string
      deg.set(s, (deg.get(s) ?? 0) + 1)
      deg.set(t, (deg.get(t) ?? 0) + 1)
    }
    return deg
  }, [allLinks])

  // ── Filtered graph ──────────────────────────────────────────────────────────
  const graphData: GraphData = useMemo(() => {
    const visNodes = allNodes.filter(n => {
      if (filters.liveOnly && n.is_dead) return false
      const yr = parseInt(n.fecha_disposicion?.slice(0, 4) ?? '0')
      if (yr > 0 && (yr < filters.yearMin || yr > filters.yearMax)) return false
      return true
    })
    const vis = new Set(visNodes.map(n => n.id))
    const visLinks = allLinks.filter(l => {
      if (!filters.edgeTypes.has(l.type)) return false
      const s = typeof l.source === 'object' ? l.source.id : l.source as string
      const t = typeof l.target === 'object' ? l.target.id : l.target as string
      return vis.has(s) && vis.has(t)
    })
    return { nodes: visNodes, links: visLinks }
  }, [allNodes, allLinks, filters])

  // ── Initial load: curated view of high-degree + briefing focal nodes ────────
  useEffect(() => {
    let active = true
    setLoading(true)

    const load = async () => {
      const [b1, b2, b3, b4] = await Promise.all([
        getBriefing(1), getBriefing(2), getBriefing(3), getBriefing(4),
      ])

      const seeds = [
        b1?.results?.[0]?.id,
        b2?.results?.[0]?.id,
        b3?.ghost_norms?.[0]?.id,
        b4?.ley30?.id,
      ].filter(Boolean) as string[]
      const uniqueSeeds = [...new Set(seeds)]

      if (!uniqueSeeds.length) {
        setLoading(false)
        return
      }

      const subs = await Promise.all(
        uniqueSeeds.map(id => getSubgraph(id, 1, [], 70).catch(() => null)),
      )
      if (!active) return

      let merged: { nodes: GraphNode[]; links: GraphLink[] } = { nodes: [], links: [] }
      for (const sg of subs) {
        if (sg) merged = mergeInto(merged, { nodes: sg.nodes as GraphNode[], edges: sg.edges })
      }

      const curated = curate(merged, uniqueSeeds, 90)
      setFocalIds(uniqueSeeds)
      setAllNodes(curated.nodes)
      setAllLinks(curated.links)
      setLoading(false)
    }

    load()
    return () => { active = false }
  }, [])

  // ── Search (debounced) ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!searchQuery || searchQuery.length < 2) { setSearchResults([]); return }
    const t = setTimeout(async () => {
      const res = await searchNorms(searchQuery, 15)
      setSearchResults((res?.results ?? []) as GraphNode[])
    }, 300)
    return () => clearTimeout(t)
  }, [searchQuery])

  // ── Expand node neighborhood ────────────────────────────────────────────────
  const expandNode = useCallback(async (node: GraphNode, detail?: NormDetail) => {
    const d = detail ?? await getNorm(node.id)
    if (!d) return
    setAllNodes(prev => {
      const next = mergeInto(
        { nodes: prev, links: allLinks },
        { nodes: [d.norm, ...d.neighbors] as GraphNode[], edges: d.edges },
      )
      setAllLinks(next.links)
      return next.nodes
    })
  }, [allLinks])

  const handleNodeClick = useCallback(async (rawNode: object) => {
    const node = rawNode as GraphNode
    setSelected(node)
    setSearchQuery('')
    setSearchResults([])
    if (node.x != null && node.y != null) {
      graphRef.current?.centerAt(node.x, node.y, 500)
      graphRef.current?.zoom(3, 500)
    }
  }, [])

  const handleSearchSelect = useCallback(async (node: GraphNode) => {
    setSearchQuery('')
    setSearchResults([])

    const existing = allNodes.find(n => n.id === node.id)
    if (existing?.x != null) {
      setSelected(existing)
      graphRef.current?.centerAt(existing.x, existing.y, 500)
      graphRef.current?.zoom(3, 500)
      return
    }
    const detail = await getNorm(node.id)
    if (!detail) return
    const newNode = detail.norm as GraphNode
    setAllNodes(prev => {
      const next = mergeInto(
        { nodes: prev, links: allLinks },
        { nodes: [newNode, ...detail.neighbors as GraphNode[]], edges: detail.edges },
      )
      setAllLinks(next.links)
      return next.nodes
    })
    setSelected(newNode)
  }, [allNodes, allLinks])

  // ── Canvas paint — restrained: status color, accent for focal, weight on hover ──
  const paintNode = useCallback((rawNode: object, ctx: CanvasRenderingContext2D, globalScale: number) => {
    const node = rawNode as GraphNode
    const deg  = nodeDegree.get(node.id) ?? 0
    const r    = 2.5 + Math.min(deg, 40) * 0.15
    const isFocal    = focalSet.has(node.id)
    const isSelected = selected?.id === node.id
    const isHovered  = hovered?.id  === node.id

    // Selection ring — ink, thin
    if (isSelected) {
      ctx.beginPath()
      ctx.arc(node.x!, node.y!, r + 4.5, 0, 2 * Math.PI)
      ctx.strokeStyle = INK
      ctx.lineWidth = 1.25
      ctx.stroke()
    }

    // Focal ring — accent
    if (isFocal) {
      ctx.beginPath()
      ctx.arc(node.x!, node.y!, r + 2.5, 0, 2 * Math.PI)
      ctx.strokeStyle = ACCENT
      ctx.lineWidth = 1.25
      ctx.stroke()
    }

    // Main circle
    ctx.beginPath()
    ctx.arc(node.x!, node.y!, r, 0, 2 * Math.PI)
    ctx.fillStyle = isFocal ? ACCENT : nodeColor(node)
    ctx.fill()

    // Hover — subtle weight change only, no halo
    if (isHovered && !isSelected) {
      ctx.lineWidth = 1
      ctx.strokeStyle = 'rgba(26,26,26,0.45)'
      ctx.stroke()
    }

    // Label — shown at higher zoom, or when the node is meaningfully in focus
    if (globalScale >= 2.2 || isSelected || isHovered || isFocal) {
      const label = node.numero_oficial
        ? `Ley ${node.numero_oficial}`
        : (node.titulo?.slice(0, 20) ?? node.id.slice(0, 12))
      const fontSize = Math.max(7, 10.5 / globalScale)
      ctx.font = `${fontSize}px var(--font-sans), system-ui, sans-serif`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'top'
      ctx.fillStyle = (isSelected || isFocal) ? INK : '#5c5a55'
      ctx.fillText(label, node.x!, node.y! + r + 3)
    }
  }, [nodeDegree, selected, hovered, focalSet])

  const paintNodePointer = useCallback((rawNode: object, color: string, ctx: CanvasRenderingContext2D) => {
    const node = rawNode as GraphNode
    const deg  = nodeDegree.get(node.id) ?? 0
    const r    = 2.5 + Math.min(deg, 40) * 0.15 + 4
    ctx.beginPath()
    ctx.arc(node.x!, node.y!, r, 0, 2 * Math.PI)
    ctx.fillStyle = color
    ctx.fill()
  }, [nodeDegree])

  const hud = `${graphData.nodes.length.toLocaleString('es-ES')} nodos · ${graphData.links.length.toLocaleString('es-ES')} aristas`

  return (
    <div className="flex h-full overflow-hidden">
      <FilterPanel
        filters={filters}
        onFilters={setFilters}
        searchQuery={searchQuery}
        onSearchQuery={setSearchQuery}
        searchResults={searchResults}
        onSearchSelect={handleSearchSelect}
        loading={loading}
      />

      <div className="flex-1 relative bg-paper overflow-hidden graph-canvas">
        <div className="absolute top-3 right-4 z-10 font-sans text-xs text-ink-faint bg-paper/90 px-2.5 py-1 border border-rule tabular-nums">
          {hud}
        </div>

        {loading && !allNodes.length && (
          <div className="absolute inset-0 flex items-center justify-center z-10">
            <div className="font-sans text-ink-faint text-sm text-center">
              <div className="mb-1.5">Cargando nodos del corpus…</div>
              <div className="text-xs">Esto puede tardar unos segundos en el primer acceso.</div>
            </div>
          </div>
        )}

        {!loading && !allNodes.length && (
          <div className="absolute inset-0 flex items-center justify-center z-10">
            <div className="font-sans text-ink-faint text-sm text-center max-w-xs">
              <div className="mb-1.5">No hay datos disponibles.</div>
              <div className="text-xs">
                Ejecute el ingest completo y luego <code className="font-mono">briefings.py</code> antes de usar el explorador.
              </div>
            </div>
          </div>
        )}

        <ForceGraph2D
          ref={graphRef}
          graphData={graphData as any}
          nodeId="id"
          linkSource="source"
          linkTarget="target"
          linkColor={(l: any) => EDGE_COLORS[l.type] ?? '#c7c3ba'}
          linkWidth={1}
          linkDirectionalArrowLength={3}
          linkDirectionalArrowRelPos={1}
          nodeCanvasObject={paintNode}
          nodePointerAreaPaint={paintNodePointer}
          onNodeClick={handleNodeClick}
          onNodeHover={(n: object | null) => setHovered(n ? n as GraphNode : null)}
          backgroundColor="#fafaf7"
          cooldownTicks={100}
          d3VelocityDecay={0.4}
          enableNodeDrag
          enableZoomInteraction
          enablePanInteraction
        />
      </div>

      {selected && (
        <NodePanel
          node={selected}
          onClose={() => setSelected(null)}
          onExpandInGraph={(detail) => expandNode(selected, detail)}
        />
      )}
    </div>
  )
}
