import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import Link from 'next/link'
import ChatPanel from '@/components/ChatPanel'
import './globals.css'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'Libro de Estatutos · Consejo de Ministros',
  description:
    'Análisis del corpus legislativo español: consolidación, derogaciones y referencias.',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="es" className={inter.variable}>
      <body className="min-h-screen flex flex-col">
        {/* ── Navigation ─────────────────────────────────────────────── */}
        <nav className="bg-navy-950 text-white">
          <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
            <Link href="/" className="flex items-center gap-3">
              <span className="text-xs font-semibold tracking-widest uppercase text-navy-200">
                Reversa
              </span>
              <span className="text-slate-600 select-none">·</span>
              <span className="text-sm font-medium text-white">
                Consejo de Ministros
              </span>
            </Link>

            <div className="flex items-center gap-8">
              <Link
                href="/"
                className="text-sm text-navy-200 hover:text-white transition-colors"
              >
                Análisis
              </Link>
              <Link
                href="/explore"
                className="text-sm text-navy-200 hover:text-white transition-colors"
              >
                Explorador
              </Link>
            </div>
          </div>
        </nav>

        {/* ── Page content ───────────────────────────────────────────── */}
        <main className="flex-1">{children}</main>

        {/* ── Chat assistant (floating, all pages) ───────────────────── */}
        <ChatPanel />

        {/* ── Footer ────────────────────────────────────────────────── */}
        <footer className="border-t border-slate-200 bg-white mt-auto">
          <div className="max-w-7xl mx-auto px-6 py-6 flex items-center justify-between text-xs text-slate-400">
            <span>
              Datos: Boletín Oficial del Estado · API pública (boe.es/datosabiertos)
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
