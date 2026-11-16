/**
 * Seeds the built-in reflection frameworks (templates with no owner, visible to every user).
 *
 *   npm run seed:frameworks
 *
 * Safe to re-run: each framework is upserted by slug, so edits here refresh the stored text
 * and existing entries keep their `frameworkId`. Frameworks removed from this list are left alone.
 */
import 'dotenv/config'
import type { FrameworkIconName } from '@/components/frameworks/framework-icon'
import prisma from '@/src/lib/prisma'
import type { FrameworkPrompt } from '@/src/server/api/routers/v1/framework/schema'

type BuiltInFramework = {
  slug: string
  title: string
  description: string
  minutes: number
  icon: FrameworkIconName
  prompts: FrameworkPrompt[]
}

const BUILT_IN_FRAMEWORKS: BuiltInFramework[] = [
  {
    slug: 'first-principles',
    title: 'First Principles',
    description: 'Break a problem down to its basics',
    minutes: 5,
    icon: 'layers',
    prompts: [
      { prompt: 'What problem are you trying to solve?' },
      { prompt: 'What do you know to be true about it?' },
      { prompt: 'What could you build back up from those truths?' },
    ],
  },
  {
    slug: 'ikigai',
    title: 'Ikigai',
    description: 'Find where purpose and passion meet',
    minutes: 8,
    icon: 'globe',
    prompts: [
      { prompt: 'What do you love doing?' },
      { prompt: 'What are you good at?' },
      { prompt: 'What does the world need from you?' },
      { prompt: 'What could you be paid for?' },
    ],
  },
  {
    slug: 'daily-review',
    title: 'Daily Review',
    description: 'Three quick prompts to close the day',
    minutes: 3,
    icon: 'check',
    prompts: [
      {
        prompt: 'What went well today?',
        sample:
          'The client call went better than expected — the extra prep on Tuesday really paid off.',
      },
      {
        prompt: 'What could have gone better?',
        sample: "I stayed on my laptop too long after dinner — could've stopped an hour earlier.",
      },
      {
        prompt: 'One thing to carry into tomorrow',
        sample: 'Close the laptop at 8, same as tonight should have gone',
      },
    ],
  },
  {
    slug: 'regret-minimization',
    title: 'Regret Minimization',
    description: 'Decide by looking back from age 80',
    minutes: 6,
    icon: 'compass',
    prompts: [
      { prompt: 'What decision are you facing?' },
      { prompt: 'At 80, which choice would you regret not making?' },
    ],
  },
  {
    slug: 'gratitude-map',
    title: 'Gratitude Map',
    description: 'Trace one good thing to its roots',
    minutes: 4,
    icon: 'heart',
    prompts: [
      { prompt: 'Name one good thing from today.' },
      { prompt: 'What made it possible?' },
      { prompt: 'Who else played a part?' },
    ],
  },
]

async function main() {
  // Sequential, so `createdAt` (the gallery's sort key) follows the order of the list above.
  for (const { slug, ...data } of BUILT_IN_FRAMEWORKS) {
    await prisma.framework.upsert({
      where: { slug },
      update: { ...data, userId: null, deletedAt: null },
      create: { slug, ...data, userId: null },
    })
  }

  console.info(`Seeded ${BUILT_IN_FRAMEWORKS.length} built-in frameworks.`)
}

main()
  .catch((error: unknown) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
