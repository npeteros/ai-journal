# Lefthook Conventional Commit Message Validator

A JavaScript-based commit message validator for lefthook that enforces Conventional Commits format.

## Conventional Commit Format

```bash
<type>: <subject>

<body>

<footer>
```

### Valid Types

- **feat**: A new feature
- **fix**: A bug fix
- **docs**: Documentation only changes
- **style**: Changes that do not affect the meaning of the code
- **refactor**: A code change that neither fixes a bug nor adds a feature
- **perf**: A code change that improves performance
- **test**: Adding missing tests or correcting existing tests
- **build**: Changes that affect the build system or external dependencies
- **ci**: Changes to CI configuration files and scripts
- **chore**: Other changes that don't modify src or test files
- **revert**: Reverts a previous commit

### Examples

✅ **Valid commits:**

```bash
feat: add JWT token validation
fix: resolve null pointer exception in user service
docs: update README with installation steps
chore: bump dependencies
```

❌ **Invalid commits:**

````bash
Added new feature              # Missing type
feat(auth): add login          # Scope is not allowed
feat:add login                 # Missing space after colon
Feat: add login                # Type must be lowercase
feat: Add login feature        # Subject must start with lowercase
feat: add login feature.       # Subject must not end with period```

## Validation Rules

1. **Type**: Must be one of the valid types listed above
2. **Scope**: Not allowed — `feat(auth): ...` is rejected
3. **Subject**:
   - Must not be empty (no length limit)
   - Must start with lowercase letter
   - Must not end with a period
4. **Body** (optional):
   - Must be separated from header by blank line
   - Lines should not exceed 100 characters
5. **Footer** (optional): For breaking changes or issue references

### Skip Validation for Certain Commits

The script automatically skips validation for:

- Merge commits
- Revert commits
- Squash commits

## Testing the Hook

Try making a commit with an invalid message:

```bash
git commit -m "Added feature"
````

You should see validation errors.

Try with a valid message:

```bash
git commit -m "feat: add user authentication"
```

This should succeed.

## Bypassing the Hook (Not Recommended)

If you absolutely need to bypass validation:

```bash
git commit --no-verify -m "emergency fix"
```

## Integration with Package.json

Running `npm install` will automatically set up the hooks for new developers.

## Troubleshooting

**Hook not running:**

- Verify lefthook is installed: `npx lefthook version`
- Reinstall hooks: `npx lefthook install`

**Node not found:**

- Ensure Node.js is in your PATH

**False positives:**

- Review the validation rules in the script
- Adjust patterns or add exceptions as needed
