# Lefthook Branch Name Validator

A JavaScript-based branch name validator for lefthook that enforces a consistent branch naming convention.

## Branch Naming Convention

Branch names must be the ticket ID: `S<SPRINT>-<TICKET>`

- **S<SPRINT>** - `S` followed by the sprint number (no leading zero)
- **<TICKET>** - The ticket number within the sprint, at least two digits (zero-padded)

### Protected Branches (Exempt from Pattern)

- `main`
- `develop`

### Install the git hook

```bash
npx lefthook install
```

## Usage

### Creating Valid Branches

✅ **Valid branch names:**

```bash
git checkout -b S1-03
git checkout -b S2-05
git checkout -b S10-112
```

✅ **Protected branches (always valid):**

```bash
git checkout -b main
git checkout -b develop
```

❌ **Invalid branch names:**

```bash
git checkout -b feature-login        # Not a ticket ID
git checkout -b s1-03                # Lowercase "s"
git checkout -b S1-3                 # Ticket must be at least two digits
git checkout -b S01-03               # Sprint cannot have a leading zero
git checkout -b S1                   # Missing ticket
git checkout -b S1-03-login          # Extra suffix not allowed
git checkout -b S1_03                # Wrong separator (use hyphen)
```

## Validation Timing

### Pre-Push (Recommended)

By default, validation runs on `pre-push`, which means:

- You can work locally with any branch name
- Validation occurs only when pushing to remote
- Prevents invalid branch names from reaching the repository

### Pre-Commit (Alternative)

To validate on every commit, update `lefthook.yml`:

```yaml
pre-commit:
  commands:
    validate-branch-name:
      run: node scripts/validate-branch-name/index.js
```

This provides earlier feedback but runs more frequently.

## Examples

### Example 1: Creating a New Ticket Branch

```bash
# Starting work on sprint 1, ticket 03
git checkout -b S1-03

# Make changes and commit
git add .
git commit -m "feat: add JWT token validation"

# Push to remote - validation passes ✅
git push origin S1-03
```

### Example 2: Invalid Branch Name

```bash
# Attempting to create branch with wrong format
git checkout -b feature-login

# Make changes and commit
git add .
git commit -m "feat: add login"

# Try to push - validation fails ❌
git push origin feature-login
```

### Example 3: Fixing Invalid Branch Name

```bash
# Rename the branch
git branch -m feature-login S1-03

# Push again - validation passes ✅
git push origin S1-03
```

## Bypassing Validation (Emergency Use Only)

If you absolutely must bypass validation:

```bash
git push --no-verify origin branch-name
```

⚠️ **Warning**: This should only be used in emergencies. Invalid branch names can cause confusion and break automated workflows.

## Troubleshooting

### Hook not running

```bash
# Verify lefthook is installed
npx lefthook version

# Reinstall hooks
npx lefthook install
```

### Branch name not detected

```bash
# Verify git is working
git branch --show-current

# Check if in detached HEAD state
git status
```

### Node not found

```bash
# Check Node.js installation
node --version

# Ensure Node is in PATH
which node
```

### Validation passing but shouldn't

```bash
# Test the script directly
node scripts/validate-branch-name/index.js

# Check current branch
git branch --show-current

# Verify lefthook config
npx lefthook run pre-push
```

## FAQ

**Q: Can I add a description after the ticket ID?**  
A: No, the branch name must be exactly the ticket ID (e.g., `S1-03`).

**Q: What about hotfix or bugfix branches?**  
A: Use the ticket ID for the fix (e.g., `S2-07`).

**Q: Can I have a branch without a ticket ID?**  
A: Only `main` and `develop` are exempt. All other branches must be a ticket ID.

**Q: How do I handle branch names for experiments?**  
A: Create a ticket for it, or add your branch to `ALLOWED_BRANCHES` temporarily.

**Q: Should I validate on pre-commit or pre-push?**  
A: Pre-push is recommended as it's less intrusive while still preventing invalid names from reaching remote.
