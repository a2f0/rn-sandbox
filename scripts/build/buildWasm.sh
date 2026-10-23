#!/usr/bin/env sh

# Builds the C++ TurboModule's shared logic (shared/RoundTripCxxCore.h) and its
# Embind bindings (web/wasm/RoundTripCxxWasm.cpp) as WebAssembly for the web.
# Writes web/wasm/build/roundTripCxx.js, an ES module with the WebAssembly
# inlined so Vite and Jest load it alike, and its TypeScript declarations.
# Reuses output only when its sources and active compiler version are unchanged.
# Needs Emscripten on PATH even for cached output (emsdk in .mise.toml).

set -eu

cd "$(dirname "$0")/../.."

out=web/wasm/build
module="$out/roundTripCxx.js"
compiler_stamp="$out/compiler-version.txt"

if ! command -v em++ >/dev/null 2>&1; then
  echo "Error: em++ not found. Install Emscripten with mise install (see the README)." >&2
  exit 1
fi

# Track the compiler that actually built the module, including an installation
# that happens after the version pin changes. Unrelated tool pins don't rebuild.
compiler_version=$(em++ --version)
if [ -f "$module" ] && [ -f "$compiler_stamp" ] &&
  [ "$compiler_version" = "$(cat "$compiler_stamp")" ] &&
  [ -z "$(find shared/RoundTripCxxCore.h web/wasm/RoundTripCxxWasm.cpp \
    scripts/build/buildWasm.sh -newer "$module")" ]; then
  exit 0
fi

mkdir -p "$out"
# A failed compiler invocation must not leave a reusable partial output.
rm -f "$compiler_stamp"
# IDBFS persists the file system to IndexedDB (web/cxx.ts). --emit-tsd writes
# relative to the output, so the declarations land beside the module.
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

# Only record the compiler after a successful build.
printf '%s\n' "$compiler_version" > "$compiler_stamp"
