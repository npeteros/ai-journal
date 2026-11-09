import {
  BODY_MAX_LENGTH,
  TAG_NAME_MAX_LENGTH,
  TAGS_MAX_COUNT,
  TITLE_MAX_LENGTH,
} from '@/src/server/api/routers/v1/entry/schema'

const GENERIC_MESSAGE = 'Something went wrong. Please try again.'

type Issue = { code?: string; path?: PropertyKey[]; message?: string }

/** Input validation failures reach the client as a JSON array of Zod issues in `message`. */
function parseIssues(message: string): Issue[] | null {
  try {
    const parsed: unknown = JSON.parse(message)
    return Array.isArray(parsed) ? (parsed as Issue[]) : null
  } catch {
    return null
  }
}

function describeIssue({ code, path = [], message }: Issue): string {
  const [field, index] = path

  if (field === 'body') {
    return code === 'too_big'
      ? `Entries can be up to ${BODY_MAX_LENGTH.toLocaleString('en-US')} characters.`
      : 'Write something before saving.'
  }
  if (field === 'title') return `Titles can be up to ${TITLE_MAX_LENGTH} characters.`
  if (field === 'tags') {
    if (index === undefined) return `You can add up to ${TAGS_MAX_COUNT} tags.`
    return code === 'too_small'
      ? "Tags can't be empty."
      : `Tags can be up to ${TAG_NAME_MAX_LENGTH} characters.`
  }
  return message ?? GENERIC_MESSAGE
}

/** Turns a tRPC client error into one short sentence that is safe to show the user. */
export function getApiErrorMessage(error: unknown): string {
  if (typeof error !== 'object' || error === null) return GENERIC_MESSAGE

  const { message, data } = error as { message?: unknown; data?: { code?: string } | null }
  const code = data?.code

  if (code === 'UNAUTHORIZED') return 'Your session has expired. Please sign in again.'
  if (code === 'NOT_FOUND') return 'This entry no longer exists.'

  if (code === 'BAD_REQUEST' && typeof message === 'string') {
    const issues = parseIssues(message)
    if (issues && issues.length > 0) {
      return [...new Set(issues.map(describeIssue))].join(' ')
    }
  }

  return GENERIC_MESSAGE
}
