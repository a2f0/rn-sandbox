# RN Upgrade Failure Playbook

## Toolchain Mismatch

Symptoms:

- CI/setup failures in node/ruby/java setup
- Gradle or CocoaPods version errors

Actions:

1. Re-check `.nvmrc`, `.ruby-version`, `.java-version`, `package.json` engines.
1. Re-check `.github/workflows/main.yml` for matching setup versions.
1. Re-run `npm ci`, `bundle install`, `bundle exec pod install`.

## Android ABI Install Failure

Symptoms:

- `INSTALL_FAILED_NO_MATCHING_ABIS`

Actions:

1. Confirm emulator ABI: `adb -s <emulator-id> shell getprop ro.product.cpu.abi`
1. Build with matching `RN_ANDROID_ARCH`.
1. Use `./scripts/detox-android-headless.sh` to auto-select local ABI.

## Android Runtime Crash After Launch

Symptoms:

- Detox `appDisconnected`
- Crash logs in `adb logcat -b crash -d`

Actions:

1. Capture crash logs and identify crashing native/lib component.
1. If release-only crash on arm64 emulator, test debug config locally:
   - `DETOX_CONFIG=android ./scripts/detox-android-headless.sh`
1. Keep release path for CI unless CI reproduces same crash.

## iOS Build/Runtime Failure

Symptoms:

- xcodebuild compile/link errors
- Detox iOS app not ready

Actions:

1. `bundle install`
1. `(cd ios && bundle exec pod install)`
1. Clean derived data if needed and rebuild detox iOS.

## Detox Bootstrap Failure

Symptoms:

- Jest exits with Detox setup failure
- app not ready / disconnection

Actions:

1. Run with logs: `--loglevel trace`
1. Validate target config and app binary exist.
1. Isolate build vs test by using `SKIP_BUILD=1` only after a known good build.
