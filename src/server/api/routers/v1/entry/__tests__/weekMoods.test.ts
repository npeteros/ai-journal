import { describe, expect, it } from 'vitest'

import { computeWeekMoods, type WeekMoodRow } from '../core/queries/weekMoods'

const NOW = new Date('2026-03-10T12:00:00Z')

const row = (
  entryDate: string,
  mood: WeekMoodRow['mood'],
  moodScore: number,
  time = '09:00',
): WeekMoodRow => ({
  entryDate,
  mood,
  moodScore,
  writtenAt: new Date(`${entryDate}T${time}:00Z`),
})

describe('computeWeekMoods', () => {
  it('returns seven days ending today, all empty when nothing is analyzed', () => {
    const week = computeWeekMoods([], 'UTC', NOW)

    expect(week.map((d) => d.entryDate)).toEqual([
      '2026-03-04',
      '2026-03-05',
      '2026-03-06',
      '2026-03-07',
      '2026-03-08',
      '2026-03-09',
      '2026-03-10',
    ])
    expect(week.every((d) => d.mood === null)).toBe(true)
  })

  it('uses the mood of the lowest-scoring entry of the day', () => {
    const week = computeWeekMoods(
      [row('2026-03-10', 'grateful', 85), row('2026-03-10', 'hard', 20, '14:00')],
      'UTC',
      NOW,
    )

    expect(week[6]).toEqual({ entryDate: '2026-03-10', mood: 'hard' })
  })

  it('breaks score ties with the earliest entry', () => {
    const week = computeWeekMoods(
      [row('2026-03-09', 'tired', 50, '18:00'), row('2026-03-09', 'calm', 50, '08:00')],
      'UTC',
      NOW,
    )

    expect(week[5]?.mood).toBe('calm')
  })

  it('leaves days without entries empty and ignores days outside the week', () => {
    const week = computeWeekMoods(
      [row('2026-03-08', 'calm', 70), row('2026-03-01', 'hard', 10)],
      'UTC',
      NOW,
    )

    expect(week.map((d) => d.mood)).toEqual([null, null, null, null, 'calm', null, null])
  })

  it("counts days in the user's time zone", () => {
    // 23:30 UTC on the 10th is already the 11th in Manila (UTC+8).
    const late = new Date('2026-03-10T23:30:00Z')
    const week = computeWeekMoods([row('2026-03-11', 'calm', 70)], 'Asia/Manila', late)

    expect(week[6]).toEqual({ entryDate: '2026-03-11', mood: 'calm' })
  })
})
