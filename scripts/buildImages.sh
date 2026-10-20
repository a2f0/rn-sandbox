#!/bin/sh
set -eu

# Renders the app icons from assets/brand/*.svg with agent-tool, as the images
# section of agent-tool.json declares. Pass target names (ios, android) to
# build only those; with none, it builds every target. Outputs are gitignored.
# The Xcode build phase and the Gradle generateImages task run it.

REPO_ROOT="$(CDPATH='' cd -- "$(dirname -- "$0")/.." && pwd -P)"
AGENT_TOOL="$REPO_ROOT/node_modules/.bin/agent-tool"

# Xcode and Android Studio run builds with a minimal PATH, and agent-tool runs
# under Bun.
PATH="$PATH:$HOME/.bun/bin:$HOME/.local/share/mise/shims:/opt/homebrew/bin:/usr/local/bin"
export PATH

if [ ! -x "$AGENT_TOOL" ]; then
  echo "Error: $AGENT_TOOL not found. Run npm ci first." >&2
  exit 1
fi
if ! command -v bun >/dev/null 2>&1; then
  echo "Error: Bun is required to build images. Install it with mise install (see the README)." >&2
  exit 1
fi

exec "$AGENT_TOOL" --repo "$REPO_ROOT" images build "$@"
