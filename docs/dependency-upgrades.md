# Dependency upgrades

Use this document for reusable upgrade guidance and active constraints. Update
or remove guidance when it stops applying. Keep each upgrade's version inventory,
audit findings, validation results, and deployment preview evidence in its PR.
Do not append run reports here or in the [README](../README.md).

## Workflow

Start with the managed
[update-dependencies skill](../.agents/skills/update-dependencies/SKILL.md), then
use the repository-owned
[update-everything skill](../.agents/skills/update-everything/SKILL.md) for React
Native gates and
[rn-upgrade-executor](../.agents/skills/rn-upgrade-executor/SKILL.md) when changing
React Native. [AGENTS.md](../AGENTS.md) defines setup, validation, and PR policy.

Select supported dependency groups: React and its renderers, Babel and Metro,
Ruby and CocoaPods, and the Android toolchain. Registry peer ranges alone do not
establish native compatibility. Use the
[Upgrade Helper](https://react-native-community.github.io/upgrade-helper/) to
review template changes for the exact from/to versions, preserving the
repository's native customizations. Keep local toolchain files and CI aligned;
the Emscripten version comes from `.mise.toml`.

After changing React Native, refresh its cached prebuilt podspecs with
`cd ios && bundle exec pod update React-Core-prebuilt hermes-engine --no-repo-update`.
These pods take their versions from the installed React Native package; do not
select their versions independently. Check the prebuilt core version and Hermes
runtime version in `Podfile.lock`, then run `bundle exec pod install --deployment`
to verify the committed lock agrees with the installed framework. CI uses this
frozen install too; an ordinary install can retain a stale prebuilt core or
silently rewrite an inconsistent lock.

Hermes' external-source `:tag` is a CocoaPods cache key read from React Native's
`sdks/.hermesv1version`, not the runtime artifact version. The framework's
[setup helper](https://github.com/facebook/react-native/blob/v0.88.0/packages/react-native/scripts/cocoapods/jsengine.rb)
documents this distinction. Verify `sdks/hermes-engine/version.properties` and
the generated Hermes podspec's download URL; do not rewrite the tag to match
the runtime version when upstream ships different values.

Rerun the advisory audits for every refresh and record remaining findings and
unsupported candidates in the PR. Earlier findings and upgrade decisions are
recorded in [PR #58](https://github.com/a2f0/rn-sandbox/pull/58); they are not a
current audit result.

For deployment changes, follow the [web deployment](../README.md#web) preview and
live resource verification requirements. A local Wrangler dry run does not verify
remote effects. Skip an upgrade if it would delete or recreate resources, or
those effects cannot be verified. Store the evidence in the PR; push and merge
workflows run tests without deploying.

## Compatibility constraints

- React Native owns the React renderer, Babel 7 preset, Metro, Hermes, native
  pods, and Android toolchain. Keep Gradle, AGP, Kotlin, SDK, and NDK on the
  selected release's [template](https://github.com/react-native-community/rn-diff-purge)
  and Gradle plugin versions until both release builds and headless Detox suites
  validate a newer supported combination. React Native 0.88 still supports this
  app's existing AppDelegate lifecycle; its new SceneDelegate template is an
  optional lifecycle migration, which needs launch and URL callback tests before
  adoption.
- Keep TypeScript 6 while Jest's TypeScript configuration loads through
  `ts-node` and its JavaScript compiler API. [TypeScript 7](https://devblogs.microsoft.com/typescript/announcing-typescript-7-0/)
  uses the native compiler. Revisit when the configuration loader supports that
  compiler, and verify both Jest and Detox configuration loading.
- Firebase's Node requirement is now 24.12 or newer. Keep `.nvmrc` on the
  maintained Node 24 LTS line and the package engine consistent with Firebase's
  [published manifests](https://registry.npmjs.org/@firebase/app/latest).
- CocoaPods Core requires ActiveSupport below 8. Keep Ruby on the supported
  3.3 lane and ActiveSupport 7 until CocoaPods' [dependency requirements](https://rubygems.org/gems/cocoapods-core)
  and native builds support the newer combination.
- Terraform/provider and Wrangler upgrades need the real-state and live-resource
  checks above. Fastlane's store lanes create identifiers/profiles, manage
  signing keychains, and publish builds; do not execute them as an upgrade test.
  Hold store-tool upgrades without an equivalent non-destructive preview of the
  affected operations.

## Outstanding upstream advisories

The following tool dependencies currently lack a compatible owner update.
Re-audit them on every refresh; advisory counts belong in the PR.

- Gradle 9.4.1 is affected by the three high-severity advisories fixed in
  [Gradle 9.8.1](https://docs.gradle.org/9.8.1/release-notes.html).
  React Native 0.88's included Gradle settings plugin pins Kotlin 2.2.0, which
  cannot compile against Gradle 9.8.1's Kotlin 2.4 metadata. The public 8.14.6
  fix is below the Android Gradle plugin's minimum Gradle version. Revisit when
  React Native ships a compatible plugin or a supported public fix becomes
  available; require wrapper generation, Android release build, and headless
  Detox checks. Do not bypass Kotlin metadata compatibility checks.
- Metro, React Native CLI, and Jest use Micromatch/Braces. The latest Braces
  release is affected by [nested-pattern stack exhaustion](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm).
  Revisit when a patched release exists; validate bundling and both test runners.
- Jest's Istanbul configuration loader uses js-yaml 3, Argparse, and sprintf-js.
  sprintf-js has [unbounded precision handling](https://github.com/advisories/GHSA-hp3w-g68c-fv3c)
  with no patched release. Revisit an upstream loader update and test coverage
  configuration parsing before changing that parser chain.
- Markdownlint's math extension restricts KaTeX to its 0.16 line, below the
  [prototype-pollution gadget fix](https://github.com/advisories/GHSA-238p-pmpm-9mq7)
  in 0.18.2. The advisory requires prior prototype pollution and rendered output
  inserted into a page; this dependency is used by the Markdown linter. Remove
  the constraint when the owning extension accepts a fixed release and Markdown
  regression checks pass.
- Detox and its logger use stream-json 1, while fixes for
  [nested filtering](https://github.com/advisories/GHSA-528h-pc64-c93x),
  [JSONC parsing](https://github.com/advisories/GHSA-hqr4-qq8f-hg3x), and
  [prototype injection](https://github.com/advisories/GHSA-mjw6-4jj6-33hc)
  require the 3.6 line or newer. Do not force the incompatible major into Detox;
  revisit its owner releases and run both native suites.

## Security overrides

The version-scoped overrides in [package.json](../package.json) preserve the
fixes and compatibility decisions documented in
[PR #58](https://github.com/a2f0/rn-sandbox/pull/58):

- Miniflare's Sharp override fixes
  [GHSA-wq5f-xc86-pv6w](https://github.com/advisories/GHSA-wq5f-xc86-pv6w).
  `node scripts/checks/checkWranglerImages.mjs` checks the resolved version and
  exercises Wrangler's actual local Images emulator. The application's Worker
  has no Images binding.
- The Markdown CLI overrides retain its supported YAML API and fix the TOML
  parser's
  [GHSA-r4xh-jqrq-34v2](https://github.com/advisories/GHSA-r4xh-jqrq-34v2).
  Markdownlint CLI merges explicit TOML configuration through `deep-extend`,
  converting smol-toml's null-prototype tables into ordinary rule options.
  `npm run test:markdownlint` checks the installed CLI with nested TOML options,
  disabled rules, severity, inherited configuration, YAML, JSON, JavaScript class
  options, and many flat TOML keys. `lint:md` runs these regressions first. Keep
  this boundary tested when upgrading the CLI or replacing its merger.

Remove an override when its owning package resolves the patched dependency
itself and the corresponding Images emulator or Markdown configuration tests
still pass. Update this section to describe the remaining active constraints.
