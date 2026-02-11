#!/bin/sh
set -eu

ROOT_DIR=$(
  cd "$(dirname "$0")/.." || exit 1
  pwd
)
cd "$ROOT_DIR"

CONFIG=${DETOX_CONFIG:-android.release}

if [ "${SKIP_BUILD:-0}" != "1" ]; then
  npx detox build --configuration "$CONFIG"
fi

npx detox test --configuration "$CONFIG" --headless "$@"
