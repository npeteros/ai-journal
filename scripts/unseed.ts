/**
 * Removes the seed user and all of their Postgres data: entries (with tags links and analyses),
 * tags, insight report, sessions, accounts, AI usage logs, and pending verifications.
 * Mastra memory (chat threads in LibSQL) is left untouched.
 *
 *   npm run db:unseed                # delete everything for SEED_EMAIL (default demo@jaden.local)
 *   npm run db:unseed -- --dry-run   # only report what would be deleted
 */
import 'dotenv/config'
import prisma from '@/src/lib/prisma'
import { SEED_EMAIL } from './seed-config'

const DRY_RUN = process.argv.includes('--dry-run')

async function main() {
  const user = await prisma.user.findUnique({ where: { email: SEED_EMAIL } })
  if (!user) {
    console.info(`No user found for ${SEED_EMAIL}; nothing to remove.`)
    return
  }

  const where = { userId: user.id }
  const [entries, tags, sessions, accounts, aiUsageLogs, insightReports, verifications] =
    await Promise.all([
      prisma.entry.count({ where }),
      prisma.tag.count({ where }),
      prisma.session.count({ where }),
      prisma.account.count({ where }),
      prisma.aiUsageLog.count({ where }),
      prisma.insightReport.count({ where }),
      prisma.verification.count({ where: { identifier: SEED_EMAIL } }),
    ])
  console.info(`${DRY_RUN ? '[dry run] Would remove' : 'Removing'} ${SEED_EMAIL} (${user.id}):`)
  console.table({ entries, tags, sessions, accounts, aiUsageLogs, insightReports, verifications })

  if (DRY_RUN) return

  // Hard deletes are intentional: this script exists to wipe the seed user entirely.
  await prisma.$transaction([
    // ai_usage_log uses ON DELETE SET NULL, so it would otherwise outlive the user as orphaned rows.
    prisma.aiUsageLog.deleteMany({ where }),
    prisma.verification.deleteMany({ where: { identifier: SEED_EMAIL } }),
    // Cascades to session, account, entry (→ entry_tag, entry_analysis), tag, and insight_report.
    prisma.user.delete({ where: { id: user.id } }),
  ])

  console.info(`Removed ${SEED_EMAIL} and all of their data.`)
}

main()
  .catch((error: unknown) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
