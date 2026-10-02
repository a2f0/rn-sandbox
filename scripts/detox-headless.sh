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

# For Android, prefer an emulator-compatible ABI locally.
# CI can still force x86_64 by setting RN_ANDROID_ARCH explicitly.
if [ "$PLATFORM" = "android" ] && [ "${RN_ANDROID_ARCH:-}" = "" ]; then
  AVD_NAME=${DETOX_ANDROID_AVD_NAME:-rn-sandbox}
  EMULATOR_ID=""
  for maybe_id in $(adb devices | awk '$1 ~ /^emulator-[0-9]+$/ && $2 == "device" { print $1 }'); do
    maybe_avd=$(adb -s "$maybe_id" emu avd name 2>/dev/null | tr -d '\r' | awk 'NR==1{print; exit}')
    if [ "$maybe_avd" = "$AVD_NAME" ]; then
      EMULATOR_ID=$maybe_id
      break
    fi
  done

  if [ "$EMULATOR_ID" != "" ]; then
    RN_ANDROID_ARCH=$(adb -s "$EMULATOR_ID" shell getprop ro.product.cpu.abi 2>/dev/null | tr -d '\r')
  elif [ -f "$HOME/.android/avd/$AVD_NAME.avd/config.ini" ]; then
    RN_ANDROID_ARCH=$(awk -F= '/^[[:space:]]*abi[.]type[[:space:]]*=/{gsub(/[[:space:]]/, "", $2); print $2; exit}' "$HOME/.android/avd/$AVD_NAME.avd/config.ini")
  else
    RN_ANDROID_ARCH=""
  fi

  if [ "$RN_ANDROID_ARCH" != "" ]; then
    export RN_ANDROID_ARCH
    echo "Using RN_ANDROID_ARCH=$RN_ANDROID_ARCH for Detox Android build"
  fi
fi

if [ "$PLATFORM" = "android" ] && [ "${DETOX_CONFIG:-}" = "" ] && [ "${RN_ANDROID_ARCH:-}" = "arm64-v8a" ]; then
  DEFAULT_CONFIG="android"
  echo "Using DETOX_CONFIG=$DEFAULT_CONFIG on arm64 emulator (release crashes on this setup)"
fi

CONFIG=${DETOX_CONFIG:-$DEFAULT_CONFIG}

if [ "${SKIP_BUILD:-0}" != "1" ]; then
  npx detox build --configuration "$CONFIG"
fi

npx detox test --configuration "$CONFIG" --headless "$@"
