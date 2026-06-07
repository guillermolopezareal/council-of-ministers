'use client'

import { useState } from 'react'

interface CypherDisclosureProps {
  cypher: string
  label?: string
}

/** "Ver consulta" — the query stays hidden until the technically curious ask for it. */
export default function CypherDisclosure({ cypher, label = 'Ver consulta' }: CypherDisclosureProps) {
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
        <pre className="mt-3 text-xs font-mono text-ink-secondary bg-paper-raised border border-rule px-4 py-3 overflow-x-auto leading-relaxed whitespace-pre-wrap">
          {cypher}
        </pre>
      )}
    </div>
  )
}
