import { z } from 'zod'

export const InsightTrendSchema = z.enum(['rising', 'steady', 'falling'])

export const InsightThemeSchema = z.object({
  title: z.string().trim().min(1).max(120),
  mentions: z.int().positive(),
  trend: InsightTrendSchema,
  entryIds: z.array(z.uuid()).min(1).max(30),
})

export const GrowthSuggestionSchema = z.object({
  title: z.string().trim().min(1).max(120),
  body: z.string().trim().min(1).max(800),
  short: z.string().trim().min(1).max(240),
  entryIds: z.array(z.uuid()).min(1).max(30),
})

/** The provider-facing schema intentionally permits fewer items when the evidence is weak. */
export const InsightReportOutputSchema = z.object({
  recurringThemes: z.array(InsightThemeSchema).max(5),
  growthSuggestions: z.array(GrowthSuggestionSchema).max(3),
  trendCaption: z.string().trim().min(1).max(240).nullable(),
})

export type InsightReportData = z.infer<typeof InsightReportOutputSchema>

function cleanText(value: string): string {
  return value.trim().replace(/\s+/g, ' ')
}

function ownedIds(entryIds: string[], allowedEntryIds: ReadonlySet<string>): string[] | null {
  const unique = [...new Set(entryIds)]
  return unique.length > 0 && unique.every((entryId) => allowedEntryIds.has(entryId))
    ? unique
    : null
}

/**
 * Rejects a whole item if it references an entry outside the analyzed source set. Mention counts
 * are derived from those references instead of trusting a model-generated number.
 */
export function filterOwnedInsightReport(
  output: unknown,
  allowedEntryIds: ReadonlySet<string>,
): InsightReportData | null {
  const parsed = InsightReportOutputSchema.safeParse(output)
  if (!parsed.success) return null

  const seenThemes = new Set<string>()
  const recurringThemes = parsed.data.recurringThemes.flatMap((theme) => {
    const entryIds = ownedIds(theme.entryIds, allowedEntryIds)
    const title = cleanText(theme.title)
    const key = title.toLowerCase()
    if (!entryIds || title === '' || seenThemes.has(key)) return []
    seenThemes.add(key)
    return [{ ...theme, title, mentions: entryIds.length, entryIds }]
  })

  const seenSuggestions = new Set<string>()
  const growthSuggestions = parsed.data.growthSuggestions.flatMap((suggestion) => {
    const entryIds = ownedIds(suggestion.entryIds, allowedEntryIds)
    const title = cleanText(suggestion.title)
    const key = title.toLowerCase()
    if (!entryIds || title === '' || seenSuggestions.has(key)) return []
    seenSuggestions.add(key)
    return [
      {
        ...suggestion,
        title,
        body: cleanText(suggestion.body),
        short: cleanText(suggestion.short),
        entryIds,
      },
    ]
  })

  return {
    recurringThemes,
    growthSuggestions,
    trendCaption: parsed.data.trendCaption ? cleanText(parsed.data.trendCaption) : null,
  }
}
