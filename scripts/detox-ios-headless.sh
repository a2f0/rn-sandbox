#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

CONFIG="${DETOX_CONFIG:-ios.release}"

if [[ "${SKIP_BUILD:-0}" != "1" ]]; then
  npx detox build --configuration "$CONFIG"
fi

npx detox test --configuration "$CONFIG" --headless "$@"
