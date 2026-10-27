# rn-sandbox

A [React Native](https://reactnative.dev/) sandbox, created with
`npx react-native init`. The app round-trips every data type that New
Architecture TurboModules support through native code on iOS, Android, and web,
including file I/O, and lists each case with its result; the
[development guide](docs/development.md#bridge-round-trip) explains how.
This repo is available on the web at <https://rn-sandbox.a2f0.net>.

The production web app uses [CT click tracking](docs/click-tracking.md).
Native apps and local development do not initialize the tracker.

## Quick start

Install [mise](https://mise.jdx.dev/), plus Xcode or Android Studio for the
native apps.

```bash
mise install                        # Ruby, Node, and the tools in .mise.toml
bun install --frozen-lockfile       # also installs the pre-push hook
bundle install                      # CocoaPods, fastlane, and RuboCop
(cd ios && bundle exec pod install) # iOS only
bun run web                         # http://localhost:5173
```

Run `bun run ios` or `bun run android` for a native app instead. The
[tooling guide](docs/tooling.md#toolchain) lists the pinned tools and how CI
installs each one.

## Development

```bash
bun run android             # native Android app
bun run ios                 # native iOS app
bun run start               # Metro development server
bun run web                 # web development server
bun run build:web           # production web assets in web/build
```

The web app uses React Native Web and Vite. Its C++ TurboModule is compiled
with Emscripten by `bun run build:wasm`; web builds and Jest run it first.
The [development guide](docs/development.md) describes the native/web bridges,
WebAssembly caching, and Jest, Playwright, and Detox setup.

```bash
bun run test                # WebAssembly, Jest, auth helpers, and fastlane tests
bun run test:web            # Playwright (install Chromium first)
bun run check               # all required non-native checks
```

Nothing binary is committed. App icons, web favicons, and the Gradle wrapper
jar are generated from text sources; see
[binary files](docs/tooling.md#binary-files).

## Operations

```bash
bun run preview:deploy:web  # build and dry-run web assets
bun run deploy:web          # deploy to rn-sandbox.a2f0.net
bun run ios:build-release
bun run ios:upload-release
bun run ios:profiles
bun run android:build-release
bun run android:upload-release
```

The [operations guide](docs/operations.md) covers web deployment previews,
Google/Apple sign-in provisioning, fastlane tiers and lanes, store credentials,
and one-time store setup. Push and merge workflows validate without deploying.

## Maintaining the repository

- [Tooling and script layout](docs/tooling.md): toolchain, shared commands,
  hooks, generated binaries, and repository-owned script groups.
- [Dependency upgrades](docs/dependency-upgrades.md): upgrade workflow,
  compatibility gates, and security override removal conditions.
