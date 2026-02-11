---
name: enter-merge-queue
description: >
  Drive a PR to merge by continuously rebasing, monitoring CI, handling
  Gemini feedback in-thread, and keeping auto-merge enabled. Use when you
  need to babysit an RN-sandbox PR through merge queue conditions, including
  large React Native upgrade branches.
---

# Enter Merge Queue

Ensure a PR merges by looping through branch freshness, CI, and review
feedback until state is `MERGED`.

## Setup

Determine the repository for all `gh` commands:

```bash
REPO=$(gh repo view --json nameWithOwner -q .nameWithOwner)
```

Always pass `-R "$REPO"` to `gh` commands.

Track:

- `has_waited_for_gemini=false`
- `job_failure_counts` map by job name
- `RUN_ID` for current commit workflow run

## Workflow

1. Load PR metadata:

   ```bash
   gh pr view --json \
     number,title,headRefName,baseRefName,url,state,mergeStateStatus,mergeable \
     -R "$REPO"
   ```

1. Ensure local branch matches PR head branch.

1. Loop until merged:

   1. Refresh merge state:

      ```bash
      gh pr view --json state,mergeStateStatus,mergeable,reviewDecision \
        -R "$REPO"
      ```

      - If `state == MERGED`, stop.
      - If `mergeStateStatus == BEHIND`, rebase and force-push.
      - If `BLOCKED`/`UNKNOWN`, process Gemini and CI in parallel.
      - If `CLEAN`, enable auto-merge and keep polling.

   1. Rebase when behind:

      ```bash
      BASE_REF_NAME=$(gh pr view --json baseRefName -q .baseRefName -R "$REPO")
      git fetch origin "$BASE_REF_NAME" >/dev/null
      git rebase "origin/$BASE_REF_NAME" >/dev/null
      ```

      If conflicts occur during RN upgrade files:

      - Keep intentional upgrade edits from this branch.
      - Preserve already-merged base fixes when conflict is unrelated to
        upgrade.
      - If uncertain, stop and ask for manual direction rather than guessing.

      Push:

      ```bash
      git push --force-with-lease >/dev/null
      ```

      Reset `job_failure_counts` after each rebase.

   1. Request and address Gemini early:

      - If `has_waited_for_gemini` is false, wait up to 5 minutes (30s polls)
        for Gemini review activity.
      - Handle feedback with `/address-gemini-feedback` while CI is still
        running.
      - Resolve threads only after Gemini confirms.

   1. Monitor CI jobs for current HEAD:

      ```bash
      COMMIT=$(git rev-parse HEAD)
      RUN_ID=$(gh run list --commit "$COMMIT" --limit 1 \
        --json databaseId --jq '.[0].databaseId' -R "$REPO")
      gh run view "$RUN_ID" --json jobs \
        --jq '.jobs[] | {name,status,conclusion}' -R "$REPO"
      ```

      Prioritize failures in these repo job names:

      - `code-quality`
      - `detox-macos`
      - `detox-android`

      On failure:

      - Fix immediately, commit, and push.
      - Cancel stale run after pushing new fixes:

      ```bash
      gh run cancel "$RUN_ID" -R "$REPO"
      ```

      If the same job fails 3 consecutive times, escalate to user.

   1. Enable auto-merge once checks pass and branch is up-to-date:

      ```bash
      gh pr merge --auto --merge -R "$REPO"
      ```

      Continue polling after enabling auto-merge; do not exit until PR state
      is `MERGED`.

## RN Upgrade Rules

For major/minor React Native upgrades:

- Confirm the PR description lists from/to versions and manual Upgrade Helper
  diffs.
- Confirm Node/Ruby/Java and CI alignment is explicit in PR updates:
  - `.nvmrc` and `package.json` engines
  - `.ruby-version` and any workflow Ruby setup
  - `.java-version` and `.github/workflows/main.yml` Java setup
- Prefer quick rebases and smaller follow-up commits to keep CI/debug loops
  short.
- Re-run targeted checks after native conflict resolution:

```bash
npm run lint
npm run test
npx detox build --configuration ios.release
npx detox build --configuration android.release
```
