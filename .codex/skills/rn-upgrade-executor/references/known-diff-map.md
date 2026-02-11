# Known Diff Map (rn-sandbox)

Check these files every RN major/minor upgrade even if auto-merge appears clean:

- `package.json`
  - `react-native`, `react`, CLI package versions
  - `engines.node`
- `package-lock.json`
- `.nvmrc`
- `.ruby-version`
- `.java-version`
- `.github/workflows/main.yml`
  - Node, Ruby, Java setup versions
- `android/build.gradle`
- `android/app/build.gradle`
  - Keep `androidTestImplementation("com.wix:detox:<version>")` aligned with `package.json` `devDependencies.detox`.
- `android/gradle.properties`
- `android/settings.gradle`
- `android/gradle/wrapper/gradle-wrapper.properties`
- `android/app/src/main/java/.../MainApplication.*`
- `android/app/src/main/java/.../MainActivity.*`
- `ios/Podfile`
- `ios/Podfile.lock`
- `ios/sandbox/AppDelegate.*`
- `metro.config.js`
- `babel.config.js`
- `jest.config.ts`
- `.detoxrc.json`
  - iOS simulator `bootArgs` for local audio-disable behavior must be preserved.
- `scripts/detox-*.sh`

For each file changed by Upgrade Helper:
- Verify semantic intent, not just textual diff.
- Keep project-specific customizations that are still required.
- Prefer additive commits for follow-up fixes.

Upgrade Helper cross-check rule:
- Every file touched in this repo that also appears in Upgrade Helper must be annotated in PR notes as one of:
  - `applied` (template intent adopted),
  - `intentionally diverged` (kept repo customization, with reason),
  - `not applicable` (template file/section irrelevant to this repo).
