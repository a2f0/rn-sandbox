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

Rerun the advisory audits for every refresh and record remaining findings and
unsupported candidates in the PR. Earlier findings and upgrade decisions are
recorded in [PR #58](https://github.com/a2f0/rn-sandbox/pull/58); they are not a
current audit result.

For deployment changes, follow the [web deployment](../README.md#web) preview and
live resource verification requirements. A local Wrangler dry run does not verify
remote effects. Skip an upgrade if it would delete or recreate resources, or
those effects cannot be verified. Store the evidence in the PR; push and merge
workflows run tests without deploying.

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
