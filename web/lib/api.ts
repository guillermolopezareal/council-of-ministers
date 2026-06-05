/**
 * Typed API client for the FastAPI backend.
 *
 * Set NEXT_PUBLIC_API_URL in .env.local (default: http://localhost:8000).
 * Works in both server and client components.
 */
import type {
  Briefing, NormDetail, SearchResponse, SubgraphData, EdgeType, AskResponse,
} from './types'

const BASE =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, '') ?? 'http://127.0.0.1:8000'

// ── Core fetch ────────────────────────────────────────────────────────────────

async function post<T>(path: string, body: unknown): Promise<T | null> {
  try {
    const res = await fetch(`${BASE}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      cache: 'no-store',
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: res.statusText }))
      throw new Error(err.detail ?? res.statusText)
    }
    return res.json() as Promise<T>
  } catch (e) {
    throw e   // re-throw so callers can show the message
  }
}

async function get<T>(
  path: string,
  opts?: RequestInit,
): Promise<T | null> {
  const url = `${BASE}${path}`
  try {
    const res = await fetch(url, {
      cache: 'no-store',
      ...opts,
    })
    if (!res.ok) {
      console.error(`[API] ${res.status} ${res.statusText} — ${url}`)
      return null
    }
    return res.json() as Promise<T>
  } catch (e) {
    console.error(`[API] fetch failed — ${url} —`, e)
    return null
  }
}

// ── Briefings (static, cache aggressively) ────────────────────────────────────

export function getBriefing(n: 1 | 2 | 3 | 4): Promise<Briefing | null> {
  return get<Briefing>(`/briefings/${n}`)
}

// ── Norm detail + neighbourhood ───────────────────────────────────────────────

export function getNorm(id: string): Promise<NormDetail | null> {
  return get<NormDetail>(`/norm/${encodeURIComponent(id)}`, {
    cache: 'no-store',
  })
}

// ── Search ────────────────────────────────────────────────────────────────────

export function searchNorms(
  q: string,
  limit = 20,
): Promise<SearchResponse | null> {
  return get<SearchResponse>(
    `/search?q=${encodeURIComponent(q)}&limit=${limit}`,
    { cache: 'no-store' },
  )
}

// ── Subgraph ──────────────────────────────────────────────────────────────────

export function getSubgraph(
  root: string,
  depth: 1 | 2 | 3 = 1,
  types: EdgeType[] = [],
  limit = 200,
): Promise<SubgraphData | null> {
  const typesParam = types.length ? `&types=${types.join(',')}` : ''
  return get<SubgraphData>(
    `/subgraph?root=${encodeURIComponent(root)}&depth=${depth}&limit=${limit}${typesParam}`,
    { cache: 'no-store' },
  )
}

// ── /ask ─────────────────────────────────────────────────────────────────────

export function askQuestion(question: string): Promise<AskResponse> {
  return post<AskResponse>('/ask', { question }) as Promise<AskResponse>
}

// ── Health ────────────────────────────────────────────────────────────────────

export function getHealth(): Promise<Record<string, unknown> | null> {
  return get('/health', { cache: 'no-store' })
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** "19920526" → "26 de mayo de 1992" */
export function formatDate(yyyymmdd?: string | null): string {
  if (!yyyymmdd || yyyymmdd.length < 8) return '—'
  const y = yyyymmdd.slice(0, 4)
  const m = parseInt(yyyymmdd.slice(4, 6)) - 1
  const d = parseInt(yyyymmdd.slice(6, 8))
  const months = [
    'enero','febrero','marzo','abril','mayo','junio',
    'julio','agosto','septiembre','octubre','noviembre','diciembre',
  ]
  return `${d} de ${months[m] ?? '?'} de ${y}`
}

export function normYear(norm: { fecha_disposicion?: string }): number {
  return parseInt(norm.fecha_disposicion?.slice(0, 4) ?? '0') || 0
}

export function shortTitle(titulo?: string | null, max = 80): string {
  if (!titulo) return '—'
  return titulo.length <= max ? titulo : titulo.slice(0, max - 1) + '…'
}
