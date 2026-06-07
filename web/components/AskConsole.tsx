'use client'

import {
  useCallback, useEffect, useRef, useState,
} from 'react'
import { askQuestion } from '@/lib/api'
import type { AskResponse } from '@/lib/types'
import CypherDisclosure from '@/components/CypherDisclosure'

// ── Types ─────────────────────────────────────────────────────────────────────

interface Exchange {
  id: string
  question: string
  response: AskResponse | null
  loading: boolean
  error: string | null
}

const SUGGESTIONS = [
  '¿Cuáles son las cinco leyes más modificadas que siguen en vigor?',
  '¿Qué ministerios han emitido más normas derogadas?',
  '¿Cuántas leyes autonómicas citan la Ley 30/1992?',
]

// ── Typewriter reveal — settles to full text once it is no longer the latest ──

function useTypewriter(text: string, active: boolean, speed = 15): string {
  const [shown, setShown] = useState('')

  useEffect(() => {
    if (!active) { setShown(text); return }
    if (!text) { setShown(''); return }
    setShown('')
    let i = 0
    const id = setInterval(() => {
      i += 1
      setShown(text.slice(0, i))
      if (i >= text.length) clearInterval(id)
    }, speed)
    return () => clearInterval(id)
  }, [text, active])

  return shown
}

// ── Results — editorial table, truncated ─────────────────────────────────────

