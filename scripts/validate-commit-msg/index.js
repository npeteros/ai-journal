#!/usr/bin/env node

import fs from 'fs'

// Conventional commit pattern (no scope allowed)
const COMMIT_PATTERN = /^(feat|fix|docs|style|refactor|perf|test|build|ci|chore|revert): .+/

const TYPES = {
  feat: 'A new feature',
  fix: 'A bug fix',
  docs: 'Documentation only changes',
  style: 'Changes that do not affect the meaning of the code',
  refactor: 'A code change that neither fixes a bug nor adds a feature',
  perf: 'A code change that improves performance',
  test: 'Adding missing tests or correcting existing tests',
  build: 'Changes that affect the build system or external dependencies',
  ci: 'Changes to CI configuration files and scripts',
  chore: "Other changes that don't modify src or test files",
  revert: 'Reverts a previous commit',
}

function validateCommitMessage(message) {
  const errors = []
  const lines = message.split('\n')
  const header = lines[0]

  // Reject scoped headers explicitly so the error is clear
  if (/^\w+\(.*\)!?:/.test(header)) {
    errors.push('Commit message must not include a scope')
    errors.push('')
    errors.push('Format: <type>: <subject>')
    errors.push('Example: feat: add login functionality')
    return errors
  }

  // Check if header matches conventional commit pattern
  if (!COMMIT_PATTERN.test(header)) {
    errors.push('Commit message does not follow Conventional Commits format')
    errors.push('')
    errors.push('Format: <type>: <subject>')
    errors.push('Example: feat: add login functionality')
    errors.push('')
    errors.push('Valid types:')
    Object.entries(TYPES).forEach(([type, desc]) => {
      errors.push(`  ${type.padEnd(10)} - ${desc}`)
    })
    return errors
  }

  // Extract type and subject
  const match = header.match(/^(\w+): (.+)/)
  if (match) {
    const [, type, subject] = match

    // Validate type
    if (!TYPES[type]) {
      errors.push(`Invalid type "${type}". Must be one of: ${Object.keys(TYPES).join(', ')}`)
    }

    // Check subject
    if (subject.length < 1) {
      errors.push('Subject cannot be empty')
    }
  }

  // Check blank line after header (if body exists)
  if (lines.length > 1 && lines[1] !== '') {
    errors.push('Blank line required between header and body')
  }

  // Check body line length
  if (lines.length > 2) {
    lines.slice(2).forEach((line, index) => {
      if (line.length > 100) {
        errors.push(
          `Body line ${index + 3} is too long (${line.length} characters). Maximum is 100 characters`,
        )
      }
    })
  }

  return errors
}

function main() {
  const commitMsgFile = process.argv[2]

  if (!commitMsgFile) {
    console.error('Error: No commit message file provided')
    process.exit(1)
  }

  try {
    const commitMessage = fs.readFileSync(commitMsgFile, 'utf8').trim()

    // Skip validation for merge commits, revert commits, etc.
    if (
      commitMessage.startsWith('Merge') ||
      commitMessage.startsWith('Revert') ||
      commitMessage.startsWith('Squash')
    ) {
      process.exit(0)
    }

    const errors = validateCommitMessage(commitMessage)

    if (errors.length > 0) {
      console.error('\n❌ Commit message validation failed:\n')
      errors.forEach((error) => console.error(`  ${error}`))
      console.error('\nYour commit message:')
      console.error(`  ${commitMessage.split('\n')[0]}`)
      console.error('')
      process.exit(1)
    }

    console.log('✅ Commit message validated successfully')
    process.exit(0)
  } catch (error) {
    console.error(`Error reading commit message: ${error.message}`)
    process.exit(1)
  }
}

main()
