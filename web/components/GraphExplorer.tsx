'use client'

import dynamic from 'next/dynamic'
import {
  useCallback, useEffect, useMemo, useRef, useState,
} from 'react'
import { getBriefing, getSubgraph, searchNorms, getNorm, shortTitle } from '@/lib/api'
import type {
  Briefing, GraphData, GraphLink, GraphNode, NormDetail, Filters, EdgeType,
} from '@/lib/types'
import NodePanel from './NodePanel'

// SSR-safe dynamic import
const ForceGraph2D = dynamic(() => import('react-force-graph-2d'), {
  ssr: false,
  loading: () => (
    <div className="flex-1 flex items-center justify-center text-slate-400 text-sm">
      Inicializando el grafo…
    </div>
  ),
})

// ── Visual encoding ───────────────────────────────────────────────────────────

const EDGE_COLORS: Record<string, string> = {
  AMENDS:   '#3b82f6',
  REPEALS:  '#ef4444',
  CITES:    '#10b981',
  CORRECTS: '#f59e0b',
}

const EDGE_TYPES: { key: EdgeType; label: string; color: string }[] = [
  { key: 'AMENDS',   label: 'Modifica',  color: '#3b82f6' },
  { key: 'REPEALS',  label: 'Deroga',    color: '#ef4444' },
  { key: 'CITES',    label: 'Cita',      color: '#10b981' },
  { key: 'CORRECTS', label: 'Corrige',   color: '#f59e0b' },
]

