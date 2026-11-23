import type { JadenGesture, JadenMood } from '@/components/jaden/jaden.config'

/**
 * Product tour stops. Each `id` matches a `data-tour` attribute in the app shell. The same id can
 * appear in the desktop sidebar and the mobile bar; the tour uses whichever is visible and skips a
 * stop with no visible anchor (e.g. the streak pill on mobile).
 */
export type TourStepDef = {
  id: string
  title: string
  body: string
  /** Jaden's reaction on this stop. The gesture plays once when the step opens. */
  jaden: { mood: JadenMood; gesture?: JadenGesture }
}

export const TOUR_STEPS: readonly TourStepDef[] = [
  {
    id: 'new-entry',
    title: 'Start here',
    body: 'Write or speak today’s entry. A few lines is plenty.',
    jaden: { mood: 'happy', gesture: 'wave' },
  },
  {
    id: 'streak',
    title: 'Your streak',
    body: 'Journal daily to build your streak. Missing a day is fine — just pick it back up.',
    jaden: { mood: 'proud' },
  },
  {
    id: 'nav-frameworks',
    title: 'Frameworks',
    body: 'Guided reflections for when you don’t know what to write.',
    jaden: { mood: 'curious' },
  },
  {
    id: 'nav-insights',
    title: 'Insights',
    body: 'Recurring themes, your personality reflection and monthly stories unlock as you write.',
    jaden: { mood: 'thinking', gesture: 'think' },
  },
  {
    id: 'nav-chat',
    title: 'Chat with Jaden',
    body: 'Ask Jaden about your own journal. Answers cite the entries they come from.',
    jaden: { mood: 'happy', gesture: 'nod' },
  },
  {
    id: 'nav-settings',
    title: 'Your data is yours',
    body: 'See every AI request in the Processing Log or export everything under Data & privacy. You can replay this tour from Settings → About you.',
    jaden: { mood: 'neutral', gesture: 'sip' },
  },
]

/** `data-tour` value for a primary nav link, e.g. `/insights` → `nav-insights`. */
export const navTourId = (href: string) => `nav-${href.replace(/^\//, '')}`
