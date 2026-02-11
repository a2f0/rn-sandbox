---
name: rn-upgrade-executor
description: Execute a React Native major/minor upgrade in rn-sandbox with deterministic steps, repo-specific native diff checkpoints, validation gates, and failure playbooks. Use when upgrading react-native/react or RN CLI packages and you need more than a generic dependency update flow.
---

# RN Upgrade Executor

Run React Native upgrades using strict phases and hard pass/fail gates.

## Phase 0: Baseline Snapshot

1. Capture current versions and branch state:

```bash
git branch --show-current
git status --short
node -v
cat .nvmrc
cat .ruby-version
cat .java-version
npm ls react-native react @react-native-community/cli --depth=0
```

2. Stop if there are unrelated unstaged changes that could be overwritten.

## Phase 1: Version Plan

1. Decide target versions for:
- `react-native`
- `react`
- RN CLI packages
- Node/Ruby/Java toolchain files

2. Validate support compatibility before editing:
- Node vs RN target
- Ruby/CocoaPods lane vs RN target
- Java/Gradle vs RN target

3. Write a concise plan in the PR notes with exact from/to versions.

## Phase 2: Upgrade Execution

1. Update npm packages and lockfile.
2. Generate and review React Native Upgrade Helper diffs (required):
   - Build the URL with exact from/to versions:

```bash
FROM_RN="<current-rn-version>"
TO_RN="<target-rn-version>"
echo "https://react-native-community.github.io/upgrade-helper/?from=${FROM_RN}&to=${TO_RN}"
```

   - Open that URL and review all changed files.
   - For every file that overlaps this repo (especially `android/*.gradle`, `android/settings.gradle`, `ios/Podfile`, AppDelegate/MainApplication/MainActivity), apply the semantic changes here.
   - Do not blindly copy; preserve repo-specific customizations (Detox hooks, CI assumptions, shell scripts, etc.).
3. Apply repo-specific checkpoints from `references/known-diff-map.md` to ensure no upgrade-helper misses.
4. Align toolchain files:
- `.nvmrc`
- `.ruby-version`
- `.java-version`
- `package.json` `engines.node`

5. Align CI toolchain setup in `.github/workflows/main.yml`.

## Phase 3: Validation Matrix (Hard Gates)

Run in this order and stop on first failure:

```bash
npm run lint
npm run lint:shell
npm run test
npx detox build --configuration ios.release
npx detox build --configuration android.release
```

For local Android emulator ABI mismatches, use:

```bash
./scripts/detox-android-headless.sh
```

The helper script auto-selects ABI and config for arm64 local emulators.

## Phase 4: Failure Playbook

If any gate fails, use `references/failure-playbook.md` and fix one class of failure at a time:
- toolchain/setup mismatches
- iOS pod/build issues
- Android ABI/install/runtime crashes
- Detox runtime disconnects

Re-run only the failed gate plus its prerequisite gate after each fix.

## Phase 5: Ship

1. Summarize exact from/to versions and major manual diffs.
2. Commit focused changes.
3. Hand off to:
- `/commit-and-push`
- `/solicit-gemini-review`
- `/address-gemini-feedback` (if needed)
- `/enter-merge-queue`

## References

- Use `references/known-diff-map.md` for repo hotspots to verify every RN upgrade.
- Use `references/failure-playbook.md` for known failure signatures and exact remediation path.
- Use React Native Upgrade Helper as the source of truth for template diffs between RN versions:
  - `https://react-native-community.github.io/upgrade-helper/?from=<from>&to=<to>`
