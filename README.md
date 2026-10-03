# sandbox-rn

## Overview

[React Native](https://reactnative.dev/) sandbox, created with
`npx react-native init`.

### Getting Started

```bash
nvm install
nvm use
npm install detox-cli --global
npm ci
bundle install
cd ios
bundle exec pod install
```

Shell linting requires the native [ShellCheck](https://www.shellcheck.net/) binary.
Install it with `brew install shellcheck` on macOS or `sudo apt-get install shellcheck`
on Ubuntu. CI installs it from the system package manager.

### Performing Upgrades

Use the [upgrade helper](https://react-native-community.github.io/upgrade-helper/)
for diffs to make manual updates for files that failed during the automatic
upgrade.

### Android

```bash
npm run android
```

### iOS

```bash
npm run ios
```

### Testing

#### Setup

Provision a test emulator for Android.

```bash
echo no | avdmanager create avd -n rn-sandbox -k "system-images;android-30;google_apis;x86"
# should show rn-sandbox
emulator -list-avds
```

#### Jest

```bash
npm run test
```

#### Detox

Debug builds

```bash
npm run start
npx detox build --configuration ios
npx detox test --configuration ios
npx detox build --configuration android
npx detox test --configuration android
```

Release builds

```bash
npx detox build --configuration android.release
npx detox test --configuration android.release
```
