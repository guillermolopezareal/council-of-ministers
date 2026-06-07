import Link from 'next/link'
import { getBriefing, getHealth } from '@/lib/api'
import type { Briefing } from '@/lib/types'

// ── Headline figure + one-sentence answer, derived from real briefing data ────

interface Entry {
  n: 1 | 2 | 3 | 4
  question: string
  figure: string
  answer: string
}

function buildEntries(briefings: (Briefing | null)[]): Entry[] {
  const [b1, b2, b3, b4] = briefings

  const entries: Entry[] = [
    {
      n: 1,
      question: '¿Qué leyes se han vuelto ilegibles?',
      figure: b1?.results?.[0]?.amendment_count != null
        ? `${b1.results[0].amendment_count} modificaciones`
        : '—',
      answer: b1?.results?.[0]
        ? `La ${b1.results[0].numero_oficial ? `Ley ${b1.results[0].numero_oficial}` : 'norma principal'} es la más enmendada del corpus: ${b1.results[0].unique_amenders} leyes distintas la han alterado a lo largo de su vigencia.`
        : 'Análisis pendiente de datos.',
    },
    {
      n: 2,
      question: '¿Quién fabricó el desorden?',
      figure: b2?.results?.[0]?.unique_targets != null
        ? `${b2.results[0].unique_targets} normas reescritas`
        : '—',
      answer: b2?.results?.[0]
        ? `${b2.results[0].numero_oficial ? `La Ley ${b2.results[0].numero_oficial}` : 'Una sola norma'} modificó ${b2.results[0].unique_targets} leyes distintas en un único acto: la maniobra ómnibus más agresiva del ordenamiento.`
        : 'Análisis pendiente de datos.',
    },
    {
      n: 3,
      question: '¿Cuánto del ordenamiento descansa sobre ley muerta?',
      figure: b3?.percentage ? `${b3.percentage.pct_citing_dead}%` : '—',
      answer: b3?.percentage
        ? `${b3.percentage.citing_dead.toLocaleString('es-ES')} de las ${b3.percentage.total_in_force.toLocaleString('es-ES')} normas vigentes citan al menos una ley ya derogada, como si aún estuviese en vigor.`
        : 'Análisis pendiente de datos.',
    },
    {
      n: 4,
      question: 'La derogación inacabada de la Ley 30/1992',
      figure: b4?.results?.length != null && !b4?.warning
        ? `${b4.results.length} normas`
        : '—',
      answer: !b4?.warning && b4?.results?.length
        ? `Seis años después de su derogación, ${b4.results.length} leyes en vigor siguen citando directamente la Ley 30/1992 como si el marco que la sustituyó no existiera.`
        : 'Análisis pendiente de datos.',
    },
  ]

  return entries
}

// ── Page (server component) ───────────────────────────────────────────────────

export default async function LandingPage() {
  const [b1, b2, b3, b4, health] = await Promise.all([
    getBriefing(1), getBriefing(2), getBriefing(3), getBriefing(4), getHealth(),
  ])

  const entries = buildEntries([b1, b2, b3, b4])

  const corpusSize =
    typeof health?.norm_count === 'number'
      ? health.norm_count
      : null

  const corpusLabel = corpusSize != null
    ? corpusSize.toLocaleString('es-ES')
    : 'doce mil'

  return (
    <article>
      {/* ── Opening statement ────────────────────────────────────────── */}
      <section className="border-b border-rule">
        <div className="max-w-table mx-auto px-6 md:px-10 pt-20 md:pt-28 pb-16 md:pb-20">
          <p className="label-kicker mb-6">
            Informe legislativo · Consejo de Ministros
          </p>

          <h1 className="font-serif text-display md:text-display-lg max-w-copy text-ink mb-10 tracking-tight">
            El Consejo de Ministros gobierna a ciegas un corpus de{' '}
            <span className="text-accent">{corpusLabel}</span> normas.
          </h1>

          <p className="font-serif text-lg text-ink-secondary max-w-copy leading-relaxed">
            Dos siglos de leyes, derogaciones y remisiones cruzadas conviven en un
            solo cuerpo normativo que nadie ha cartografiado entero. Los cuatro
            informes siguientes —extraídos directamente del grafo legislativo del
            Estado— señalan dónde está el daño y qué corregir primero.
          </p>
        </div>
      </section>

      {/* ── Four briefings, as a table of contents ──────────────────── */}
      <section>
        <div className="max-w-table mx-auto px-6 md:px-10">
          <p className="label-kicker pt-12 pb-2">
            Cuatro preguntas para esta legislatura
          </p>

          <ol>
            {entries.map(entry => (
              <li key={entry.n} className="border-t border-rule last:border-b">
                <Link
                  href={`/briefings/${entry.n}`}
                  className="group grid grid-cols-[auto_1fr] md:grid-cols-[88px_1fr_auto] gap-x-6 gap-y-3 items-start py-10 transition-colors duration-150"
                >
                  {/* Number */}
                  <span className="font-serif text-xl text-ink-faint leading-none tabular-nums row-span-2 md:row-span-1">
                    {String(entry.n).padStart(2, '0')}
                  </span>

                  {/* Question + answer */}
                  <div>
                    <h2 className="font-serif text-xl text-ink leading-snug mb-2 group-hover:underline decoration-rule underline-offset-4">
                      {entry.question}
                    </h2>
                    <p className="font-serif text-base text-ink-secondary leading-relaxed max-w-copy">
                      {entry.answer}
                    </p>
                  </div>

                  {/* Headline figure */}
                  <div className="md:text-right md:pl-8 md:min-w-[200px]">
                    <span className="font-serif text-xl text-accent tabular-nums whitespace-nowrap">
                      {entry.figure}
                    </span>
                    <span className="block font-sans text-sm text-ink-faint mt-1 group-hover:text-ink transition-colors duration-150">
                      Leer el informe →
                    </span>
                  </div>
                </Link>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ── Closing note ─────────────────────────────────────────────── */}
      <section className="border-t border-rule">
        <div className="max-w-table mx-auto px-6 md:px-10 py-12">
          <p className="font-serif text-base text-ink-secondary max-w-copy leading-relaxed">
            Cada informe se apoya en una consulta directa al grafo legislativo —
            visible bajo demanda— y en un diagrama de las normas implicadas.
            Para navegar el corpus completo, abra el{' '}
            <Link href="/explore" className="link-accent">explorador</Link>, o
            formule su propia pregunta al{' '}
            <Link href="/ask" className="link-accent">ordenamiento jurídico</Link>.
          </p>
        </div>
      </section>
    </article>
  )
}
