import Link from 'next/link'
import { getBriefing, shortTitle } from '@/lib/api'
import type { Briefing } from '@/lib/types'

// ── Answer distillation (one sentence from data) ──────────────────────────────

function distillAnswer(b: Briefing): string {
  switch (b.briefing) {
    case 1: {
      const top = b.results?.[0]
      if (!top) return 'Análisis pendiente de datos.'
      return `El ${shortTitle(top.titulo, 70)} encabeza la lista con ${top.amendment_count ?? '?'} modificaciones acumuladas de ${top.unique_amenders ?? '?'} leyes distintas.`
    }
    case 2: {
      const top = b.results?.[0]
      if (!top) return 'Análisis pendiente de datos.'
      const name = top.numero_oficial ? `La ley ${top.numero_oficial}` : shortTitle(top.titulo, 55)
      return `${name} es la norma ómnibus más agresiva: reescribió ${top.unique_targets ?? '?'} leyes distintas en un solo acto.`
    }
    case 3: {
      const pct = b.percentage
      if (!pct) return 'Análisis pendiente de datos.'
      return `El ${pct.pct_citing_dead}% del ordenamiento jurídico vigente —${pct.citing_dead.toLocaleString('es-ES')} de ${pct.total_in_force.toLocaleString('es-ES')} normas— cita al menos una ley ya derogada.`
    }
    case 4: {
      const n = b.results?.length ?? 0
      if (b.warning) return 'Análisis pendiente de datos.'
      return `${n} leyes en vigor siguen citando la Ley 30/1992, derogada en abril de 2021 y sustituida por las Leyes 39/2015 y 40/2015.`
    }
  }
}

// ── Briefing card ─────────────────────────────────────────────────────────────

const BRIEFING_META = [
  {
    n: 1 as const,
    tag: 'Diagnóstico',
    question: '¿Qué leyes se han vuelto ilegibles?',
    desc: 'Las normas más modificadas son candidatas prioritarias a una redacción limpia.',
    color: 'border-navy-800',
    num: '01',
  },
  {
    n: 2 as const,
    tag: 'Causa raíz',
    question: '¿Quién fabricó el desorden?',
    desc: 'Las leyes ómnibus que reescriben docenas de estatutos distintos en un solo acto.',
    color: 'border-amber-700',
    num: '02',
  },
  {
    n: 3 as const,
    tag: 'La podredumbre',
    question: '¿Cuánto ordenamiento descansa sobre ley muerta?',
    desc: 'Normas vigentes que invocan leyes derogadas como si aún existiesen.',
    color: 'border-red-700',
    num: '03',
  },
  {
    n: 4 as const,
    tag: 'El bisturí',
    question: 'La derogación inacabada de la Ley 30/1992.',
    desc: 'El inventario concreto de leyes que deben actualizarse para cerrar la operación.',
    color: 'border-emerald-700',
    num: '04',
  },
]

// ── Page (server component) ───────────────────────────────────────────────────

export default async function LandingPage() {
  const briefings = await Promise.all([
    getBriefing(1), getBriefing(2), getBriefing(3), getBriefing(4),
  ])

  return (
    <>
      {/* ── Hero ─────────────────────────────────────────────────────── */}
      <section className="bg-navy-950 text-white">
        <div className="max-w-7xl mx-auto px-6 py-24 md:py-32">
          <p className="text-navy-200 text-xs font-semibold tracking-widest uppercase mb-4">
            Madrid, Moncloa — el problema que nadie puede ver
          </p>
          <h1 className="text-4xl md:text-6xl font-bold leading-tight max-w-3xl mb-8">
            El Libro de Estatutos
            <br />
            Español, visto por
            <br />
            primera vez.
          </h1>
          <p className="text-navy-200 text-lg max-w-xl leading-relaxed mb-10">
            12 288 normas consolidadas. Dos siglos de enmiendas, derogaciones y
            citas cruzadas. Cuatro preguntas que el Consejo de Ministros necesita
            responder esta semana.
          </p>
          <Link
            href="/explore"
            className="inline-flex items-center gap-2 bg-white text-navy-950 px-6 py-3 text-sm font-semibold hover:bg-navy-100 transition-colors"
          >
            Abrir el explorador
            <span aria-hidden>→</span>
          </Link>
        </div>
      </section>

      {/* ── Four briefings ───────────────────────────────────────────── */}
      <section className="max-w-7xl mx-auto px-6 py-20">
        <div className="grid md:grid-cols-2 gap-8">
          {BRIEFING_META.map((meta, i) => {
            const data = briefings[i]
            const answer = data ? distillAnswer(data) : null

            return (
              <Link
                key={meta.n}
                href={`/briefings/${meta.n}`}
                className={`
                  group block bg-white border border-slate-200 border-t-4 ${meta.color}
                  p-10 hover:shadow-md transition-shadow
                `}
              >
                <div className="flex items-start justify-between mb-6">
                  <span className="text-xs font-semibold tracking-widest text-slate-400 uppercase">
                    {meta.tag}
                  </span>
                  <span className="text-5xl font-bold text-slate-100 leading-none select-none">
                    {meta.num}
                  </span>
                </div>

                <h2 className="text-xl font-bold text-slate-900 mb-3 leading-snug">
                  {meta.question}
                </h2>

                {answer ? (
                  <p className="text-slate-600 text-sm leading-relaxed mb-6">
                    {answer}
                  </p>
                ) : (
                  <p className="text-slate-400 text-sm italic mb-6">
                    {meta.desc}
                  </p>
                )}

                <span className="text-navy-800 text-sm font-medium group-hover:underline">
                  Leer el análisis completo →
                </span>
              </Link>
            )
          })}
        </div>
      </section>

      {/* ── Corpus footnote ──────────────────────────────────────────── */}
      <section className="border-t border-slate-200 bg-white">
        <div className="max-w-7xl mx-auto px-6 py-12 grid md:grid-cols-3 gap-10">
          {[
            { label: 'Normas consolidadas', value: '12 288' },
            { label: 'Normas en vigor', value: '~9 100' },
            { label: 'Relaciones jurídicas mapeadas', value: '100 000+' },
          ].map(stat => (
            <div key={stat.label}>
              <div className="text-4xl font-bold text-navy-800 mb-2">
                {stat.value}
              </div>
              <div className="text-sm text-slate-500 uppercase tracking-wide font-medium">
                {stat.label}
              </div>
            </div>
          ))}
        </div>
      </section>
    </>
  )
}
