'use client'

import {
  useCallback, useEffect, useRef, useState,
} from 'react'
import { askQuestion } from '@/lib/api'
import type { AskResponse } from '@/lib/types'

// ── Types ─────────────────────────────────────────────────────────────────────

interface Message {
  id: string
  question: string
  response: AskResponse | null
  loading: boolean
  networkError: string | null
}

// ── Sub-components ────────────────────────────────────────────────────────────

function CypherBlock({ cypher }: { cypher: string }) {
  const [open, setOpen] = useState(false)
  const [copied, setCopied] = useState(false)

  const copy = () => {
    navigator.clipboard.writeText(cypher).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    })
  }

  return (
    <div className="mt-2">
      <button
        onClick={() => setOpen(o => !o)}
        className="text-xs text-slate-400 hover:text-navy-800 transition-colors flex items-center gap-1"
      >
        <span className="font-mono">{open ? '▲' : '▼'}</span>
        {open ? 'Ocultar consulta' : 'Ver consulta Cypher'}
      </button>

      {open && (
        <div className="mt-2 relative">
          <pre className="text-xs bg-slate-50 border border-slate-100 p-3 overflow-x-auto font-mono text-slate-600 leading-relaxed whitespace-pre-wrap break-all">
            {cypher}
          </pre>
          <button
            onClick={copy}
            className="absolute top-2 right-2 text-xs text-slate-400 hover:text-navy-800 transition-colors bg-slate-50 px-1.5 py-0.5 border border-slate-200"
          >
            {copied ? '✓' : 'Copiar'}
          </button>
        </div>
      )}
    </div>
  )
}

