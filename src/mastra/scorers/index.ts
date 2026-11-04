import { createAnswerRelevancyScorer, createToxicityScorer } from '@mastra/evals/scorers/prebuilt'

const JUDGE_MODEL = 'openai/gpt-5-mini'

export const answerRelevancyScorer = createAnswerRelevancyScorer({ model: JUDGE_MODEL })
export const toxicityScorer = createToxicityScorer({ model: JUDGE_MODEL })