function ResultTable({ columns, rows, rowCount }: {
  columns: string[]
  rows: AskResponse['rows']
  rowCount: number
}) {
  if (!columns.length) return null
  const shown = rows.slice(0, 20)

  return (
    <div className="mt-7 overflow-x-auto">
      <table className="table-editorial">
        <thead>
          <tr>{columns.map(c => <th key={c}>{c}</th>)}</tr>
        </thead>
        <tbody>
          {shown.map((row, i) => (
            <tr key={i}>
              {row.map((cell, j) => (
                <td key={j} className="font-sans text-sm text-ink-secondary max-w-[240px]">
                  <span className="block truncate" title={cell == null ? '' : String(cell)}>
                    {cell === null || cell === undefined
                      ? <span className="text-ink-faint">—</span>
                      : typeof cell === 'object'
                      ? JSON.stringify(cell)
                      : String(cell)}
                  </span>
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>

      {rowCount > 20 && (
        <p className="font-sans text-xs text-ink-faint mt-2.5 italic">
          Mostrando 20 de {rowCount.toLocaleString('es-ES')} resultados.
        </p>
      )}
      {rowCount === 0 && (
        <p className="font-sans text-xs text-ink-faint mt-2.5 italic">
          La consulta no devolvió resultados.
        </p>
      )}
    </div>
  )
}

// ── A single question/answer exchange ────────────────────────────────────────

function ExchangeBlock({ exchange, isLatest }: { exchange: Exchange; isLatest: boolean }) {
  const explanation = exchange.response?.explanation ?? ''
  const settled     = !isLatest || exchange.loading || !!exchange.error
  const typed       = useTypewriter(explanation, !settled)
  const finishedTyping = settled || typed.length >= explanation.length

  return (
    <div className="py-10 border-b border-rule">
      <p className="label-kicker mb-3">Pregunta</p>
      <p className="font-serif text-lg text-ink leading-snug mb-9 max-w-copy">{exchange.question}</p>

      {exchange.loading && (
        <p className="font-sans text-sm text-ink-faint italic">Consultando el ordenamiento…</p>
      )}

      {exchange.error && (
        <p className="font-sans text-sm text-danger">{exchange.error}</p>
      )}

      {exchange.response && (
        <div>
          <p className="label-kicker mb-3">Respuesta</p>

          {explanation && (
            <p className="font-serif text-xl text-ink leading-relaxed max-w-copy">
              {settled ? explanation : typed}
              {!settled && typed.length < explanation.length && (
                <span className="inline-block w-[2px] h-[1.05em] bg-ink align-text-bottom ml-0.5 animate-pulse" />
              )}
            </p>
          )}

          {exchange.response.error && (
            <p className="font-sans text-sm text-danger mt-5">{exchange.response.error}</p>
          )}

          {finishedTyping && exchange.response.cypher && (
            <div className="mt-8">
              <CypherDisclosure
                cypher={exchange.response.cypher}
                gloss="Esta es la consulta que el sistema generó y ejecutó contra el grafo para construir la respuesta anterior."
              />
            </div>
          )}

          {finishedTyping && !exchange.response.error && exchange.response.columns.length > 0 && (
            <ResultTable
              columns={exchange.response.columns}
              rows={exchange.response.rows}
              rowCount={exchange.response.row_count}
            />
          )}
        </div>
      )}
    </div>
  )
}

// ── Console ───────────────────────────────────────────────────────────────────

export default function AskConsole() {
  const [exchanges, setExchanges] = useState<Exchange[]>([])
  const [input, setInput] = useState('')
  const [busy, setBusy]   = useState(false)

  const inputRef  = useRef<HTMLInputElement>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => { inputRef.current?.focus() }, [])
  useEffect(() => {
    if (exchanges.length) bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [exchanges.length])

  const submit = useCallback(async (question?: string) => {
    const q = (question ?? input).trim()
    if (!q || busy) return

    setInput('')
    setBusy(true)
    const id = `${Date.now()}-${Math.random()}`
    setExchanges(prev => [...prev, { id, question: q, response: null, loading: true, error: null }])

    try {
      const response = await askQuestion(q)
      setExchanges(prev => prev.map(e => e.id === id ? { ...e, response, loading: false } : e))
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error de red al consultar el corpus.'
      setExchanges(prev => prev.map(e => e.id === id ? { ...e, loading: false, error: msg } : e))
    } finally {
      setBusy(false)
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [input, busy])

  const Field = (
    <form onSubmit={e => { e.preventDefault(); submit() }}>
      <input
        ref={inputRef}
        type="text"
        value={input}
        onChange={e => setInput(e.target.value)}
        disabled={busy}
        placeholder="Pregunte al ordenamiento jurídico…"
        className="w-full font-serif text-lg text-ink bg-transparent border-b border-rule focus:border-ink outline-none px-1 py-3 placeholder-ink-faint disabled:opacity-50 transition-colors duration-150"
      />
    </form>
  )

  if (!exchanges.length) {
    return (
      <div className="max-w-copy mx-auto px-6 md:px-0">
        <div className="min-h-[58vh] flex flex-col items-center justify-center text-center">
          <p className="label-kicker mb-4">Preguntar</p>
          <h1 className="font-serif text-display text-ink leading-tight mb-4 max-w-md">
            Pregunte al ordenamiento jurídico
          </h1>
          <p className="font-sans text-sm text-ink-faint mb-10 max-w-sm leading-relaxed">
            Formule su pregunta sobre el corpus de normas consolidadas del
            Boletín Oficial del Estado. La consulta a la base de datos queda
            siempre disponible para su verificación.
          </p>

          <div className="w-full max-w-md text-center">
            {Field}
          </div>

          <div className="mt-12 space-y-2.5">
            <p className="label-kicker mb-1">Ejemplos</p>
            {SUGGESTIONS.map(s => (
              <button
                key={s}
                onClick={() => submit(s)}
                className="block mx-auto font-sans text-sm text-ink-secondary hover:text-ink transition-colors duration-150"
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-copy mx-auto px-6 md:px-0 pb-20">
      {exchanges.map((ex, i) => (
        <ExchangeBlock key={ex.id} exchange={ex} isLatest={i === exchanges.length - 1} />
      ))}

      <div ref={bottomRef} className="pt-9 sticky bottom-0 bg-paper">
        {Field}
        <p className="font-sans text-xs text-ink-faint mt-2.5">
          Las consultas son de solo lectura. La respuesta puede contener errores — verifique la consulta generada.
        </p>
      </div>
    </div>
  )
}
