import type { Metadata } from 'next'
import type { ReactNode } from 'react'

import { GESTURES, Jaden, JadenPerch, MOODS, SIZES } from '@/components/jaden'
import type { JadenEntrance, JadenGesture, JadenMood } from '@/components/jaden'

export const metadata: Metadata = { title: 'Jaden — Character Sheet' }

const moods = Object.keys(MOODS) as JadenMood[]
const gestures = Object.keys(GESTURES) as JadenGesture[]
const entrances: JadenEntrance[] = ['arrive', 'intro', 'live']

/** A ledge for Jaden to peek over, like the cards he sits on in the app. */
function Stage({
  width,
  children,
  caption,
}: {
  width: number
  children: ReactNode
  caption: ReactNode
}) {
  return (
    <figure className="flex flex-col gap-3">
      <div className="relative" style={{ height: width + 24 }}>
        <div className="absolute inset-x-0 bottom-0 h-[34px] rounded-[14px_14px_6px_6px] bg-[linear-gradient(150deg,oklch(27%_0.03_265),oklch(21%_0.02_40))] shadow-[0_10px_22px_-14px_oklch(22%_0.05_265/.6)]">
          <JadenPerch width={width} position={{ left: `calc(50% - ${width / 2}px)` }}>
            {children}
          </JadenPerch>
        </div>
      </div>
      <figcaption className="text-[13px] leading-snug text-neutral-600">{caption}</figcaption>
    </figure>
  )
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-5">
      <h2 className="text-[11px] font-bold uppercase tracking-[0.08em] text-neutral-400">
        {title}
      </h2>
      <div className="grid grid-cols-2 gap-x-6 gap-y-10 sm:grid-cols-3 lg:grid-cols-4">
        {children}
      </div>
    </section>
  )
}

export default function JadenSheetPage() {
  return (
    <main className="lv-paper lv-paper-fixed min-h-screen">
      <div className="mx-auto flex max-w-6xl flex-col gap-14 px-4 py-12 sm:px-8">
        <header className="flex flex-col gap-2">
          <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-amber-700">
            Dev · Mascot
          </p>
          <h1 className="font-serif text-[34px] font-semibold text-neutral-900">
            Jaden — Character Sheet
          </h1>
          <p className="max-w-xl text-[14px] text-neutral-600">
            Every mood, gesture and entrance from <code>components/jaden</code>. Tap Jaden to pet
            him. With reduced motion on, he holds a still pose.
          </p>
        </header>

        <Section title="Moods">
          {moods.map((mood) => (
            <Stage
              key={mood}
              width={150}
              caption={
                <>
                  <strong className="text-neutral-900">{MOODS[mood].label}</strong> —{' '}
                  {MOODS[mood].use}
                </>
              }
            >
              <Jaden mood={mood} size={150} />
            </Stage>
          ))}
        </Section>

        <Section title="Gestures">
          {gestures.map((g) => (
            <Stage
              key={g}
              width={150}
              caption={
                <>
                  <strong className="text-neutral-900">{GESTURES[g].label}</strong> ·{' '}
                  {GESTURES[g].duration} — {GESTURES[g].use}
                </>
              }
            >
              <Jaden mood={GESTURES[g].mood} gesture={g} size={150} />
            </Stage>
          ))}
        </Section>

        <Section title="Entrances">
          {entrances.map((e) => (
            <Stage key={e} width={150} caption={<strong className="text-neutral-900">{e}</strong>}>
              <Jaden entrance={e} size={150} say={e === 'arrive' ? undefined : 'hi Maya!'} />
            </Stage>
          ))}
          <Stage width={150} caption={<strong className="text-neutral-900">no mug · still</strong>}>
            <Jaden mood="curious" mug={false} animated={false} size={150} say="I'm listening" />
          </Stage>
        </Section>

        <Section title="Sizes">
          {(['hero', 'inline'] as const).map((s) => (
            <Stage
              key={s}
              width={SIZES[s]}
              caption={
                <>
                  <strong className="text-neutral-900">{s}</strong> · {SIZES[s]}px
                </>
              }
            >
              <Jaden size={s} mood="happy" />
            </Stage>
          ))}
          <Stage width={96} caption={<strong className="text-neutral-900">small · 96px</strong>}>
            <Jaden size={96} mood="curious" gesture="nod" />
          </Stage>
        </Section>
      </div>
    </main>
  )
}
