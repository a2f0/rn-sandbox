---
name: update-everything
description: Update React Native and related dependencies across this repository, align platform toolchains, run validations, and prepare the PR for review/merge. Use when doing broad dependency refreshes or React Native major/minor upgrades.
---

# Update Everything

Update dependencies and platform/toolchain configuration for `rn-sandbox`, then verify the upgrade is shippable.

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

- Ensure required tooling is present (`node`, `npm`, `bundle`, CocoaPods, Android SDK).

## Workflow

1. Upgrade JS/RN dependencies:
   - Update `react-native`, `react`, RN CLI packages, and related RN ecosystem packages.
   - Run `npm install` to refresh `package-lock.json`.

2. Apply RN template diffs:
   - Use React Native Upgrade Helper for target from/to versions.
   - Manually apply required diffs in `android/`, `ios/`, and config files.

3. Align toolchain versions with target RN support matrix:
   - Update `.nvmrc` for supported Node version.
   - Update `.ruby-version` for supported Ruby/CocoaPods lane.
   - Update `.java-version` for supported Android/Gradle JDK.
   - Ensure `package.json` `engines.node` remains consistent with `.nvmrc`.

4. Align GitHub Actions with toolchain changes:
   - Update `.github/workflows/main.yml` so `actions/setup-node`, `ruby/setup-ruby`, and `actions/setup-java` match local toolchain choices.
   - Keep Detox jobs (`detox-macos`, `detox-android`) runnable with the upgraded stack.

5. Reinstall platform dependencies as needed:

```bash
npm ci
bundle install
(cd ios && bundle exec pod install)
```

6. Validate:

```bash
npm run lint
npm run test
npx detox build --configuration ios.release
npx detox build --configuration android.release
```

7. Review and prepare PR:
   - Verify expected diffs in `android/`, `ios/`, lockfiles, toolchain files, and `.github/workflows/main.yml`.
   - Summarize from/to versions for RN, Node, Ruby, and Java.
   - Hand off to `/commit-and-push`, then `/solicit-gemini-review`, then `/enter-merge-queue`.

## Notes

- Prefer small, focused follow-up commits for CI or Gemini feedback to keep upgrade debugging fast.
- If toolchain support is ambiguous for the target RN version, call out uncertainty explicitly and stop before risky guesswork.
