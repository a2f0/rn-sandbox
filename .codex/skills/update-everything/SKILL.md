---
name: update-everything
description: >
  Update React Native and related dependencies across this repository, align
  platform toolchains, run validations, and prepare the PR for review/merge.
  Use when doing broad dependency refreshes or React Native major/minor
  upgrades.
---

# Update Everything

Update dependencies and platform/toolchain configuration for `rn-sandbox`,
then verify the upgrade is shippable.

## Skill Composition

- For any React Native version change (major, minor, patch), you MUST invoke
  `../rn-upgrade-executor/SKILL.md` first.
- `update-everything` is blocked until `rn-upgrade-executor` completes its
  hard gates.
- Use this skill as the repo-wide wrapper for broader
  dependency/toolchain/workflow refresh tasks around that RN upgrade.

## Preflight

- Confirm you are not on `main`.
- Record current versions before changing:

```bash
node -v
cat .nvmrc
cat .ruby-version
cat .java-version
npm ls react-native react @react-native-community/cli --depth=0
```

- Ensure required tooling is present
  (`node`, `npm`, `bundle`, CocoaPods, Android SDK).

## Workflow

1. Required delegation gate (for RN upgrades):

   - Run `../rn-upgrade-executor/SKILL.md`.
   - If `rn-upgrade-executor` is not run, stop and do not continue this
     workflow.
   - If any `rn-upgrade-executor` hard gate fails, stop and fix there before
     resuming here.

1. Pin JS/RN dependency versions (no ranges):

   - Update `react-native`, `react`, RN CLI packages, and related RN
     ecosystem packages to exact versions in `package.json` (no `^` or `~`).
   - Commit only the pin changes first:

   ```bash
   git add package.json
   git commit -m "chore(deps): pin rn upgrade dependency versions"
   ```

1. Recreate lockfile from pinned versions:

   - Regenerate `package-lock.json` using the pinned `package.json`.
   - Commit the lockfile separately:

   ```bash
   npm install --package-lock-only
   git add package-lock.json
   git commit -m "chore(deps): refresh lockfile for pinned versions"
   ```

1. Apply RN template diffs:

   - Use React Native Upgrade Helper for target from/to versions.
   - Manually apply required diffs in `android/`, `ios/`, and config files.

1. Align toolchain versions with target RN support matrix:

   - Update `.nvmrc` for supported Node version.
   - Update `.ruby-version` for supported Ruby/CocoaPods lane.
   - Update `.java-version` for supported Android/Gradle JDK.
   - Ensure `package.json` `engines.node` remains consistent with `.nvmrc`.

1. Align GitHub Actions with toolchain changes:

   - Update `.github/workflows/main.yml` so `actions/setup-node`,
     `ruby/setup-ruby`, and `actions/setup-java` match local toolchain
     choices.
   - Keep Detox jobs (`detox-macos`, `detox-android`) runnable with the
     upgraded stack.

1. Reinstall platform dependencies as needed:

   ```bash
   npm ci
   bundle install
   (cd ios && bundle exec pod install)
   ```

1. Validate (repo test suite):

   ```bash
   npm run lint
   npm run lint:shell
   npm run test
   ./scripts/detox-ios-headless.sh --loglevel info
   ./scripts/detox-android-headless.sh --loglevel info
   ```

   - If a headless Detox script fails, debug and rerun the same script until
     it passes.
   - For quick isolation while debugging, you may run:

   ```bash
   npx detox build --configuration ios.release
   npx detox build --configuration android.release
   ```

1. Review and prepare PR:

   - Verify expected diffs in `android/`, `ios/`, lockfiles, toolchain files,
     and `.github/workflows/main.yml`.
   - Summarize from/to versions for RN, Node, Ruby, and Java.
   - Hand off to `/commit-and-push`, then `/solicit-gemini-review`, then
     `/enter-merge-queue`.

## Notes

- Prefer small, focused follow-up commits for CI or Gemini feedback to keep
  upgrade debugging fast.
- If toolchain support is ambiguous for the target RN version, call out
  uncertainty explicitly and stop before risky guesswork.
