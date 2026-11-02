# `src/mastra`: the AI layer

How to add agents, tools, workflows, scorers and evals. For how the layer fits together (storage, tracing, rate limiting), see [`docs/ai-mastra-setup.md`](../../docs/ai-mastra-setup.md).

## Before you start

- **Load the `mastra` skill** (in Claude Code / agent tools) before any Mastra work.
- **Check the API against the installed version.** Mastra changes often, so look in `node_modules/@mastra/core/dist/docs/references/` (for example `reference-tools-create-tool.md` or `docs-workflows-overview.md`) rather than relying on memory or old examples.
- **Register everything in `index.ts`.** Agents, tools, workflows and scorers are only available through the `mastra` instance once registered there.
- **Run the project scripts.** Use `npm run dev` / `npm run build`, not `mastra dev` / `mastra build`. Studio at `http://localhost:4111` lets you chat with agents, run workflows and inspect traces.
- **CI rules:** no `any`, `as any`, `// @ts-ignore` or `console.log`. Use `logger` from `./observability`.

## Directory layout

```text
src/mastra/
├── index.ts          # The Mastra instance: register everything here
├── observability.ts  # logger + tracing config
├── agents/           # one file per agent: <name>-agent.ts
├── tools/            # one file per tool:  <name>-tool.ts
├── workflows/        # one file per workflow: <name>-workflow.ts
├── scorers/          # scorers, exported from scorers/index.ts
├── evals/            # eval suites: <name>.eval.ts (run with npm run eval)
└── guardrails/       # usage logging + rate limiting (AiUsageProcessor, AiUsageService)
```

## Agents

Create `agents/<name>-agent.ts`:

```ts
import { Agent } from '@mastra/core/agent'
import { Memory } from '@mastra/memory'
import { aiUsageProcessor } from '../guardrails/AiUsageProcessor'
import { myTool } from '../tools/my-tool'

export const journalAgent = new Agent({
  id: 'journal-agent', // kebab-case; this is what appears in traces and AiUsageLog.agent
  name: 'Journal Agent',
  instructions: `You help users reflect on their journal entries. ...`,
  model: 'openai/gpt-5-mini', // "provider/model" router format
  tools: { myTool },
  memory: new Memory(), // only if the agent needs conversation history
  // Required on every agent: rate limit + AiUsageLog row for every call.
  inputProcessors: [aiUsageProcessor],
  outputProcessors: [aiUsageProcessor],
})
```

Then register it in `index.ts`:

```ts
agents: { weatherAgent, journalAgent },
```

### Rules

- **Always include `aiUsageProcessor` in both arrays.** Mastra can't attach processors to every agent at once. If you pass `inputProcessors` / `outputProcessors` on a single `generate()` / `stream()` call, they _replace_ the agent's arrays for that call, so include `aiUsageProcessor` there too.
- **Check model names before using one.** Run `node .agents/skills/mastra/scripts/provider-registry.mjs` instead of guessing.
- **Keep instructions and the model server-side.** Never take `maxSteps`, `modelSettings`, instructions or processors from the client.

### Calling an agent

Pass the signed-in user's ID through the RequestContext. That's how the call is attributed, traced and rate-limited.

```ts
import { mastra } from '@/src/mastra'
import { assertNotRateLimited } from '@/src/mastra/guardrails/AiUsageProcessor'
import { createUserRequestContext } from '@/src/mastra/guardrails/requestContext'

// e.g. inside a tRPC procedure
const result = await mastra.getAgentById('journal-agent').generate(prompt, {
  requestContext: createUserRequestContext(ctx.session.user.id),
})
assertNotRateLimited(result) // over-limit calls return a tripwire, not an error → TRPCError 429
return result.text
```

- **Streaming to `useChat`:** use `handleChatStream` and wrap the stream with `peekRateLimit()` to return a 429. `app/api/dev/chat/route.ts` is the reference.
- **No `requestContext`:** the call is still logged, as a system call (`userId: null`), but it isn't rate-limited. Only do this for real system work.

## Tools

Create `tools/<name>-tool.ts`:

```ts
import { createTool } from '@mastra/core/tools'
import { z } from 'zod'

export const lookupEntryTool = createTool({
  id: 'lookup-entry',
  description: 'Fetch a journal entry by ID', // the model reads this to decide when to call it
  inputSchema: z.object({
    entryId: z.string().describe('Journal entry ID'),
  }),
  outputSchema: z.object({
    title: z.string(),
    body: z.string(),
  }),
  // 1st arg: validated input. 2nd arg: context (requestContext, abortSignal, ...)
  execute: async ({ entryId }, { requestContext }) => {
    const userId = requestContext?.get('userId')
    // ... look it up, scoped to userId
  },
})
```

### Rules

- **Use existing services.** Before writing data access in a tool, check `src/server/` (for example the tRPC routers in `src/server/api/routers/`) for logic that already does it, and reuse it instead of duplicating it.
- **Scope data to the user.** Tools receive the caller's RequestContext. Read the user ID from it (the key is `USER_ID_KEY` in `guardrails/requestContext.ts`), and never trust an ID the model passes for authorization.
- **Write clear descriptions.** `.describe()` and `description` text is what the model sees.
- **Register the tool.** Add it to the agent's `tools`, and also to `index.ts` if it should appear in Studio or be callable on its own.

