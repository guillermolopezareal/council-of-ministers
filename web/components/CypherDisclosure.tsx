'use client'

import { useState } from 'react'

interface CypherDisclosureProps {
  cypher: string
  label?: string
  /** A short, plain-Spanish sentence describing what the query does — read before the code. */
  gloss?: string
}

/** "Ver consulta" — the query stays hidden until the technically curious ask for it. */
export default function CypherDisclosure({ cypher, label = 'Ver consulta', gloss }: CypherDisclosureProps) {
  const [open, setOpen] = useState(false)

  return (
    <div>
      <button
        onClick={() => setOpen(o => !o)}
        className="font-sans text-sm text-ink-faint hover:text-ink transition-colors duration-150"
      >
        {open ? 'Ocultar consulta' : label}
        <span className="ml-1.5 text-xs">{open ? '–' : '+'}</span>
      </button>

      {open && (
        <div className="mt-3 space-y-3 max-w-copy">
          {gloss && (
            <p className="font-sans text-sm text-ink-secondary leading-relaxed">
              {gloss}
            </p>
          )}
          <pre className="text-xs font-mono text-ink-secondary bg-paper-raised border border-rule px-4 py-3 overflow-x-auto leading-relaxed whitespace-pre-wrap">
            {cypher}
          </pre>
        </div>
      )}
    </div>
  )
}
