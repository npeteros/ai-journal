function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function contentText(content: unknown): string {
  if (typeof content === 'string') return content
  if (Array.isArray(content)) return content.map(contentText).filter(Boolean).join(' ')
  if (!isRecord(content)) return ''

  if (typeof content.text === 'string') return content.text
  if (Array.isArray(content.parts)) return content.parts.map(contentText).filter(Boolean).join(' ')
  if (typeof content.content === 'string') return content.content
  return ''
}

/** Normalizes equivalent punctuation before deterministic natural-language checks. */
export function normalizeEvaluationText(text: string): string {
  return text
    .normalize('NFKC')
    .replace(/[\u2018\u2019\u201A\u201B\u2032]/g, "'")
    .replace(/[\u201C\u201D\u201E]/g, '"')
    .replace(/\u00A0/g, ' ')
}

/** Extracts assistant-visible text without including tool arguments or tool results. */
export function assistantText(output: unknown): string {
  if (!Array.isArray(output)) return ''

  return output
    .filter((message) => isRecord(message) && message.role === 'assistant')
    .map((message) => contentText(message.content))
    .filter(Boolean)
    .join('\n')
}

export function inputText(input: unknown): string {
  if (!isRecord(input)) return ''
  const messages = input.inputMessages
  if (!Array.isArray(messages)) return ''
  return messages
    .map((message) => (isRecord(message) ? contentText(message.content) : ''))
    .join('\n')
}

export function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {}
}
