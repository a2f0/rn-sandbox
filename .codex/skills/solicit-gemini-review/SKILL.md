---
name: solicit-gemini-review
description: >
  Request Gemini Code Assist review on the active PR, wait for review
  activity, and summarize actionable comments. Use after pushing meaningful
  code changes, especially after React Native upgrade commits.
---

# Solicit Gemini Review

Request a new Gemini review and summarize what needs action.

## Setup

```bash
REPO=$(gh repo view --json nameWithOwner -q .nameWithOwner)
PR_NUM=$(gh pr view --json number -q .number -R "$REPO")
```

## Workflow

1. Trigger review:

   ```bash
   gh pr comment "$PR_NUM" -R "$REPO" --body "/gemini review"
   ```

1. Wait for Gemini (poll every 30s, max 5 minutes):

   ```bash
   gh pr view "$PR_NUM" -R "$REPO" --json reviews \
     --jq '.reviews[] | select(.author.login == "gemini-code-assist")'
   ```

1. Pull inline comments:

   ```bash
   gh api "/repos/$REPO/pulls/$PR_NUM/comments" \
     --jq '.[] | select(.user.login == "gemini-code-assist[bot]")
       | {id,path,line,body}'
   ```

1. Report:

   - Whether Gemini reviewed.
   - Which comments are actionable/unresolved.
   - Whether to run `/address-gemini-feedback`.

## RN Upgrade Focus

During major upgrade PRs, prioritize Gemini comments touching:

- `android/build.gradle*`, `gradle.properties`, `settings.gradle`
- `ios/Podfile*`, `AppDelegate*`
- Metro/Babel/Jest config and package version alignment
