#!/usr/bin/env sh

# Builds the C++ TurboModule's shared logic (shared/RoundTripCxxCore.h) and its
# Embind bindings (web/wasm/RoundTripCxxWasm.cpp) as WebAssembly for the web.
# Writes web/wasm/build/roundTripCxx.js, an ES module with the WebAssembly
# inlined so Vite and Jest load it alike, and its TypeScript declarations.
# Skips the build when the output is newer than its sources. Needs Emscripten
# (emsdk in .mise.toml).

set -eu

cd "$(dirname "$0")/.."

out=web/wasm/build
module="$out/roundTripCxx.js"
sources="shared/RoundTripCxxCore.h web/wasm/RoundTripCxxWasm.cpp scripts/buildWasm.sh"

if [ -f "$module" ]; then
  stale=
  for source in $sources; do
    if [ "$source" -nt "$module" ]; then
      stale=1
    fi
  done
  if [ -z "$stale" ]; then
    exit 0
  fi
fi

if ! command -v em++ >/dev/null 2>&1; then
  echo "Error: em++ not found. Install Emscripten with mise install (see the README)." >&2
  exit 1
fi

mkdir -p "$out"
# IDBFS persists the file system to IndexedDB (web/files.ts).
em++ web/wasm/RoundTripCxxWasm.cpp \
  -I shared \
  -std=c++20 \
  -O2 \
  -fwasm-exceptions \
  -lembind \
  -lidbfs.js \
  -sMODULARIZE \
  -sEXPORT_ES6 \
  -sEXPORT_NAME=createRoundTripCxx \
  -sSINGLE_FILE \
  -sENVIRONMENT=web \
  -sALLOW_MEMORY_GROWTH \
  -sEXPORTED_RUNTIME_METHODS=FS,IDBFS \
  --emit-tsd roundTripCxx.d.ts \
  -o "$module"
