# sandbox-rn

## Overview

[React Native](https://reactnative.dev/) Sandbox, created with `npx react-native init`.

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

### Performing Upgrades

1. Run `npx react-native upgrade`
2. Use the [upgrade helper](https://react-native-community.github.io/upgrade-helper/) for diffs to make manual updates for files that filed to the automatic upgrade.
3. Commit and push, wait for CI/CD to finish.
4. Tag the build with `git tag react_native_0.68.5` and `git push -u origin react_native_0.68.5`.

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
```
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
