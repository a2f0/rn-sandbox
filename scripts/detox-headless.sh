#!/bin/sh
set -eu

if [ "${1:-}" = "" ]; then
  echo "Usage: $0 <ios|android> [detox-test-args...]" >&2
  exit 1
fi

PLATFORM=$1
shift

ROOT_DIR=$(
  cd "$(dirname "$0")/.." || exit 1
  pwd
)
cd "$ROOT_DIR"

case "$PLATFORM" in
  ios|android)
    DEFAULT_CONFIG="${PLATFORM}.release"
    ;;
  *)
    echo "Unsupported platform: $PLATFORM (expected ios or android)" >&2
    exit 1
    ;;
esac

CONFIG=${DETOX_CONFIG:-$DEFAULT_CONFIG}

if [ "${SKIP_BUILD:-0}" != "1" ]; then
  npx detox build --configuration "$CONFIG"
fi

npx detox test --configuration "$CONFIG" --headless "$@"
