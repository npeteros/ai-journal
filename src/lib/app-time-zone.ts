/**
 * Fixed time zone for day-based stats (streaks). A product decision: every user's days are
 * counted in Manila time, so the server can prefetch the streak with the same query key the
 * client uses.
 */
export const APP_TIME_ZONE = 'Asia/Manila'
