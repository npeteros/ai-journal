#!/usr/bin/env node

import { execSync } from 'child_process'

// Branch name pattern: S<SPRINT>-<TICKET> (e.g., S1-03, S2-05)
const BRANCH_PATTERN = /^S[1-9]\d*-\d{2,}$/

// Allowed branch names that don't follow the pattern
const ALLOWED_BRANCHES = ['main', 'develop']

function getCurrentBranch() {
  try {
    const branch = execSync('git branch --show-current', { encoding: 'utf8' }).trim()
    return branch
  } catch (error) {
    console.error('Error getting current branch:', error.message)
    process.exit(1)
  }
}

function validateBranchName(branchName) {
  // Check if it's an allowed branch
  if (ALLOWED_BRANCHES.includes(branchName)) {
    return { valid: true, errors: [] }
  }

  // Check if it matches the required pattern
  if (!BRANCH_PATTERN.test(branchName)) {
    const errors = []
    errors.push(`Branch name "${branchName}" does not follow the required pattern`)
    errors.push('')
    errors.push('Required format: <TICKET-ID>  (S<SPRINT>-<TICKET>)')
    errors.push('')
    errors.push('Examples:')
    errors.push('  S1-03   - Sprint 1, ticket 03')
    errors.push('  S2-05   - Sprint 2, ticket 05')
    errors.push('  S10-112 - Sprint 10, ticket 112')
    errors.push('')
    errors.push('Allowed exceptions:')
    ALLOWED_BRANCHES.forEach((branch) => {
      errors.push(`  ${branch}`)
    })

    return { valid: false, errors }
  }

  return { valid: true, errors: [] }
}

function main() {
  const branchName = getCurrentBranch()

  if (!branchName) {
    console.error('Error: Could not determine current branch')
    process.exit(1)
  }

  const { valid, errors } = validateBranchName(branchName)

  if (!valid) {
    console.error('\n❌ Branch name validation failed:\n')
    errors.forEach((error) => console.error(`  ${error}`))
    console.error('')
    console.error('To fix this, rename your branch:')
    console.error(`  git branch -m ${branchName} <TICKET-ID>`)
    console.error('')
    process.exit(1)
  }

  console.log(`✅ Branch name "${branchName}" is valid`)
  process.exit(0)
}

main()
