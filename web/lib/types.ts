// ── Norm ──────────────────────────────────────────────────────────────────────

export interface Norm {
  id: string
  titulo?: string
  numero_oficial?: string
  rango?: string
  ambito?: string
  departamento?: string
  fecha_disposicion?: string   // "YYYYMMDD"
  fecha_publicacion?: string
  fecha_vigencia?: string
  fecha_derogacion?: string
  estatus_derogacion?: 'S' | 'N'
  vigencia_agotada?: 'S' | 'N'
  estatus_anulacion?: 'S' | 'N'
  is_dead?: boolean
  in_corpus?: boolean
  url_eli?: string
  url_html?: string
  fecha_actualizacion?: string
}

export interface NormEdge {
  source: string
  target: string
  type: 'AMENDS' | 'REPEALS' | 'CITES' | 'CORRECTS'
  relacion_texto?: string
  detail?: string
  is_partial?: boolean
}

export interface NormDetail {
  norm: Norm
  neighbors: Norm[]
  edges: NormEdge[]
}

// ── Search ────────────────────────────────────────────────────────────────────

export interface SearchResult {
  id: string
  titulo?: string
  numero_oficial?: string
  rango?: string
  fecha_disposicion?: string
  departamento?: string
  ambito?: string
  is_dead?: boolean
}

export interface SearchResponse {
  query: string
  count: number
  results: SearchResult[]
}

// ── Subgraph ──────────────────────────────────────────────────────────────────

export interface SubgraphData {
  root: string
  depth: number
  node_count: number
  edge_count: number
  nodes: Norm[]
  edges: NormEdge[]
}

// ── Briefings ─────────────────────────────────────────────────────────────────

export interface BriefingResult {
  rank: number
  id: string
  titulo?: string
  numero_oficial?: string
  rango?: string
  fecha_disposicion?: string
  departamento?: string
  is_dead?: boolean
  // Briefing 1
  amendment_count?: number
  unique_amenders?: number
  // Briefing 2
  total_actions?: number
  unique_targets?: number
  // Briefing 3 ghosts
  fecha_derogacion?: string
  cited_by_count?: number
  // Briefing 4
  relacion_tipo?: string
  detail?: string
}

export interface B3Percentage {
  total_in_force: number
  citing_dead: number
  pct_citing_dead: number
}

export interface Briefing {
  briefing: 1 | 2 | 3 | 4
  title: string
  question: string
  elapsed_ms: number | Record<string, number>
  generated_at?: string
  // B1, B2, B4
  results?: BriefingResult[]
  // B3
  percentage?: B3Percentage
  ghost_norms?: BriefingResult[]
  // B4
  ley30?: { id: string; titulo: string }
  warning?: string
}

// ── /ask ──────────────────────────────────────────────────────────────────────

export interface AskResponse {
  question: string
  explanation: string
  cypher: string | null
  columns: string[]
  rows: (string | number | boolean | null | Record<string, unknown>)[][]
  row_count: number
  error: string | null
  usage?: {
    input_tokens: number
    output_tokens: number
    cache_read_tokens: number
  }
}

// ── Graph types (for react-force-graph-2d) ───────────────────────────────────

export interface GraphNode extends Norm {
  // Added by force simulation
  x?: number
  y?: number
  vx?: number
  vy?: number
  // Computed
  degree?: number
}

export interface GraphLink {
  source: string | GraphNode
  target: string | GraphNode
  type: 'AMENDS' | 'REPEALS' | 'CITES' | 'CORRECTS'
  relacion_texto?: string
  detail?: string
  is_partial?: boolean
}

export interface GraphData {
  nodes: GraphNode[]
  links: GraphLink[]
}

// ── Filters ───────────────────────────────────────────────────────────────────

export type EdgeType = 'AMENDS' | 'REPEALS' | 'CITES' | 'CORRECTS'

export interface Filters {
  edgeTypes: Set<EdgeType>
  liveOnly: boolean
  yearMin: number
  yearMax: number
}