function ResultTable({ columns, rows, rowCount }: {
  columns: string[]
  rows: AskResponse['rows']
  rowCount: number
}) {
  const shown = rows.slice(0, 20)

  return (
    <div className="mt-3 overflow-x-auto">
      <table className="w-full text-xs border-collapse">
        <thead>
          <tr>
            {columns.map(col => (
              <th
                key={col}
                className="text-left py-1.5 px-2 bg-slate-50 border-b border-slate-200 text-slate-400 uppercase tracking-wide font-semibold whitespace-nowrap"
                style={{ fontSize: '10px' }}
              >
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {shown.map((row, i) => (
            <tr key={i} className="border-b border-slate-50 hover:bg-slate-50">
              {row.map((cell, j) => (
                <td
                  key={j}
                  className="py-1.5 px-2 text-slate-700 max-w-[180px] align-top"
                  title={cell === null ? '' : String(cell)}
                >
                  <span className="block truncate">
                    {cell === null || cell === undefined
                      ? <span className="text-slate-300">—</span>
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
        <p className="text-xs text-slate-400 mt-1.5 italic">
          Mostrando 20 de {rowCount.toLocaleString('es-ES')} resultados.
        </p>
      )}
      {rowCount === 0 && (
        <p className="text-xs text-slate-400 mt-1.5 italic">
          La consulta no devolvió resultados.
        </p>
      )}
    </div>
  )
}

function ResponseBlock({ msg }: { msg: Message }) {
  if (msg.loading) {
    return (
      <div className="mt-1 text-xs text-slate-400 italic animate-pulse">
        Consultando el corpus…
      </div>
    )
  }

  if (msg.networkError) {
    return (
      <div className="mt-1 text-xs text-red-600 bg-red-50 border border-red-100 px-3 py-2">
        {msg.networkError}
      </div>
    )
  }

  const r = msg.response
  if (!r) return null

  return (
    <div className="mt-2 text-sm">
      {/* Explanation — the answer the minister reads first */}
      {r.explanation && (
        <p className="text-slate-700 leading-relaxed">{r.explanation}</p>
      )}

      {/* Neo4j or LLM execution error */}
      {r.error && (
        <div className="mt-2 text-xs text-red-700 bg-red-50 border border-red-100 px-3 py-2 font-mono">
          {r.error}
        </div>
      )}

      {/* Cypher (collapsible — shows the workings) */}
      {r.cypher && <CypherBlock cypher={r.cypher} />}

      {/* Results table */}
      {r.columns.length > 0 && !r.error && (
        <ResultTable columns={r.columns} rows={r.rows} rowCount={r.row_count} />
      )}
    </div>
  )
}

// ── Suggested questions ───────────────────────────────────────────────────────

const SUGGESTIONS = [
  '¿Cuáles son las 5 leyes más modificadas que siguen en vigor?',
  '¿Qué ministerios han emitido más normas derogadas?',
  '¿Cuántas leyes autonómicas citan la Ley 30/1992?',
  'Show the 10 oldest norms still in force',
]

// ── Main panel ────────────────────────────────────────────────────────────────

export default function ChatPanel() {
  const [open,     setOpen]     = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [input,    setInput]    = useState('')
  const [busy,     setBusy]     = useState(false)
  const scrollRef  = useRef<HTMLDivElement>(null)
  const inputRef   = useRef<HTMLInputElement>(null)

  // Scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])

  // Focus input when panel opens
  useEffect(() => {
    if (open) inputRef.current?.focus()
  }, [open])

  const submit = useCallback(async (question?: string) => {
    const q = (question ?? input).trim()
    if (!q || busy) return

    setInput('')
    setBusy(true)

    const id = `${Date.now()}-${Math.random()}`
    setMessages(prev => [
      ...prev,
      { id, question: q, response: null, loading: true, networkError: null },
    ])

    try {
      const response = await askQuestion(q)
      setMessages(prev =>
        prev.map(m => m.id === id ? { ...m, response, loading: false } : m),
      )
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error de red'
      setMessages(prev =>
        prev.map(m =>
          m.id === id ? { ...m, loading: false, networkError: msg } : m,
        ),
      )
    } finally {
      setBusy(false)
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [input, busy])

  const onKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      submit()
    }
  }

  const clear = () => {
    setMessages([])
    setInput('')
  }

  return (
    <>
      {/* ── Floating toggle ──────────────────────────────────────────── */}
      <button
        onClick={() => setOpen(o => !o)}
        className="fixed bottom-4 right-4 z-50 flex items-center gap-2 bg-navy-950 text-white text-sm px-4 py-2.5 shadow-lg hover:bg-navy-900 transition-colors"
        aria-label={open ? 'Cerrar asistente' : 'Abrir asistente legislativo'}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 20 20"
          fill="currentColor"
          className="w-4 h-4 opacity-70"
        >
          <path
            fillRule="evenodd"
            d="M2 5a2 2 0 012-2h12a2 2 0 012 2v8a2 2 0 01-2 2H6l-4 4V5z"
            clipRule="evenodd"
          />
        </svg>
        {open ? 'Cerrar' : 'Consultar'}
      </button>

      {/* ── Chat panel ───────────────────────────────────────────────── */}
      {open && (
        <div
          role="dialog"
          aria-label="Asistente legislativo"
          className="fixed bottom-16 right-4 z-50 w-[420px] flex flex-col bg-white border border-slate-200 shadow-xl"
          style={{ height: '580px' }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 bg-navy-950 text-white flex-shrink-0">
            <div>
              <span className="text-sm font-semibold">Asistente legislativo</span>
              <span className="ml-2 text-navy-300 text-xs">Solo lectura · claude-sonnet-4-5</span>
            </div>
            <div className="flex items-center gap-3">
              {messages.length > 0 && (
                <button
                  onClick={clear}
                  className="text-navy-300 hover:text-white text-xs transition-colors"
                >
                  Borrar
                </button>
              )}
              <button
                onClick={() => setOpen(false)}
                className="text-navy-300 hover:text-white text-lg leading-none transition-colors"
                aria-label="Cerrar"
              >
                ×
              </button>
            </div>
          </div>

          {/* Messages */}
          <div
            ref={scrollRef}
            className="flex-1 overflow-y-auto thin-scroll p-4 space-y-5"
          >
            {/* Empty state */}
            {!messages.length && (
              <div className="pt-4">
                <p className="text-slate-500 text-sm mb-5 leading-relaxed">
                  Pregunte sobre el corpus legislativo español en español
                  o en inglés. La consulta generada es visible para que
                  pueda verificar la respuesta.
                </p>
                <div className="space-y-2">
                  <p className="text-xs text-slate-400 uppercase tracking-wide font-semibold mb-2">
                    Ejemplos
                  </p>
                  {SUGGESTIONS.map(s => (
                    <button
                      key={s}
                      onClick={() => submit(s)}
                      className="block w-full text-left text-xs text-slate-600 hover:text-navy-800 hover:bg-slate-50 px-3 py-2 border border-slate-100 transition-colors"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Message pairs */}
            {messages.map(msg => (
              <div key={msg.id}>
                {/* Question bubble */}
                <div className="flex justify-end mb-2">
                  <div className="bg-navy-800 text-white text-sm px-3 py-2 max-w-[85%] leading-snug">
                    {msg.question}
                  </div>
                </div>

                {/* Response block */}
                <div className="ml-1">
                  <ResponseBlock msg={msg} />
                </div>
              </div>
            ))}
          </div>

          {/* Input */}
          <div className="border-t border-slate-200 p-3 flex-shrink-0">
            <div className="flex gap-2">
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={onKey}
                placeholder="Pregunte sobre el corpus…"
                disabled={busy}
                className="flex-1 text-sm border border-slate-200 px-3 py-2 focus:outline-none focus:ring-1 focus:ring-navy-800 placeholder-slate-300 disabled:opacity-50"
              />
              <button
                onClick={() => submit()}
                disabled={busy || !input.trim()}
                className="bg-navy-800 text-white text-sm px-4 py-2 hover:bg-navy-900 transition-colors disabled:opacity-30 disabled:cursor-not-allowed flex-shrink-0"
                aria-label="Enviar"
              >
                {busy ? (
                  <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  '→'
                )}
              </button>
            </div>
            <p className="text-xs text-slate-400 mt-1.5">
              Las consultas son de solo lectura. La IA puede cometer errores — verifique el Cypher.
            </p>
          </div>
        </div>
      )}
    </>
  )
}
