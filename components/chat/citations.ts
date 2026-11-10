import { isToolUIPart, type UIMessage } from 'ai'
import { z } from 'zod'

export type EntryRef = { id: string; title: string; date: string }

export type CitationSegment = { type: 'text'; text: string } | { type: 'cite'; entry: EntryRef }

const entryRefSchema = z.object({ id: z.string(), title: z.string(), date: z.string() })
const searchOutputSchema = z.object({ entries: z.array(entryRefSchema) })
const getEntryOutputSchema = z.object({ entry: entryRefSchema.nullable() })

const CITATION_PATTERN = /\[(\d{4}-\d{2}-\d{2})\s*[-–—]\s*([^\]\n]+?)\s*\]/g

const normalize = (title: string) => title.trim().replace(/\s+/g, ' ').toLowerCase()

function refsFromOutput(output: unknown): EntryRef[] {
  const search = searchOutputSchema.safeParse(output)
  if (search.success) return search.data.entries
  const single = getEntryOutputSchema.safeParse(output)
  if (single.success && single.data.entry) {
    const { id, title, date } = single.data.entry
    return [{ id, title, date }]
  }
  return []
}

export function collectEntryRefs(messages: UIMessage[]): EntryRef[] {
  const byId = new Map<string, EntryRef>()
  for (const message of messages) {
    for (const part of message.parts) {
      if (!isToolUIPart(part) || part.state !== 'output-available') continue
      for (const ref of refsFromOutput(part.output)) byId.set(ref.id, ref)
    }
  }
  return [...byId.values()]
}

function findRef(refs: EntryRef[], date: string, title: string): EntryRef | undefined {
  const sameDate = refs.filter((ref) => ref.date === date)
  return (
    sameDate.find((ref) => normalize(ref.title) === normalize(title)) ??
    (sameDate.length === 1 ? sameDate[0] : undefined)
  )
}
export function splitCitations(text: string, refs: EntryRef[]): CitationSegment[] {
  const segments: CitationSegment[] = []
  let last = 0
  for (const match of text.matchAll(CITATION_PATTERN)) {
    const entry = findRef(refs, match[1], match[2])
    if (!entry) continue
    if (match.index > last) segments.push({ type: 'text', text: text.slice(last, match.index) })
    segments.push({ type: 'cite', entry })
    last = match.index + match[0].length
  }
  if (last < text.length) segments.push({ type: 'text', text: text.slice(last) })
  return segments
}
