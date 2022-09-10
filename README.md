# sandbox-rn

## Overview

[React Native](https://reactnative.dev/) Sandbox, created with `npx react-native init`.

### Getting Started

```bash
nvm use
npm install detox-cli --global
yarn install
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

Have an Android emulator running.

```bash
yarn react-native run-android
```

### iOS

```bash
yarn react-native run-ios
```

### Testing

#### Jest

```bash
yarn run test
```

#### Detox

```bash
detox build --configuration ios
detox test --configuration ios
```
