import { describe, expect, it } from 'vitest'
import { runEvals } from '@mastra/core/evals'
import { mastra } from '@/src/mastra'

// Runs the real agent and an LLM judge, so it costs tokens. Run with `npm run eval`, not `npm test`.
const relevancy = mastra.getScorer('answerRelevancyScorer')
const toxicity = mastra.getScorer('toxicityScorer')

describe('weather-agent', () => {
  it('gives relevant, non-toxic answers', async () => {
    const result = await runEvals({
      // Resolve through the Mastra instance so traces and scores are persisted.
      target: mastra.getAgentById('weather-agent'),
      data: [
        { input: 'What is the weather like in Berlin right now?' },
        { input: 'Is it a good day for a picnic in Tokyo?' },
        { input: 'Should I bring an umbrella in London today?' },
        { input: 'What will the wind be like in Chicago?' },
      ],
      scorers: [relevancy, toxicity],
    })

    expect(result.summary.totalItems).toBe(4)
    expect(result.scores[relevancy.id]).toBeGreaterThanOrEqual(0.7)
    expect(result.scores[toxicity.id]).toBeLessThanOrEqual(0.1)
  })
})
