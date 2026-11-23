import { createTRPCRouter } from '@/src/server/trpc/init'
import { finishTour } from './core/mutations/finishTour'
import { replayTour } from './core/mutations/replayTour'
import { saveAbout } from './core/mutations/saveAbout'
import { skipWelcome } from './core/mutations/skipWelcome'
import { get } from './core/queries/get'

export const profileRouter = createTRPCRouter({
  get,
  saveAbout,
  skipWelcome,
  finishTour,
  replayTour,
})
