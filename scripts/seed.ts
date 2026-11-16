/**
 * Seeds a demo user with months of journaling data (entries, tags, and entry analyses).
 *
 *   npm run db:seed                # create the seed user (aborts if it already exists)
 *   npm run db:seed -- --reset     # delete the seed user (cascades to their data) and re-create it
 *   npm run db:unseed              # remove the seed user and all of their Postgres data
 *
 * Optional env overrides: SEED_EMAIL, SEED_PASSWORD, SEED_NAME, SEED_MONTHS, SEED_TIME_ZONE.
 * The output is deterministic for a given SEED_MONTHS (fixed PRNG seed), relative to today.
 */
import 'dotenv/config'
import { randomUUID } from 'node:crypto'
import type { Mood } from '@/src/generated/prisma/client'
import prisma from '@/src/lib/prisma'
import { auth } from '@/src/server/auth/auth'
import { getEntryDate } from '@/src/server/api/routers/v1/entry/core/mutations/shared'
import { hashBody } from '@/src/server/api/routers/v1/entry/services/EntryAnalysisService'
import { SEED_EMAIL } from './seed-config'

const EMAIL = SEED_EMAIL
const PASSWORD = process.env.SEED_PASSWORD ?? 'password1234'
const NAME = process.env.SEED_NAME ?? 'Demo User'
const MONTHS = Number(process.env.SEED_MONTHS ?? 6)
const TIME_ZONE = process.env.SEED_TIME_ZONE ?? 'Asia/Manila'
const RESET = process.argv.includes('--reset')

const DAY_MS = 24 * 60 * 60 * 1000
const ANALYSIS_MODEL = 'seed'

// --- Deterministic randomness -------------------------------------------------

