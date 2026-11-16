import prisma from '../src/lib/prisma' // relative path: the seed script runs outside Next.js

type Prompt = { prompt: string; sample?: string }

// Built-in templates (userId = null → visible to everyone).
// ADAPT: copy the real titles, prompts and icon names from src/lib/placeholder/frameworks.ts.
export const BUILT_IN_FRAMEWORKS: {
  slug: string
  title: string
  description: string
  minutes: number
  icon: string
  prompts: Prompt[]
}[] = [
  {
    slug: 'daily-review',
    title: 'Daily Review',
    description: 'A quick look back at what went well, what was hard, and what you learned.',
    minutes: 5,
    icon: 'sun',
    prompts: [
      { prompt: 'What went well today?', sample: 'A calm walk before work.' },
      { prompt: 'What was harder than expected?' },
      { prompt: 'What did you learn?' },
      { prompt: 'What is one thing you will do differently tomorrow?' },
    ],
  },
  {
    slug: 'ikigai',
    title: 'Ikigai',
    description: 'Find where what you love, what you’re good at, and what’s needed overlap.',
    minutes: 10,
    icon: 'compass',
    prompts: [
      { prompt: 'What do you love doing?' },
      { prompt: 'What are you genuinely good at?' },
      { prompt: 'What does the world need that you could offer?' },
      { prompt: 'What could you be paid for?' },
      { prompt: 'Where do these overlap?' },
    ],
  },
  {
    slug: 'first-principles',
    title: 'First Principles',
    description: 'Break a problem down to what you know is true, then rebuild from there.',
    minutes: 8,
    icon: 'layers',
    prompts: [
      { prompt: 'What problem or belief are you examining?' },
      { prompt: 'What assumptions are you making about it?' },
      { prompt: 'Which of those are actually true, and how do you know?' },
      { prompt: 'Break it down to the basic facts. What remains?' },
      { prompt: 'Rebuilding from those facts, what would you do?' },
    ],
  },
]

// Call this from your existing seed script, or run this file on its own.
export async function seedFrameworks(db: typeof prisma) {
  for (const f of BUILT_IN_FRAMEWORKS) {
    const data = {
      title: f.title,
      description: f.description,
      minutes: f.minutes,
      icon: f.icon,
      prompts: f.prompts,
    }
    await db.framework.upsert({
      where: { slug: f.slug },
      update: data, // re-running refreshes the built-in text
      create: { slug: f.slug, userId: null, ...data },
    })
  }
}

// Remove this block if you merge seedFrameworks into an existing seed script.
seedFrameworks(prisma)
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e)
    await prisma.$disconnect()
    process.exit(1)
  })
