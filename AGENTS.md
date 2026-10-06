# Repository guidance

Resolve the repository with
`gh repo view --json nameWithOwner -q .nameWithOwner` and pass it to `gh` with
`-R`; do not infer it from the folder name. Work on a feature branch, use
conventional commits, sign commits when signing is available, and preserve
unrelated edits. Do not force-push or add attribution footers. Do not create
GitHub issues without an explicit request.

## Agent tooling

Shipping and review skills come from the exactly pinned `@a2f0/agent-tool`
dev dependency and are managed in `.agents/skills` and `.claude/skills`. Do not
edit them. After changing its version, run `npm run agents:sync` and commit
`package.json`, `package-lock.json`, the skills, and `.agent-tool-skills.json`
together. The CLI runs under Bun, so Bun must be on `PATH`. Title and required
CI policy is in `agent-tool.json`.

npm installs the CLI in `node_modules/.bin`, which is not on `PATH`. Where the
skills run `agent-tool <arguments>`, run `npm run -s agent-tool -- <arguments>`
instead. npm keeps empty arguments, so this also works for `pr merge ''`.

The React Native skills, `rn-upgrade-executor` and `update-everything`, live in
`.agents/skills`, and `.claude/skills` links to them. Use them for React Native
upgrades and broad dependency refreshes.

## Binary files

Do not commit binary files. Generate them from text sources instead, as the app
icons (`assets/*.svg`, `scripts/buildImages.sh`) and the Gradle wrapper jar
(`scripts/ensureGradleWrapper.sh`) are; see the README. Tool versions come from
`.mise.toml`, `.ruby-version`, and `.nvmrc`.

## Validation

Run these checks before shipping. The pre-push hook runs the binary file, lint,
and agent checks; `lint:shell` needs ShellCheck.

- `sh scripts/checks/checkBinaryFiles.sh`
- `npm run lint`
- `npm run lint:md`
- `npm run lint:shell`
- `npm run test`
- `npm run agents:check`

Changes to native code, native dependencies, or React Native versions also need
a release Detox build for each affected platform:

```sh
npx detox build --configuration ios.release
npx detox build --configuration android.release
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

Gemini Code Assist (`gemini-code-assist`) reviews pull requests. If it has not
reviewed the current head, comment `/gemini review` on the PR and poll every 30
seconds for up to 5 minutes; it does not always respond. Fix valid findings,
then reply in each original thread with
`POST /repos/{owner}/{repo}/pulls/{pull_number}/comments/{comment_id}/replies`,
tagging `@gemini-code-assist` and naming the fixing commit. Do not reply with
top-level PR comments or `gh pr review`. Resolve a thread only when its finding
is fully addressed.

## Shipping

Ship with the `ship-pr` skill. `main` accepts squash merges only, and its
branch protection requires the `code-quality (20)`, `detox-android (20)`, and
`detox-macos (20, 3.3)` checks to pass on a head that contains the latest
`main`. Integrate an updated base with a normal merge. `detox-macos` takes
about 25 minutes. If the same job fails three times in a row, stop and report
it. Merging deploys nothing.
