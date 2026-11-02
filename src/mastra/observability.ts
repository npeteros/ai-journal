import { PinoLogger } from '@mastra/loggers'
import { LogLevel } from '@mastra/core/logger'
import type { AnySpan, SpanOutputProcessor } from '@mastra/core/observability'
import {
  Observability,
  MastraStorageExporter,
  MastraPlatformExporter,
  SensitiveDataFilter,
} from '@mastra/observability'

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

/**
 * Strips span input/output (prompts, completions, tool args/results) and the prompt and
 * instructions attributes (agent runs, scorer steps) before export, unless AI_LOG_CONTENT=true.
 * Model, token usage, timing and metadata are kept.
 */
export class ContentRedactionProcessor implements SpanOutputProcessor {
  name = 'content-redaction'

  process(span?: AnySpan): AnySpan | undefined {
    if (!span || process.env.AI_LOG_CONTENT === 'true') return span
    span.input = undefined
    span.output = undefined
    const { attributes } = span
    if (attributes && 'prompt' in attributes) attributes.prompt = undefined
    if (attributes && 'instructions' in attributes) attributes.instructions = undefined
    return span
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
        new ContentRedactionProcessor(), // Hides prompts/completions unless AI_LOG_CONTENT=true
      ],
      // Attach the caller's user ID (set by the AI guardrails) to every trace
      requestContextKeys: ['userId'],
    },
  },
})
