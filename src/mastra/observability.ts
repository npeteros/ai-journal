import { PinoLogger } from '@mastra/loggers'
import { LogLevel } from '@mastra/core/logger'
import type { AnySpan, SpanOutputProcessor } from '@mastra/core/observability'
import {
  Observability,
  MastraStorageExporter,
  MastraPlatformExporter,
  SensitiveDataFilter,
} from '@mastra/observability'
import { USER_ID_KEY } from './guardrails/requestContext'

type LogLevelValue = (typeof LogLevel)[keyof typeof LogLevel]

function resolveLogLevel(value: string | undefined): LogLevelValue {
  const levels: string[] = Object.values(LogLevel)
  return value && levels.includes(value) ? (value as LogLevelValue) : LogLevel.INFO
}

// Shared structured logger for the Mastra instance and AI guardrails.
export const logger = new PinoLogger({
  name: 'Mastra',
  level: resolveLogLevel(process.env.LOG_LEVEL),
})

const SENSITIVE_AGENT_IDS = new Set(['personality-agent'])

function isSensitiveAgentSpan(span: AnySpan): boolean {
  let current: AnySpan | undefined = span
  while (current) {
    if (current.entityId && SENSITIVE_AGENT_IDS.has(current.entityId)) return true
    current = current.parent
  }
  return false
}

function redactContent(span: AnySpan): AnySpan {
  span.input = undefined
  span.output = undefined
  span.inputPreview = undefined
  span.outputPreview = undefined
  const { attributes } = span
  if (attributes && 'prompt' in attributes) attributes.prompt = undefined
  if (attributes && 'instructions' in attributes) attributes.instructions = undefined
  return span
}

/**
 * Strips span input/output (prompts, completions, tool args/results) and the prompt and
 * instructions attributes (agent runs, scorer steps) before export, unless AI_LOG_CONTENT=true.
 * Personality-agent traces are always redacted, error details included, because a provider error
 * can echo journal text. Other agents keep their error details for diagnosis.
 */
export class ContentRedactionProcessor implements SpanOutputProcessor {
  name = 'content-redaction'

  process(span?: AnySpan): AnySpan | undefined {
    if (!span) return span
    if (isSensitiveAgentSpan(span)) {
      span.errorPreview = undefined
      span.errorInfo = undefined
      return redactContent(span)
    }
    return process.env.AI_LOG_CONTENT !== 'true' ? redactContent(span) : span
  }

  async shutdown(): Promise<void> {}
}

export const observability = new Observability({
  configs: {
    default: {
      serviceName: 'mastra',
      exporters: [
        new MastraStorageExporter(), // Persists observability events to Mastra Storage
        new MastraPlatformExporter(), // Sends observability events to Mastra Platform (if MASTRA_PLATFORM_ACCESS_TOKEN is set)
      ],
      spanOutputProcessors: [
        new SensitiveDataFilter(), // Redacts sensitive data like passwords, tokens, keys
        new ContentRedactionProcessor(), // Personality prompts/completions stay redacted always
      ],
      // Attach the caller's user ID (set by the AI guardrails) to every trace
      requestContextKeys: [USER_ID_KEY],
    },
  },
})
