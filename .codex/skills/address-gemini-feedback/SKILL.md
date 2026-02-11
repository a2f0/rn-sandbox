---
name: address-gemini-feedback
description: Resolve Gemini review comments on the current PR using in-thread REST replies, then verify fixes with repository tests. Use when Gemini flags regressions, upgrade risks, or CI-related issues.
---

# Address Gemini Feedback

Fix actionable Gemini comments and reply in-thread with commit evidence.

## Setup

```bash
REPO=$(gh repo view --json nameWithOwner -q .nameWithOwner)
PR_NUM=$(gh pr view --json number -q .number -R "$REPO")
```

## Critical Rules

- Never use `gh pr review` for threaded Gemini replies.
- Reply directly to review comments via pull-request comments REST endpoints.
- Include `@gemini-code-assist` in each reply.

## Workflow

1. Fetch Gemini inline comments:

```bash
gh api "/repos/$REPO/pulls/$PR_NUM/comments" \
  --jq '.[] | select(.user.login == "gemini-code-assist[bot]") | {id,path,line,body}'
```

2. Implement fixes for unresolved actionable comments.

3. Run validation:

```bash
npm run lint
npm run test
```

If comment touches native upgrade behavior, also run one or both:

```bash
npx detox build --configuration ios.release
npx detox build --configuration android.release
```

4. Commit and push fixes directly:

```bash
git add -A
git commit -m "fix: address gemini feedback" >/dev/null
git push >/dev/null
```

5. Reply in-thread for each addressed comment:

```bash
gh api -X POST "/repos/$REPO/pulls/$PR_NUM/comments/<comment_id>/replies" \
  -f body="@gemini-code-assist Fixed in <commit_sha>. Please confirm this addresses the issue."
```

6. Iterate until no actionable unresolved Gemini comments remain.

## RN Upgrade Guidance

For RN major upgrades, give concrete reply context:
- Name exact file and behavior changed.
- Include commit SHA after push so GitHub links resolve.
- Ask explicitly for confirmation before resolving the thread.
