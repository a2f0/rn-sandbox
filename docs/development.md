# Development

See the [README](../README.md#quick-start) for installation and normal app
commands, [tooling](tooling.md) for script ownership, and
[AGENTS.md](../AGENTS.md#validation) for the required shipping checks.

## Bridge round trip

Two codegen specs in `specs/` define the modules, and `src/roundTrip/cases.ts`
lists the cases the app runs against them at launch:

- `NativeRoundTrip` covers every type that Java and Objective-C TurboModules
  accept, through sync returns, promises, callbacks, an event emitter, and
  constants. `writeSample` serializes a typed object to JSON on disk, and
  `readSample` reads it back. It's implemented in Kotlin
  (`android/app/src/main/java/com/sandbox/roundtrip/`), Objective-C++
  (`ios/sandbox/RCTNativeRoundTrip.mm`), and TypeScript (`web/RoundTripModule.ts`).
- `NativeRoundTripCxx` covers the types that only C++ TurboModules support,
  `ArrayBuffer` and `mixed`, and binary file I/O. The same C++ runs on all
  three platforms: `shared/RoundTripCxxCore.h` holds the rules for copying
  `mixed` values and the file I/O, independent of the JavaScript engine. On iOS
  and Android, `shared/NativeRoundTripCxx.cpp` binds it to JSI. On the web,
  `web/wasm/RoundTripCxxWasm.cpp` binds it with Embind, and Emscripten compiles
  it to WebAssembly.

Where a platform's bridge changes a value, the case records what that platform
returns instead and why, and the app shows it. With React Native 0.88.0:

- iOS passes `Float` arguments to Objective-C as doubles, so the `float`
  parameter reads the double's low 32 bits.
- iOS converts strings through C strings, which end at the first NUL. Android
  preserves embedded NUL characters.
- iOS drops `null` properties from untyped objects unless
  `enableModuleArgumentNSNullConversionIOS` is on.
- Android requires every argument, including optional ones, and resolves an
  empty promise with `null` rather than `undefined`.

Changing a spec means updating all three implementations; iOS picks up the new
codegen output after `pod install`.

## WebAssembly

[react-native-web](https://necolas.github.io/react-native-web/) and
[Vite](https://vite.dev/) build the app for the browser from `web/`. Vite
aliases `react-native` to `web/reactNative.ts`, which adds a
`TurboModuleRegistry` that returns the web modules: `web/RoundTripModule.ts`,
and `web/RoundTripCxxModule.ts`, which calls the C++ module compiled to
WebAssembly.

`bun run build:wasm` (`scripts/build/buildWasm.sh`) compiles that module with
Emscripten into `web/wasm/build/`, a single ES module with the WebAssembly
inlined, so Vite and Jest load it alike. Web builds and Jest run it first; it
reuses the build when its sources and active compiler version are unchanged.
Emscripten must be on `PATH` even for cached output, so the script can verify
which compiler is active. Both web modules keep their files
in the module's Emscripten file system, saved to IndexedDB, as the native
modules share the device's file system. The C++ runs synchronously there, since
the browser gives WebAssembly no threads without cross-origin isolation.

## Testing

### Setup

Create an Android virtual device named `rn-sandbox` with Android Studio or
`avdmanager`, using a system image compatible with the host CPU. Verify its name
with `emulator -list-avds`. The headless Android helper detects the running
emulator or configured AVD ABI; CI selects its own x86_64 image.

### Jest

```bash
bun run test
```

Jest runs the round-trip cases against the web modules, including the C++
module in WebAssembly (`jest.setup.ts`), so it needs Emscripten. It also runs
the fastlane lane tests in `fastlane/test/`, which need Ruby; `bun run lint:ruby`
checks the fastlane Ruby with RuboCop.

### Playwright

```bash
bunx playwright install chromium
bun run test:web
```

The suite builds the production web app and serves it twice: with Vite's
preview, and with `wrangler dev` on port 8788, which runs the Worker's asset
handling from `wrangler.jsonc` locally, including its 404 page.

### Detox

The configured local iOS target is `ios.release`; Android has `android`
(debug) and `android.release`. Build and test with the same configuration:

```bash
bunx detox build --configuration ios.release
bunx detox test --configuration ios.release
bunx detox build --configuration android.release
bunx detox test --configuration android.release
```

For headless local runs, use `scripts/testing/detox-ios-headless.sh` or
`scripts/testing/detox-android-headless.sh`. The Android helper selects the
existing debug workaround for arm64 emulators; CI continues to test release
builds. `DETOX_CONFIG` overrides the configuration and `SKIP_BUILD=1` reuses a
previously validated build. When running Android debug tests, start Metro with
`bun run start`.
