# Tooling and script layout

Use the exact-pinned `@a2f0/agent-tool` through `bun run agent-tool` for shared
GitHub shipping, review, hooks, binary checks, validation reports, skill
installation, harness permission rules, and brand image rendering. The
[shared workflow reference](https://github.com/a2f0/agent-tool/blob/main/docs/workflows.md)
describes its commands; repository policy lives in `agent-tool.json` and
[AGENTS.md](../AGENTS.md). Do not edit installed managed skills.

Package scripts are the normal entrypoints for people, CI, and hooks. Keep
application builds, platform setup, tests, and provisioning here; shared workflow
mechanics belong in agent-tool. The
[matrix conventions](https://github.com/a2f0/matrix/blob/main/docs/tooling.md)
describe the ownership boundary across repositories.

## Toolchain

`mise install` installs the pinned tools. [mise](https://mise.jdx.dev/) reads
the Ruby and Node versions from `.ruby-version` and `.nvmrc`; `.mise.toml` adds
[Bun](https://bun.sh/), Gradle (for the wrapper jar),
[ShellCheck](https://www.shellcheck.net/),
[Emscripten](https://emscripten.org/) (for the web build of the C++ module),
and [Terraform](https://developer.hashicorp.com/terraform) (for
[sign-in provisioning](operations.md#sign-in)).

CI uses mise for Node, Bun, and ShellCheck. Emscripten reads its version from
`.mise.toml` through its dedicated setup action; Ruby, Java, and Gradle retain
their platform setup actions, pinned to match `.ruby-version`, `.java-version`,
and the Gradle version in `.mise.toml`. Bun installs JavaScript dependencies
from `bun.lock` and runs package scripts; Node remains the runtime for React
Native, Metro, Jest, and other Node CLI tools. See
[Dependency upgrades](dependency-upgrades.md#package-management) for
lifecycle-script trust and lockfile maintenance.

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

Feature branches use `<type>/<topic>`. `branch.types: null` inherits
`subject.types`, which uses agent-tool's default Conventional Commits types here.
Inspect the effective list with `bun run agent-tool config show`. `main` is
exempt; there is no extra length cap. Use
`bun run lint:branch-name [name]` to check an attached branch or an explicit
name, and `bun run agent-tool branch create <name> --base main --remote origin`
to create from a fetched base without a local upstream. CI checks its explicit
event branch; pre-push checks each non-deleted destination branch. GitHub-created
`patch-N` and `revert-N` branches must have their changes moved to a conforming
branch, such as `fix/correction` or `revert/change`, before requesting a merge.

## Hooks and validation

`bun install --frozen-lockfile` installs the tracked pre-push hook through
`bun run hooks:install`. Existing unmanaged hook targets require inspection and
explicit `bun run agent-tool hooks install --apply --adopt`; the installer backs
up replacements and preserves hooks it does not own. The pre-push hook first
checks installed-hook drift and destination branch names, then runs binary,
lint, skill, and permission checks. `bun run hooks:check` also runs in CI.

For a checkout previously using Husky, inspect its local setting with
`git config --local --get core.hooksPath`. If it is exactly `.husky/_`, remove
that obsolete local setting with `git config --local --unset core.hooksPath`
before installing dependencies. Leave other custom hook paths intact. Keep the
old generated files until they have been inspected; the new installer only owns
the files in its manifest and does not delete the old Husky directory.

`bun run check:binaries` checks branch changes; pass `--all` to check the entire
index as CI does, or `--staged` / `--range <range>` for an explicit scope. There
are no binary allowlist exceptions. Sources and generated-output ignores remain
the way this app keeps images and Gradle's wrapper jar out of Git; see
[Binary files](#binary-files).

`bun run check` runs all required non-native checks from
`scripts/testing/verify.json`, including Playwright and the WebAssembly build.
It requires the toolchain and Chromium setup in the development guide. Each run
records source state, step results, timings, and private log paths; inspect them
with `bun run agent-tool runs list`. A changed source tree invalidates a run.
Native build gates still follow [AGENTS.md](../AGENTS.md#validation).

## Binary files

Nothing binary is committed; the pre-push hook and CI reject it.

- **App icons** are rendered from `assets/brand/logo.svg` (the mark, on a
  transparent square) and `assets/brand/background.svg`: the iOS App Store
  icon, and the Android adaptive icon layers (background, foreground, and
  themed monochrome) plus legacy icons for Android 7. The `images` section of
  `agent-tool.json` declares each file's size, layers, and destination, and
  [agent-tool](https://github.com/a2f0/agent-tool/blob/main/docs/images.md),
  installed by `bun install --frozen-lockfile`, renders them. Builds regenerate
  them when the sources change (an Xcode build phase and a Gradle task before
  `preBuild`), or run `sh scripts/build/buildImages.sh [ios|android]`. The
  outputs are gitignored.
- **Web favicons** (`favicon.svg`, `favicon.ico`, and `apple-touch-icon.png`)
  and the 1200×630 social preview image (`og-image.png`) are the app icon
  rendered by the `favicons` target into `web/public/`, and gitignored.
  `bun run web` and `bun run build:web` render them first with
  `bun run build:favicons`, and Vite serves and copies them into `web/build`.
- **The Gradle wrapper jar** is regenerated by
  `scripts/dev/ensureGradleWrapper.sh`, which `bun install --frozen-lockfile`
  (with Gradle installed, and not on CI), `bun run android`, the Detox Android
  builds, and the fastlane Android lanes run first. Android Studio reads
  `gradle-wrapper.properties` and doesn't need the jar.
- **Debug builds** are signed with the Android Gradle plugin's default debug
  keystore (`~/.android/debug.keystore`), which it creates when missing.

## Documentation

The [README](../README.md) covers purpose, setup, and normal commands.
[Development](development.md) explains bridges, WebAssembly, and native/web
testing. [Operations](operations.md) owns provisioning, deployments, and store
releases. [Dependency upgrades](dependency-upgrades.md) owns reusable upgrade
steps and active constraints. Required validation and shipping policy stay in
[AGENTS.md](../AGENTS.md); run-specific evidence belongs in the pull request.
