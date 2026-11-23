import type { CompanionToneValue } from '@/src/server/api/routers/v1/profile/schema'

// Copy for the "Tell Jaden about you" questions. Edit wording here, not in the component.

export const WELCOME_INTRO = {
  title: 'Tell Jaden about you',
  body: 'Four quick questions so Jaden can reflect with you, not at you. Skip any of them — you can change your answers in Settings.',
}

export const FOCUS_QUESTION = {
  title: 'What brings you to journaling?',
  hint: 'Pick up to 3. Helps Jaden notice what matters to you.',
  otherPlaceholder: 'Something else…',
}

export const GOAL_QUESTION = {
  title: 'What would you like to get out of it?',
  hint: 'Jaden keeps this in mind when it suggests what to reflect on.',
  placeholder: 'e.g. I want to notice what drains me and what restores me.',
  suggestions: [
    'Understand my moods',
    'Handle stress better',
    'Build a daily habit',
    'See patterns over time',
  ],
}

export const CONTEXT_QUESTION = {
  title: 'What’s on your mind lately?',
  hint: 'Optional. Gives Jaden context until you’ve written a few entries. You can edit or clear it any time.',
  placeholder: 'Whatever feels relevant right now…',
  starters: [
    'This month I’m dealing with…',
    'Something I keep thinking about is…',
    'A change I’m going through…',
  ],
}

export const TONE_QUESTION = {
  title: 'How should Jaden talk to you?',
  hint: 'Here’s how Jaden might reply to the same entry.',
  exampleEntry: 'Work was a lot today. I snapped at my sister and now I feel bad.',
}

export const TONE_OPTIONS: readonly {
  value: CompanionToneValue
  label: string
  description: string
  sample: string
}[] = [
  {
    value: 'GENTLE',
    label: 'Gentle',
    description: 'Soft and unhurried',
    sample:
      'That sounds like a heavy day, and it makes sense you feel bad. What was weighing on you before it happened?',
  },
  {
    value: 'DIRECT',
    label: 'Direct',
    description: 'Clear and to the point',
    sample:
      'Long day, then a snap at your sister. What set it off, and what would you want to say to her now?',
  },
  {
    value: 'PLAYFUL',
    label: 'Playful',
    description: 'Warm with a light touch',
    sample:
      'Oof, work followed you home today. Go easy on yourself — then tell me, what tipped the scales?',
  },
]

export const DEFAULT_TONE: CompanionToneValue = 'GENTLE'
