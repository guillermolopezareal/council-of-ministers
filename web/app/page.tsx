import Link from 'next/link'
import { getBriefing, shortTitle } from '@/lib/api'
import type { Briefing } from '@/lib/types'
import HeroCanvas from '@/components/HeroCanvas'

// ── Answer distillation (one sentence from data) ──────────────────────────────

function distillAnswer(b: Briefing): string {
  switch (b.briefing) {
    case 1: {
      const top = b.results?.[0]
      if (!top) return 'Análisis pendiente de datos.'
      return `El ${top.titulo} encabeza la lista con ${top.amendment_count ?? '?'} modificaciones acumuladas de ${top.unique_amenders ?? '?'} leyes distintas.`
    }
    case 2: {
      const top = b.results?.[0]
      if (!top) return 'Análisis pendiente de datos.'
      const name = top.numero_oficial ? `La ley ${top.numero_oficial}` : top.titulo
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
    topBorder: 'border-blue-400',
    cardBg: 'linear-gradient(135deg, #1e3a5f 0%, #0d1e3a 100%)',
    tagColor: 'text-blue-300',
    num: '01',
  },
  {
    n: 2 as const,
    tag: 'Causa raíz',
    question: '¿Quién fabricó el desorden?',
    desc: 'Las leyes ómnibus que reescriben docenas de estatutos distintos en un solo acto.',
    topBorder: 'border-amber-400',
    cardBg: 'linear-gradient(135deg, #1e3a5f 0%, #2a1c06 100%)',
    tagColor: 'text-amber-300',
    num: '02',
  },
  {
    n: 3 as const,
    tag: 'La podredumbre',
    question: '¿Cuánto ordenamiento descansa sobre ley muerta?',
    desc: 'Normas vigentes que invocan leyes derogadas como si aún existiesen.',
    topBorder: 'border-red-400',
    cardBg: 'linear-gradient(135deg, #1e3a5f 0%, #1f0c0c 100%)',
    tagColor: 'text-red-300',
    num: '03',
  },
  {
    n: 4 as const,
    tag: 'El bisturí',
    question: 'La derogación inacabada de la Ley 30/1992.',
    desc: 'El inventario concreto de leyes que deben actualizarse para cerrar la operación.',
    topBorder: 'border-emerald-400',
    cardBg: 'linear-gradient(135deg, #1e3a5f 0%, #061a0f 100%)',
    tagColor: 'text-emerald-300',
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
      <section className="bg-navy-950 text-white relative overflow-hidden">
        <HeroCanvas />
        <div className="relative z-10 max-w-7xl mx-auto px-6 py-24 md:py-32">
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
      <section
        className="bg-navy-950 py-20 border-t border-white/5"
        style={{
          backgroundImage: 'radial-gradient(rgba(255,255,255,0.025) 1px, transparent 1px)',
          backgroundSize: '28px 28px',
        }}
      >
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid md:grid-cols-2 gap-6">
            {BRIEFING_META.map((meta, i) => {
              const data = briefings[i]
              const answer = data ? distillAnswer(data) : null

              return (
                <Link
                  key={meta.n}
                  href={`/briefings/${meta.n}`}
                  className={`group block border border-white/10 border-t-4 ${meta.topBorder} p-10 hover:shadow-2xl hover:shadow-black/50 hover:border-white/20 hover:-translate-y-0.5 transition-all duration-200`}
                  style={{ background: meta.cardBg }}
                >
                  <div className="flex items-start justify-between mb-6">
                    <span className={`text-xs font-semibold tracking-widest uppercase ${meta.tagColor}`}>
                      {meta.tag}
                    </span>
                    <span className={`text-5xl font-bold leading-none select-none ${meta.tagColor} opacity-20`}>
                      {meta.num}
                    </span>
                  </div>

                  <h2 className="text-xl font-bold text-white mb-3 leading-snug">
                    {meta.question}
                  </h2>

                  {answer ? (
                    <p className="text-navy-200 text-sm leading-relaxed mb-6">
                      {answer}
                    </p>
                  ) : (
                    <p className="text-navy-300 text-sm italic mb-6">
                      {meta.desc}
                    </p>
                  )}

                  <span className={`${meta.tagColor} text-sm font-medium group-hover:underline`}>
                    Leer el análisis completo →
                  </span>
                </Link>
              )
            })}
          </div>
        </div>
      </section>

      {/* ── Corpus footnote ──────────────────────────────────────────── */}
      <section className="border-t border-white/5 bg-navy-950">
        <div className="max-w-7xl mx-auto px-6 py-16 grid md:grid-cols-3 gap-10">
          {[
            { label: 'Normas consolidadas', value: '12 288' },
            { label: 'Normas en vigor', value: '~9 100' },
            { label: 'Relaciones jurídicas mapeadas', value: '100 000+' },
          ].map(stat => (
            <div key={stat.label}>
              <div className="text-5xl font-bold text-white mb-2">
                {stat.value}
              </div>
              <div className="text-sm text-white uppercase tracking-wide font-medium">
                {stat.label}
              </div>
            </div>
          ))}
        </div>
      </section>
    </>
  )
}
