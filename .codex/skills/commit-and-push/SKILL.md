---
name: commit-and-push
description: Commit staged changes and push the current branch, then create or update the PR for this repository. Use when work is ready to ship, especially for React Native major/minor upgrades that need explicit test evidence and Gemini review before merge.
---

# Commit and Push

Commit staged changes, push the branch, and keep the PR ready for review.

## Setup

Determine the repository for all `gh` commands:

```bash
REPO=$(gh repo view --json nameWithOwner -q .nameWithOwner)
```

Always pass `-R "$REPO"` to `gh` commands.

## Workflow

1. Check branch:
   - If on `main`, create a focused feature branch before committing.

2. Confirm changes:
   - Run `git status --short` and `git diff --staged`.
   - Ensure generated upgrade diffs are expected (`android/`, `ios/`, lockfiles, config files).

3. Validate before commit:
   - Run `npm run lint` and `npm run test`.
   - If the change includes native or RN version updates, also run at least one Detox build:

```bash
npx detox build --configuration ios.release
npx detox build --configuration android.release
```
   - If RN major/minor versions changed, verify toolchain alignment files were reviewed and updated as needed:
     - `.nvmrc` (Node version supported by target RN release)
     - `.ruby-version` (Ruby version supported by RN/CocoaPods toolchain)
     - `.java-version` (JDK version supported by RN Android/Gradle stack)
     - `.github/workflows/main.yml` (CI setup-node/setup-java/ruby matrix alignment)

4. Commit:
   - Use a conventional commit message (`feat:`, `fix:`, `chore:`).
   - Prefer signed commits when available:

```bash
git commit -S -m "chore: upgrade react-native to <version>" >/dev/null
```

   - If signing is unavailable, use an unsigned commit and proceed.

5. Push:

```bash
git push -u origin "$(git branch --show-current)" >/dev/null
```

6. Open or update PR:
   - If no PR exists for the branch, create one with `gh pr create`.
   - Keep PR body in this structure:

```text
## Summary
- <concrete change>

## Testing
- npm run lint
- npm run test
- <detox command(s) or "not run (reason)">

## Related
- <issue link or context>
```

   - For RN upgrades, include explicit from/to versions in `## Summary`.

7. Engage Gemini:
   - Run `/solicit-gemini-review`.
   - If Gemini leaves actionable comments, run `/address-gemini-feedback`.

## RN Upgrade Notes

When `react-native`, `react`, or CLI packages change versions:
- Call out any manual edits copied from Upgrade Helper.
- Mention platform-specific risk areas in PR summary (`ios/Podfile`, `android/gradle.properties`, `MainApplication`, `AppDelegate`).
- Confirm and document any toolchain version changes in `.nvmrc`, `.ruby-version`, `.java-version`, and `.github/workflows/main.yml`.
- Keep commits scoped so follow-up fixes from review are easy to trace.
