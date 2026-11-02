import { RequestContext } from '@mastra/core/request-context'

/** RequestContext key holding the calling user's ID. Read by AiUsageProcessor and attached to traces. */
export const USER_ID_KEY = 'userId'

/** Builds the RequestContext for a user-triggered agent or workflow call. */
export function createUserRequestContext(userId: string): RequestContext {
  const requestContext = new RequestContext()
  requestContext.set(USER_ID_KEY, userId)
  return requestContext
}
