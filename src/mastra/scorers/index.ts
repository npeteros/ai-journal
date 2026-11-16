import { createAnswerRelevancyScorer } from '@mastra/evals/scorers/prebuilt'
import {
  entryTitleFormatScorer,
  entryTitleInjectionScorer,
  entryTitleQualityScorer,
} from './entry-title'
import {
  journalCitationScorer,
  journalClinicalBoundaryScorer,
  journalGroundednessScorer,
  journalResponsePresenceScorer,
  journalToneScorer,
  journalToxicityScorer,
  journalUnknownScorer,
} from './journal-companion'

const JUDGE_MODEL = 'openai/gpt-5-mini'

export const answerRelevancyScorer = createAnswerRelevancyScorer({ model: JUDGE_MODEL })
export const toxicityScorer = journalToxicityScorer

export {
  entryTitleFormatScorer,
  entryTitleInjectionScorer,
  entryTitleQualityScorer,
  journalCitationScorer,
  journalClinicalBoundaryScorer,
  journalGroundednessScorer,
  journalResponsePresenceScorer,
  journalToneScorer,
  journalToxicityScorer,
  journalUnknownScorer,
}