function nodeColor(n: GraphNode): string {
  if (!n.in_corpus) return '#cbd5e1'
  if (n.is_dead)    return '#991b1b'
  return '#1e3a5f'
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

  const linkKey = (l: GraphLink) => {
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

// ── Sidebar controls ──────────────────────────────────────────────────────────

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

  return (
    <aside className="w-60 flex-shrink-0 bg-white border-r border-slate-200 flex flex-col">
      {/* Search */}
      <div className="px-4 pt-5 pb-4 border-b border-slate-100">
        <label className="text-xs font-semibold uppercase tracking-wide text-slate-400 block mb-2">
          Buscar norma
        </label>
        <input
          type="search"
          value={searchQuery}
          onChange={e => onSearchQuery(e.target.value)}
          placeholder="Título, ley, número…"
          className="w-full text-sm border border-slate-200 px-3 py-2 focus:outline-none focus:ring-1 focus:ring-navy-800 placeholder-slate-300"
        />
        {searchResults.length > 0 && (
          <ul className="mt-2 border border-slate-100 divide-y divide-slate-50 max-h-48 overflow-y-auto thin-scroll">
            {searchResults.map(r => (
              <li key={r.id}>
                <button
                  onClick={() => onSearchSelect(r)}
                  className="w-full text-left px-3 py-2 text-xs hover:bg-slate-50 transition-colors"
                >
                  <div className="font-medium text-slate-800 leading-snug">
                    {shortTitle(r.titulo, 55)}
                  </div>
                  {r.numero_oficial && (
                    <div className="text-slate-400 mt-0.5">Ley {r.numero_oficial}</div>
                  )}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Relationship type filter */}
      <div className="px-4 py-4 border-b border-slate-100">
        <div className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-3">
          Tipo de relación
        </div>
        <div className="space-y-2">
          {EDGE_TYPES.map(({ key, label, color }) => (
            <label key={key} className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={filters.edgeTypes.has(key)}
                onChange={() => toggleEdge(key)}
                className="w-3.5 h-3.5 accent-navy-800"
              />
              <span className="w-3 h-0.5 inline-block rounded" style={{ background: color }} />
              <span className="text-xs text-slate-600">{label}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Status filter */}
      <div className="px-4 py-4 border-b border-slate-100">
        <div className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-3">
          Estado
        </div>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={filters.liveOnly}
            onChange={e => onFilters({ ...filters, liveOnly: e.target.checked })}
            className="w-3.5 h-3.5 accent-navy-800"
          />
          <span className="text-xs text-slate-600">Solo normas en vigor</span>
        </label>
      </div>

      {/* Year range */}
      <div className="px-4 py-4 border-b border-slate-100">
        <div className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-3">
          Año de disposición
        </div>
        <div className="flex items-center gap-2">
          <input
            type="number"
            value={filters.yearMin}
            onChange={e => onFilters({ ...filters, yearMin: parseInt(e.target.value) || 1800 })}
            className="w-20 text-xs border border-slate-200 px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-navy-800"
            min={1800} max={2026}
          />
          <span className="text-slate-400 text-xs">–</span>
          <input
            type="number"
            value={filters.yearMax}
            onChange={e => onFilters({ ...filters, yearMax: parseInt(e.target.value) || 2026 })}
            className="w-20 text-xs border border-slate-200 px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-navy-800"
            min={1800} max={2026}
          />
        </div>
      </div>

      {/* Node legend */}
      <div className="px-4 py-4 mt-auto">
        <div className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-3">
          Nodos
        </div>
        <div className="space-y-1.5">
          {[
            { color: '#1e3a5f', label: 'En vigor' },
            { color: '#991b1b', label: 'Derogada' },
            { color: '#cbd5e1', label: 'Sin ID BOE' },
          ].map(({ color, label }) => (
            <div key={label} className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: color }} />
              <span className="text-xs text-slate-500">{label}</span>
            </div>
          ))}
        </div>
        {loading && (
          <p className="text-xs text-slate-400 mt-4 italic">Cargando corpus…</p>
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
  const [loading,  setLoading]  = useState(true)

  const [selected, setSelected]     = useState<GraphNode | null>(null)
  const [hovered,  setHovered]      = useState<GraphNode | null>(null)

  const [searchQuery,   setSearchQuery]   = useState('')
  const [searchResults, setSearchResults] = useState<GraphNode[]>([])

  const [filters, setFilters] = useState<Filters>({
    edgeTypes: new Set(['AMENDS', 'REPEALS', 'CITES', 'CORRECTS'] as EdgeType[]),
    liveOnly:  false,
    yearMin:   1800,
    yearMax:   2026,
  })

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

  // ── Initial load ────────────────────────────────────────────────────────────
  useEffect(() => {
    let active = true
    setLoading(true)

    const load = async () => {
      // Seed from top briefing results (highest-degree nodes in the corpus)
      const [b1, b2] = await Promise.all([getBriefing(1), getBriefing(2)])

      const seedIds = [
        ...(b1?.results ?? []).slice(0, 5).map(r => r.id),
        ...(b2?.results ?? []).slice(0, 5).map(r => r.id),
      ].filter(Boolean) as string[]

      // Fallback if briefings not generated yet
      if (!seedIds.length) {
        setLoading(false)
        return
      }

      // Fetch 1-hop subgraphs for each seed in parallel
      const subs = await Promise.all(
        seedIds.map(id => getSubgraph(id, 1, [], 200).catch(() => null)),
      )

      if (!active) return

      let merged: { nodes: GraphNode[]; links: GraphLink[] } = { nodes: [], links: [] }
      for (const sg of subs) {
        if (sg) merged = mergeInto(merged, { nodes: sg.nodes as GraphNode[], edges: sg.edges })
      }

      setAllNodes(merged.nodes)
      setAllLinks(merged.links)
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

  // ── Expand node on click ────────────────────────────────────────────────────
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
    // Center graph on node
    if (node.x != null && node.y != null) {
      graphRef.current?.centerAt(node.x, node.y, 600)
      graphRef.current?.zoom(3, 600)
    }
  }, [])

  const handleSearchSelect = useCallback(async (node: GraphNode) => {
    setSearchQuery('')
    setSearchResults([])

    const existing = allNodes.find(n => n.id === node.id)
    if (existing?.x != null) {
      setSelected(existing)
      graphRef.current?.centerAt(existing.x, existing.y, 600)
      graphRef.current?.zoom(3, 600)
      return
    }
    // Node not in graph yet — fetch and add
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

  // ── Canvas paint ────────────────────────────────────────────────────────────
  const paintNode = useCallback((rawNode: object, ctx: CanvasRenderingContext2D, globalScale: number) => {
    const node = rawNode as GraphNode
    const deg  = nodeDegree.get(node.id) ?? 0
    const r    = 3 + Math.min(deg, 40) * 0.18
    const isSelected = selected?.id === node.id
    const isHovered  = hovered?.id  === node.id

    // Selected ring
    if (isSelected) {
      ctx.beginPath()
      ctx.arc(node.x!, node.y!, r + 4, 0, 2 * Math.PI)
      ctx.fillStyle = 'rgba(245,158,11,0.3)'
      ctx.fill()
    } else if (isHovered) {
      ctx.beginPath()
      ctx.arc(node.x!, node.y!, r + 2, 0, 2 * Math.PI)
      ctx.fillStyle = 'rgba(100,116,139,0.2)'
      ctx.fill()
    }

    // Main circle
    ctx.beginPath()
    ctx.arc(node.x!, node.y!, r, 0, 2 * Math.PI)
    ctx.fillStyle = nodeColor(node)
    ctx.fill()

    // Label — show at high zoom or if selected/hovered
    if (globalScale >= 2.5 || isSelected || isHovered) {
      const label = node.numero_oficial
        ? `Ley ${node.numero_oficial}`
        : (node.titulo?.slice(0, 20) ?? node.id.slice(0, 12))
      const fontSize = Math.max(7, 11 / globalScale)
      ctx.font = `${fontSize}px Inter, system-ui, sans-serif`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'top'
      ctx.fillStyle = isSelected ? '#92400e' : '#334155'
      ctx.fillText(label, node.x!, node.y! + r + 2)
    }
  }, [nodeDegree, selected, hovered])

  const paintNodePointer = useCallback((rawNode: object, color: string, ctx: CanvasRenderingContext2D) => {
    const node = rawNode as GraphNode
    const deg  = nodeDegree.get(node.id) ?? 0
    const r    = 3 + Math.min(deg, 40) * 0.18 + 4
    ctx.beginPath()
    ctx.arc(node.x!, node.y!, r, 0, 2 * Math.PI)
    ctx.fillStyle = color
    ctx.fill()
  }, [nodeDegree])

  // ── Node count for HUD ──────────────────────────────────────────────────────
  const hud = `${graphData.nodes.length.toLocaleString('es-ES')} nodos · ${graphData.links.length.toLocaleString('es-ES')} aristas`

  return (
    <div className="flex h-full overflow-hidden">
      {/* Filters sidebar */}
      <FilterPanel
        filters={filters}
        onFilters={setFilters}
        searchQuery={searchQuery}
        onSearchQuery={setSearchQuery}
        searchResults={searchResults}
        onSearchSelect={handleSearchSelect}
        loading={loading}
      />

      {/* Graph canvas */}
      <div className="flex-1 relative bg-slate-50 overflow-hidden graph-canvas">
        {/* HUD */}
        <div className="absolute top-3 right-4 z-10 text-xs text-slate-400 bg-white/80 px-2 py-1 border border-slate-100">
          {hud}
        </div>

        {loading && !allNodes.length && (
          <div className="absolute inset-0 flex items-center justify-center z-10">
            <div className="text-slate-400 text-sm text-center">
              <div className="mb-2">Cargando nodos del corpus…</div>
              <div className="text-xs">Esto puede tardar unos segundos en el primer acceso.</div>
            </div>
          </div>
        )}

        {!loading && !allNodes.length && (
          <div className="absolute inset-0 flex items-center justify-center z-10">
            <div className="text-slate-400 text-sm text-center max-w-xs">
              <div className="mb-2">No hay datos disponibles.</div>
              <div className="text-xs">
                Ejecute el ingest completo y luego <code>briefings.py</code> antes de usar el explorador.
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
          linkColor={(l: any) => EDGE_COLORS[l.type] ?? '#94a3b8'}
          linkWidth={1}
          linkDirectionalArrowLength={3}
          linkDirectionalArrowRelPos={1}
          nodeCanvasObject={paintNode}
          nodePointerAreaPaint={paintNodePointer}
          onNodeClick={handleNodeClick}
          onNodeHover={(n: object | null) => setHovered(n ? n as GraphNode : null)}
          backgroundColor="#f8fafc"
          cooldownTicks={100}
          d3VelocityDecay={0.4}
          enableNodeDrag
          enableZoomInteraction
          enablePanInteraction
        />
      </div>

      {/* Node detail panel */}
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
