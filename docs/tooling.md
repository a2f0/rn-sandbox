# Tooling and script layout

Use the exact-pinned `@a2f0/agent-tool` through `bun run agent-tool` for shared
GitHub shipping, review, hooks, binary checks, validation reports, skill
installation, and brand image rendering. The
[shared workflow reference](https://github.com/a2f0/agent-tool/blob/main/docs/workflows.md)
describes its commands; repository policy lives in `agent-tool.json` and
[AGENTS.md](../AGENTS.md). Do not edit installed managed skills.

Package scripts are the normal entrypoints for people, CI, and hooks. Keep
application builds, platform setup, tests, and provisioning here; shared workflow
mechanics belong in agent-tool. The
[matrix conventions](https://github.com/a2f0/matrix/blob/main/docs/tooling.md)
describe the ownership boundary across repositories.

## Repository scripts

| Directory | Responsibility | Entrypoints |
| --- | --- | --- |
| `scripts/auth/` | Firebase/Identity Platform provisioning and its tests | `bun run auth:provision` |
| `scripts/build/` | WebAssembly compilation and native image build adapter | `bun run build:wasm`; Xcode and Gradle image tasks |
| `scripts/checks/` | Repository-specific tool regressions and policy checks | `bun run lint:md`; Jest tooling checks |
| `scripts/dev/` | Generate the ignored Gradle wrapper jar | Package preparation, Android and fastlane builds |
| `scripts/git/hooks/` | Tracked hook bodies copied by agent-tool | `bun run hooks:install`; `bun run hooks:check` |
| `scripts/testing/` | Headless Detox platform runners | `scripts/testing/detox-{ios,android}-headless.sh` |

The image adapter resolves the checkout and supplies a minimal IDE environment
before invoking agent-tool; image declarations remain in `agent-tool.json`.
The Gradle helper stays separate from build tasks because package preparation
may run it before any Android build. Keep `fastlane/` in the native application
root, with its existing lane, library, and test layout.

Moving a script includes its callers in package commands, CI, hooks, native
project inputs/build phases, fastlane lanes and tests, owned skills, and comments.
Resolve the repository root relative to the new location. Build-cache inputs
must refer to the moved implementation so script changes still invalidate output.

## Branches

Feature branches use `<type>/<topic>` with the Conventional Commits types from
`agent-tool.json`. `main` is exempt; there is no extra length cap. Use
`bun run lint:branch-name [name]` to check an attached branch or an explicit
name, and `bun run agent-tool branch create <name> --base main --remote origin`
to create from a fetched base without a local upstream. CI checks its explicit
event branch; pre-push checks each non-deleted destination branch.

## Hooks and validation

`bun install --frozen-lockfile` installs the tracked pre-push hook through
`bun run hooks:install`. Existing unmanaged hook targets require inspection and
explicit `bun run agent-tool hooks install --apply --adopt`; the installer backs
up replacements and preserves hooks it does not own. The pre-push hook first
checks installed-hook drift and destination branch names, then runs binary,
lint, and skill checks. `bun run hooks:check` also runs in CI.

For a checkout previously using Husky, inspect its local setting with
`git config --local --get core.hooksPath`. If it is exactly `.husky/_`, remove
that obsolete local setting with `git config --local --unset core.hooksPath`
before installing dependencies. Leave other custom hook paths intact. Keep the
old generated files until they have been inspected; the new installer only owns
the files in its manifest and does not delete the old Husky directory.

`bun run check:binaries` checks branch changes; pass `--all` to check the entire
index as CI does, or `--staged` / `--range <range>` for an explicit scope. There
are no binary allowlist exceptions. Sources and generated-output ignores remain
the way this app keeps images and Gradle's wrapper jar out of Git.

`bun run check` runs all required non-native checks from
`scripts/testing/verify.json`, including Playwright and the WebAssembly build.
It requires the toolchain and Chromium setup in the development guide. Each run
records source state, step results, timings, and private log paths; inspect them
with `bun run agent-tool runs list`. A changed source tree invalidates a run.
Native build gates still follow [AGENTS.md](../AGENTS.md#validation).

## Documentation

The [README](../README.md) covers purpose, setup, and normal commands.
[Development](development.md) explains bridges, WebAssembly, and native/web
testing. [Operations](operations.md) owns provisioning, deployments, and store
releases. [Dependency upgrades](dependency-upgrades.md) owns reusable upgrade
steps and active constraints. Required validation and shipping policy stay in
[AGENTS.md](../AGENTS.md); run-specific evidence belongs in the pull request.