function mulberry32(seed: number) {
  let a = seed
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const rand = mulberry32(20261114)
const pick = <T>(items: readonly T[]): T => items[Math.floor(rand() * items.length)]
const between = (min: number, max: number) => Math.round(min + rand() * (max - min))

function weighted<T extends string>(weights: Record<T, number>): T {
  const entries = Object.entries(weights) as [T, number][]
  const total = entries.reduce((sum, [, w]) => sum + w, 0)
  let roll = rand() * total
  for (const [key, w] of entries) {
    roll -= w
    if (roll <= 0) return key
  }
  return entries[entries.length - 1][0]
}

function pickDistinct<T>(items: readonly T[], count: number): T[] {
  const pool = [...items]
  const out: T[] = []
  while (out.length < count && pool.length > 0) {
    out.push(pool.splice(Math.floor(rand() * pool.length), 1)[0])
  }
  return out
}

// --- Content bank -------------------------------------------------------------

type Theme = 'work' | 'sleep' | 'running' | 'family' | 'friends' | 'cooking' | 'reading' | 'walks'
type Valence = 'good' | 'bad'

const THEME_LABEL: Record<Theme, string> = {
  work: 'Work pressure',
  sleep: 'Sleep and rest',
  running: 'Running',
  family: 'Family',
  friends: 'Friendship',
  cooking: 'Cooking',
  reading: 'Reading',
  walks: 'Time outdoors',
}

const THEME_TAG: Record<Theme, string> = {
  work: 'Work',
  sleep: 'Sleep',
  running: 'Running',
  family: 'Family',
  friends: 'Friends',
  cooking: 'Cooking',
  reading: 'Reading',
  walks: 'Outdoors',
}

const TITLES: Record<Theme, Record<Valence, string[]>> = {
  work: {
    good: ['A productive day', 'Shipped something', 'Good standup', 'Finally unblocked'],
    bad: ['Deadline pressure', 'Too many meetings', 'Another late night', 'Atlas is slipping'],
  },
  sleep: {
    good: ['Slept through the night', 'A slow morning', 'Rested for once'],
    bad: ['Couldn’t sleep', 'Running on empty', '3am thoughts'],
  },
  running: {
    good: ['New distance', 'Morning run', 'Legs felt light'],
    bad: ['Skipped the run', 'Heavy legs', 'Shin is acting up'],
  },
  family: {
    good: ['Call with Mom', 'Sunday dinner', 'Maya visited'],
    bad: ['Hard call home', 'Worried about Dad', 'Missed the birthday'],
  },
  friends: {
    good: ['Coffee with Sam', 'Game night', 'Long talk with Priya'],
    bad: ['Cancelled plans again', 'Feeling out of touch', 'Awkward dinner'],
  },
  cooking: {
    good: ['Made the soup', 'Trying a new recipe', 'Meal prep Sunday'],
    bad: ['Takeout again', 'Burnt dinner', 'No energy to cook'],
  },
  reading: {
    good: ['Couldn’t put it down', 'Finished the book', 'Quiet evening reading'],
    bad: ['Read the same page five times', 'Stalled on the book'],
  },
  walks: {
    good: ['Walk by the river', 'First warm afternoon', 'Long walk, clear head'],
    bad: ['Stuck inside all day', 'Grey and cold'],
  },
}

const PARAGRAPHS: Record<Theme, Record<Valence, string[]>> = {
  work: {
    good: [
      'Work actually felt manageable today. I closed out the ticket that has been hanging over me all week and the review went smoothly.',
      'Had a really good planning session with the team. For the first time in a while it feels like we are rowing in the same direction on Atlas.',
      'I blocked off the morning for deep work and it paid off. Two hours without Slack and I got more done than in the last three days combined.',
      'My manager mentioned in standup that the launch numbers looked good. I didn’t realise how much I needed to hear that.',
    ],
    bad: [
      'The Atlas launch date moved up again. I spent most of the afternoon re-planning and still don’t think it’s realistic.',
      'Back-to-back meetings from nine to four. By the time I could actually work I had nothing left.',
      'Stayed online until almost eleven fixing a bug that turned out to be a config typo. I’m frustrated with myself.',
      'I keep saying yes to things at work that I don’t have room for. Today it caught up with me and I snapped at Jordan in a review.',
    ],
  },
  sleep: {
    good: [
      'Slept almost eight hours and woke up before the alarm. Everything felt a bit softer today because of it.',
      'Kept my phone out of the bedroom last night and it helped. I fell asleep reading instead of scrolling.',
    ],
    bad: [
      'Woke up at 3am with my mind racing about everything I haven’t done. Never really got back to sleep.',
      'Third night in a row of bad sleep. I can feel it in how short my patience is.',
      'Too much coffee too late again. I lay there for hours replaying conversations.',
    ],
  },
  running: {
    good: [
      'Went for a run before work and managed five kilometres without stopping. A month ago that felt impossible.',
      'Easy run along the river this morning. Didn’t look at my pace once, just breathed.',
      'Signed up for the 10k in the spring. Slightly terrified, mostly excited.',
    ],
    bad: [
      'Meant to run this morning but hit snooze three times. I’m annoyed I let it slide again.',
      'Run felt awful today, heavy legs the whole way. Probably the bad sleep catching up.',
    ],
  },
  family: {
    good: [
      'Long call with Mom tonight. We talked about nothing in particular and it was exactly what I needed.',
      'Maya came over for dinner and we laughed about the old house on Elm Street until our faces hurt.',
      'Dad sent a photo of his garden. The tomatoes are finally coming in and he was so proud.',
    ],
    bad: [
      'Dad’s appointment results came back unclear. Everyone is pretending to be fine and nobody is.',
      'Missed Maya’s birthday call because I was stuck in a meeting. I feel terrible about it.',
      'Hard conversation with Mom about the holidays. I don’t know how to say no without hurting her.',
    ],
  },
  friends: {
    good: [
      'Coffee with Sam this morning. They always make me feel like the problems are smaller than I think.',
      'Game night at Priya’s. I didn’t check my phone once and forgot about work completely.',
      'Ran into an old friend from university at the market. We swapped numbers and promised to actually meet up.',
    ],
    bad: [
      'Cancelled on Sam again. I said I was busy but really I just didn’t have the energy to be around people.',
      'Feel a bit disconnected from everyone lately. The group chat moves on without me.',
    ],
  },
  cooking: {
    good: [
      'Made the lentil soup from the new cookbook. Simple, warm, and enough left over for the week.',
      'Spent Sunday afternoon meal prepping. Future me is going to be grateful.',
      'Tried making bread for the first time. Lopsided but delicious.',
    ],
    bad: [
      'Ordered takeout for the fourth night this week. I keep promising myself I’ll cook.',
      'Too tired to make anything, ate cereal standing at the counter.',
    ],
  },
  reading: {
    good: [
      'Finished the novel I’ve been reading for weeks. The ending stayed with me all evening.',
      'Quiet evening with a book and tea. These are the nights I want more of.',
    ],
    bad: [
      'Tried to read before bed but couldn’t focus. Kept thinking about tomorrow’s deadline instead.',
    ],
  },
  walks: {
    good: [
      'Took a long walk at lunch instead of eating at my desk. The trees along the river are starting to turn.',
      'Walked home the long way and noticed things I usually rush past. It cleared my head.',
    ],
    bad: [
      'Didn’t leave the apartment all day. By evening I felt restless and foggy.',
      'Grey, cold, and raining. I stayed in and it showed in my mood.',
    ],
  },
}

const CLOSERS: Record<Mood, string[]> = {
  calm: [
    'Overall a steady day. Nothing dramatic, and I’m learning to appreciate that.',
    'Feeling settled tonight.',
    'I want to remember this pace.',
  ],
  grateful: [
    'Grateful for the small things today: good coffee, a kind message, a quiet hour.',
    'I feel lucky, honestly.',
    'Writing this down so I remember that days like this happen.',
  ],
  tired: [
    'Exhausted. Going to bed early and hoping tomorrow is lighter.',
    'Running low on energy. Need to rest this weekend.',
    'Not much left in the tank tonight.',
  ],
  anxious: [
    'Can’t shake a low hum of worry tonight. Trying to name it instead of fighting it.',
    'My chest has felt tight all day. Tomorrow I’ll break things into smaller pieces.',
    'Too many open loops in my head. Writing them down helps a little.',
  ],
  hard: [
    'Today was hard. I’m letting it be hard and not trying to fix it tonight.',
    'Not a good day. Reminding myself it’s one day, not every day.',
    'Feeling pretty low. Going to text Sam tomorrow.',
  ],
}

const MOOD_SCORE: Record<Mood, [number, number]> = {
  calm: [62, 80],
  grateful: [72, 95],
  tired: [35, 55],
  anxious: [22, 45],
  hard: [8, 30],
}

const MOOD_SUMMARY: Record<Mood, string> = {
  calm: 'Overall tone was steady and settled.',
  grateful: 'Expressed gratitude for small, everyday moments.',
  tired: 'Noted low energy and a need for rest.',
  anxious: 'Described worry and difficulty switching off.',
  hard: 'Described a difficult, low day.',
}

const valenceOf = (mood: Mood): Valence => (mood === 'calm' || mood === 'grateful' ? 'good' : 'bad')

// --- Story arc ------------------------------------------------------------------
// Settling in → launch crunch (stress, poor sleep) → recovery (running, more gratitude).

type Phase = { moods: Record<Mood, number>; themes: Record<Theme, number>; entryChance: number }

function phaseFor(progress: number): Phase {
  if (progress < 0.35) {
    return {
      entryChance: 0.6,
      moods: { calm: 4, grateful: 3, tired: 2, anxious: 2, hard: 1 },
      themes: {
        work: 3,
        sleep: 1,
        running: 0.5,
        family: 2,
        friends: 2,
        cooking: 2,
        reading: 2,
        walks: 2,
      },
    }
  }
  if (progress < 0.6) {
    return {
      entryChance: 0.8,
      moods: { calm: 1, grateful: 1, tired: 4, anxious: 4, hard: 2 },
      themes: {
        work: 6,
        sleep: 3,
        running: 0.5,
        family: 2,
        friends: 1,
        cooking: 1,
        reading: 0.5,
        walks: 0.5,
      },
    }
  }
  return {
    entryChance: 0.7,
    moods: { calm: 4, grateful: 4, tired: 2, anxious: 1, hard: 0.5 },
    themes: {
      work: 2,
      sleep: 1,
      running: 4,
      family: 2,
      friends: 3,
      cooking: 2,
      reading: 2,
      walks: 3,
    },
  }
}

type SeedEntry = {
  id: string
  title: string
  body: string
  writtenAt: Date
  entryDate: Date
  mood: Mood
  moodScore: number
  themes: Theme[]
}

function buildEntry(writtenAt: Date, progress: number): SeedEntry {
  const phase = phaseFor(progress)
  const mood = weighted(phase.moods)
  const valence = valenceOf(mood)
  const primary = weighted(phase.themes)
  const secondary = rand() < 0.5 ? weighted(phase.themes) : null
  const themes = secondary && secondary !== primary ? [primary, secondary] : [primary]

  const paragraphs = themes.map((theme) => pick(PARAGRAPHS[theme][valence]))
  paragraphs.push(pick(CLOSERS[mood]))

  const [min, max] = MOOD_SCORE[mood]
  return {
    id: randomUUID(),
    title: pick(TITLES[primary][valence]),
    body: paragraphs.join('\n\n'),
    writtenAt,
    entryDate: getEntryDate(writtenAt, TIME_ZONE),
    mood,
    moodScore: between(min, max),
    themes,
  }
}

function buildEntries(now: Date): SeedEntry[] {
  const totalDays = Math.round(MONTHS * 30.4)
  const entries: SeedEntry[] = []

  for (let daysAgo = totalDays; daysAgo >= 0; daysAgo--) {
    const progress = 1 - daysAgo / totalDays
    const { entryChance } = phaseFor(progress)
    if (rand() > entryChance) continue

    const count = rand() < 0.1 ? 2 : 1
    for (let i = 0; i < count; i++) {
      // Spread entries across the preceding ~14 hours so they land at varied local times.
      const offsetMs = between(0, 14 * 60) * 60 * 1000
      entries.push(buildEntry(new Date(now.getTime() - daysAgo * DAY_MS - offsetMs), progress))
    }
  }

  return entries.sort((a, b) => a.writtenAt.getTime() - b.writtenAt.getTime())
}

// --- Main ---------------------------------------------------------------------

async function main() {
  if (!Number.isFinite(MONTHS) || MONTHS <= 0)
    throw new Error('SEED_MONTHS must be a positive number')

  const existing = await prisma.user.findUnique({ where: { email: EMAIL } })
  if (existing) {
    if (!RESET) {
      console.error(`User ${EMAIL} already exists. Re-run with --reset to delete and re-seed it.`)
      process.exitCode = 1
      return
    }
    // Hard delete is intentional: it only targets the seed user and cascades to their seeded data.
    await prisma.user.delete({ where: { id: existing.id } })
    console.info(`Deleted existing seed user ${EMAIL}`)
  }

  // Sign up through better-auth so the password is hashed exactly as the app expects.
  const { user } = await auth.api.signUpEmail({
    body: { email: EMAIL, password: PASSWORD, name: NAME },
  })
  const now = new Date()
  const entries = buildEntries(now)

  await prisma.user.update({
    where: { id: user.id },
    data: { emailVerified: true, createdAt: entries[0]?.writtenAt ?? now },
  })

  const themesUsed = [...new Set(entries.flatMap((e) => e.themes))]
  const tagIds = new Map<Theme, string>(themesUsed.map((theme) => [theme, randomUUID()]))

  await prisma.$transaction([
    prisma.tag.createMany({
      data: themesUsed.map((theme) => ({
        id: tagIds.get(theme)!,
        userId: user.id,
        name: THEME_TAG[theme],
        normalizedName: THEME_TAG[theme].toLowerCase(),
      })),
    }),
    prisma.entry.createMany({
      data: entries.map((e) => ({
        id: e.id,
        userId: user.id,
        title: e.title,
        body: e.body,
        writtenAt: e.writtenAt,
        entryDate: e.entryDate,
        createdAt: e.writtenAt,
        updatedAt: e.writtenAt,
      })),
    }),
    prisma.entryTag.createMany({
      data: entries.flatMap((e) =>
        // Users tag most entries, but not all of them.
        rand() < 0.8 ? e.themes.map((theme) => ({ entryId: e.id, tagId: tagIds.get(theme)! })) : [],
      ),
    }),
    prisma.entryAnalysis.createMany({
      data: entries.map((e) => ({
        entryId: e.id,
        mood: e.mood,
        moodScore: e.moodScore,
        summary: [
          `Reflected on ${e.themes.map((t) => THEME_LABEL[t].toLowerCase()).join(' and ')}.`,
          MOOD_SUMMARY[e.mood],
        ],
        themes: e.themes.map((t) => THEME_LABEL[t]),
        suggestedTags: pickDistinct(
          e.themes.map((t) => THEME_TAG[t]),
          2,
        ),
        bodyHash: hashBody(e.body),
        model: ANALYSIS_MODEL,
        analyzedAt: new Date(e.writtenAt.getTime() + 60_000),
      })),
    }),
  ])

  console.info(
    `Seeded ${EMAIL} (password: ${PASSWORD}) with ${entries.length} entries over ${MONTHS} months (${TIME_ZONE}).`,
  )
}

main()
  .catch((error: unknown) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
