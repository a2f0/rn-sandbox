# Repository guidance

Resolve the repository with
`gh repo view --json nameWithOwner -q .nameWithOwner` and pass it to `gh` with
`-R`; do not infer it from the folder name. Work on a feature branch, use
conventional commits and `<type>/<topic>` branch names, sign commits when
signing is available, and preserve unrelated edits. Do not force-push or add
attribution footers. Do not create GitHub issues without an explicit request.

## Agent tooling

Shipping and review skills come from the exactly pinned `@a2f0/agent-tool`
dev dependency and are managed in `.agents/skills` and `.claude/skills`. Do not
edit them. After changing its version, run `bun run agents:sync` and commit
`package.json`, `bun.lock`, the skills, and `.agent-tool-skills.json`
together. The CLI runs under Bun, so Bun must be on `PATH`. Title and required
CI policy is in `agent-tool.json`.

Where the skills run `agent-tool <arguments>`, run
`bun run agent-tool <arguments>`. For commands needing a literal empty argument,
invoke `node_modules/.bin/agent-tool` directly.

Capture noisy finite commands with `bun run agent:run --label <name> --
<command> <arguments>`. The harness preserves exit status and full private logs,
returning a compact receipt and a bounded failure excerpt. Inspect more evidence
with `bun run agent-tool logs <log-path>` or a targeted search; review
required warnings, timings, and artifacts before accepting a check. Keep review
verdicts and structured decision output visible. Run interactive tools and
persistent servers directly.
Keep `--label <name>` before the separator; Bun strips a leading `--` from
script arguments.

Use the shared `update-dependencies` skill for dependency refreshes, including
compatibility checks, advisories, and non-destructive deployment previews.
Managed skill directories are excluded from the local Markdown style checker;
`agents:check` verifies both installed copies instead. Repository-owned skills
still run through `lint:md`.

Start dependency refreshes with `update-dependencies`, then use the
repository's `update-everything` skill to add React Native gates and
`rn-upgrade-executor` for a native version upgrade. These repository-owned
skills live in `.agents/skills`, and `.claude/skills` links to them.

Keep README focused on purpose, setup, and normal usage. Store reusable upgrade
guidance and active compatibility or security constraints in
[docs/dependency-upgrades.md](docs/dependency-upgrades.md), updating or removing
obsolete guidance. Put each run's version inventory, audit findings, validation,
and deployment preview evidence in its PR; do not accumulate upgrade journals in
README or maintenance docs.

## Binary files

Do not commit binary files. Generate them from text sources instead, as the app
icons (`assets/brand/*.svg`, `scripts/build/buildImages.sh`) and the Gradle
wrapper jar (`scripts/dev/ensureGradleWrapper.sh`) are; see the README.
Tool versions come from `.mise.toml`, `.ruby-version`, and `.nvmrc`.

## Validation

Run `bun run check` to record the complete validation group, or run each
command below before shipping. The pre-push hook runs the binary file, lint,
and agent checks; `lint:shell` needs ShellCheck, and `lint:ruby` needs
`bundle install`.

- `bun run agent:run --label binary -- bun run check:binaries --all`
- `bun run lint:branch-name`
- `bun run hooks:check`
- `bun run agent:run --label lint -- bun run lint`
- `bun run agent:run --label markdown -- bun run lint:md`
- `bun run agent:run --label shell -- bun run lint:shell`
- `bun run agent:run --label ruby -- bun run lint:ruby`
- `bun run agent:run --label tests -- bun run test` (builds WebAssembly and runs
  the fastlane tests; needs Emscripten and Ruby)
- `bun run agent:run --label web -- bun run test:web` (Playwright; needs Chromium)
- `bun run agents:check`

Install Chromium with:

```sh
bun run agent:run --label chromium -- bunx playwright install chromium
```

See [docs/tooling.md](docs/tooling.md) for script ownership and layout,
[docs/development.md](docs/development.md) for native/web development, and
[docs/operations.md](docs/operations.md) for provisioning and releases.

The TurboModule specs in `specs/` have Kotlin, Objective-C++, C++, and
TypeScript implementations; the C++ binds to JSI on iOS and Android and to
Embind for WebAssembly on the web. See the development guide. A spec change
needs every implementation updated.

Changes to native code, native dependencies, React Native versions, or `specs/`
also need a release Detox build for each affected platform:

```sh
bun run agent:run --label ios-build -- bunx detox build --configuration ios.release
bun run agent:run --label android-build -- bunx detox build --configuration android.release
```

## Pull requests

Describe pull requests under `## Summary`, `## Testing`, and `## Related`. List
each validation command under Testing, or say why Detox was not run. For React
Native upgrades, give exact from/to versions, call out edits copied from the
Upgrade Helper, and name risky native files such as `ios/Podfile`,
`android/gradle.properties`, `MainApplication`, and `AppDelegate`. Note any
change to `.nvmrc`, `.ruby-version`, `.java-version`, or the toolchain setup in
`.github/workflows/main.yml`.

## Review feedback

Use `bun run agent-tool pr threads list` to inspect review feedback. Fix valid
findings and use `pr threads reply <comment-id> --body-file <file>` to reply in
the original thread with the fixing commit. Resolve fully addressed findings
with `pr threads resolve <thread-id>`; keep unresolved findings open.

## Shipping

Ship with the `ship-pr` skill. `main` accepts squash merges only, and its
branch protection requires the `code-quality (20)`, `detox-android (20)`, and
`detox-macos (20, 3.3)` checks to pass on a head that contains the latest
`main`. Integrate an updated base with a normal merge. `detox-macos` takes
about 10 minutes. If the same job fails three times in a row, stop and report
it. Merging deploys nothing: `bun run ios:upload-release` and
`bun run android:upload-release` ship the store builds through fastlane, and
`bun run deploy:web` the web build (see the operations guide).