## Workflows

Create `workflows/<name>-workflow.ts`:

```ts
import { createStep, createWorkflow } from '@mastra/core/workflows'
import { z } from 'zod'

const summarize = createStep({
  id: 'summarize',
  inputSchema: z.object({ text: z.string() }),
  outputSchema: z.object({ summary: z.string() }),
  execute: async ({ inputData, mastra, requestContext }) => {
    const agent = mastra.getAgentById('journal-agent')
    // requestContext is NOT passed to agents automatically: forward it.
    const result = await agent.generate(`Summarize:\n${inputData.text}`, { requestContext })
    if (result.tripwire) throw new Error(`Summarize blocked: ${result.tripwire.reason}`)
    return { summary: result.text }
  },
})

export const summaryWorkflow = createWorkflow({
  id: 'summary-workflow',
  inputSchema: z.object({ text: z.string() }),
  outputSchema: z.object({ summary: z.string() }),
}).then(summarize)

summaryWorkflow.commit()
```

Register it under `workflows` in `index.ts`, then run it:

```ts
const run = await mastra.getWorkflow('summaryWorkflow').createRun()
const result = await run.start({
  inputData: { text },
  requestContext: createUserRequestContext(userId), // attributes and rate-limits agent calls inside
})
if (result.status === 'success') return result.result
```

### Rules

- **Use a workflow for fixed, multi-step processes.** Use an agent for open-ended tasks where the model decides what to do.
- **Forward `requestContext` into every agent call inside a step**, otherwise the call is logged as a system call. This doesn't apply when the agent itself is used as a step (`createStep(agent)`), which forwards it automatically.
- **Check `result.tripwire` after agent calls** and throw, so a rate-limited step fails instead of returning empty output.
- **Don't forget `.commit()`.**

## Scorers

Scorers grade agent output. They are used by evals and can also be attached to agents for live scoring.

- **Built-in scorers:** add them to `scorers/index.ts`.

  ```ts
  import { createAnswerRelevancyScorer } from '@mastra/evals/scorers/prebuilt'

  export const answerRelevancyScorer = createAnswerRelevancyScorer({ model: JUDGE_MODEL })
  ```

- **Custom scorers:** use `createScorer` from `@mastra/core/evals`. Steps can be plain functions, which make no LLM calls, or prompt objects that call the judge model. See `reference-evals-create-scorer.md` in the embedded docs.
- **Register them** under `scorers` in `index.ts` so their scores are stored and show in Studio.
- **Judge calls cost tokens.** They are not agent calls, so they don't write `AiUsageLog` rows, but they do appear in traces.

## Evals

Evals run real agents against a dataset and grade the output with scorers. They **cost tokens**, so they run only via `npm run eval` (`vitest.eval.config.mts`), never in `npm test`.

Create `evals/<name>.eval.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { runEvals } from '@mastra/core/evals'
import { mastra } from '@/src/mastra'

const relevancy = mastra.getScorer('answerRelevancyScorer')

describe('journal-agent', () => {
  it('gives relevant answers', async () => {
    const result = await runEvals({
      target: mastra.getAgentById('journal-agent'), // resolve via mastra so traces/scores persist
      data: [{ input: 'Summarize how my week went.' }],
      scorers: [relevancy],
    })

    expect(result.scores[relevancy.id]).toBeGreaterThanOrEqual(0.7)
  })
})
```

### Rules

- **Keep datasets small.** Each item is a real model call plus judge calls.
- **Use thresholds, not exact scores.** Judge scores vary between runs.
- **Environment needed:** `OPENAI_API_KEY` and `DATABASE_URL` in `.env`. Eval calls write `AiUsageLog` rows with `userId: null`.

## Unit tests

Ordinary Vitest tests live in `__tests__/` next to the code and run with `npm test` / `npm run test:run`.

- **Mock Prisma and observability** so tests need no DB or exporters:

  ```ts
  vi.mock('@/src/lib/prisma', () => ({ default: {} }))
  vi.mock('../../observability', () => ({ logger: {} }))
  ```

- **Don't call real models in unit tests.** Inject fakes, the way `AiUsageProcessor` takes an `AiUsageService` in its constructor. See `guardrails/__tests__/` for examples.

## Checklist

| Adding a… | Checklist                                                                                                                      |
| --------- | ------------------------------------------------------------------------------------------------------------------------------ |
| Agent     | `aiUsageProcessor` in both arrays · registered in `index.ts` · callers pass `createUserRequestContext` and handle the tripwire |
| Tool      | Clear `description` and `.describe()` · user-scoped via `requestContext` · reuses existing services · added to an agent        |
| Workflow  | `.commit()` · registered · forwards `requestContext` to agent calls · checks `tripwire`                                        |
| Scorer    | Exported from `scorers/index.ts` · registered in `index.ts`                                                                    |
| Eval      | `*.eval.ts` in `evals/` · small dataset · threshold assertions                                                                 |
