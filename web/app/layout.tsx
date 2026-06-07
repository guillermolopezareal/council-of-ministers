import type { Metadata } from 'next'
import { Source_Serif_4, IBM_Plex_Sans } from 'next/font/google'
import Link from 'next/link'
import './globals.css'

const sourceSerif = Source_Serif_4({
  subsets: ['latin'],
  variable: '--font-serif',
  display: 'swap',
})

const plexSans = IBM_Plex_Sans({
  subsets: ['latin'],
  weight: ['400', '500'],
  variable: '--font-sans',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'El Libro de Estatutos · Consejo de Ministros',
  description:
    'Análisis del corpus legislativo español: consolidación, derogaciones y referencias cruzadas. Cuatro informes para el Consejo de Ministros.',
  icons: { icon: '/reversa-favicon.jpg', shortcut: '/reversa-favicon.jpg' },
}

const NAV_LINKS = [
  { href: '/', label: 'Informes' },
  { href: '/explore', label: 'Explorador' },
  { href: '/ask', label: 'Preguntar' },
]

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="es" className={`${sourceSerif.variable} ${plexSans.variable}`}>
      <body className="min-h-screen flex flex-col bg-paper text-ink">
        {/* ── Navigation ─────────────────────────────────────────────── */}
        <header className="border-b border-rule">
          <nav className="max-w-table mx-auto px-6 md:px-10 py-5 flex items-center justify-between">
            <Link href="/" className="flex items-baseline gap-3 group">
              <span className="font-serif text-lg leading-none text-ink">
                El Libro de Estatutos
              </span>
              <span className="hidden sm:inline label-kicker">
                Consejo de Ministros
              </span>
            </Link>

            <div className="flex items-center gap-7">
              {NAV_LINKS.map(l => (
                <Link
                  key={l.href}
                  href={l.href}
                  className="font-sans text-sm text-ink-secondary hover:text-ink transition-colors duration-150"
                >
                  {l.label}
                </Link>
              ))}
            </div>
          </nav>
        </header>

        {/* ── Page content ───────────────────────────────────────────── */}
        <main className="flex-1">{children}</main>

        {/* ── Footer ────────────────────────────────────────────────── */}
        <footer className="border-t border-rule mt-auto">
          <div className="max-w-table mx-auto px-6 md:px-10 py-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 font-sans text-xs text-ink-faint">
            <span>
              Fuente: Boletín Oficial del Estado · API de datos abiertos (boe.es/datosabiertos)
            </span>
            <span>
              Reversa AI · {new Date().getFullYear()}
            </span>
          </div>
        </footer>
      </body>
    </html>
  )
}
