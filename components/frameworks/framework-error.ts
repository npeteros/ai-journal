import { parseIssues, type Issue } from '@/components/journal/api-error'

const GENERIC_MESSAGE = 'Something went wrong. Please try again.'

/** Builder field messages, keyed by the first segment of a Zod issue path. */
export const FRAMEWORK_FIELD_MESSAGES: Record<string, string> = {
  title: 'Name must be 1–60 characters.',
  description: 'Description can be up to 140 characters.',
  icon: 'Pick an icon.',
  prompts: 'Add 1–10 prompts.',
  prompt: 'Prompts must be 1–200 characters.',
}

/** A per-prompt issue (`['prompts', i, ...]`) maps to `prompt`; anything else to its field. */
export function frameworkIssueField(path: readonly PropertyKey[]) {
  return path.length > 1 && path[0] === 'prompts' ? 'prompt' : String(path[0])
}

function describeIssue({ path = [], message }: Issue) {
  return FRAMEWORK_FIELD_MESSAGES[frameworkIssueField(path)] ?? message ?? GENERIC_MESSAGE
}

/** Turns a failed framework create/update into one short sentence that is safe to show. */
export function getFrameworkErrorMessage(error: unknown): string {
  if (typeof error !== 'object' || error === null) return GENERIC_MESSAGE

  const { message, data } = error as { message?: unknown; data?: { code?: string } | null }
  const code = data?.code

  if (code === 'UNAUTHORIZED') return 'Your session has expired. Please sign in again.'
  if (code === 'NOT_FOUND') return 'This framework no longer exists.'

  if (code === 'BAD_REQUEST' && typeof message === 'string') {
    const issues = parseIssues(message)
    if (issues && issues.length > 0) return [...new Set(issues.map(describeIssue))].join(' ')
  }

  return GENERIC_MESSAGE
}
