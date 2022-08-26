# sandbox-rn

## Overview

[React Native](https://reactnative.dev/) Sandbox, created with `npx react-native init`.

### Getting Started

```bash
nvm use
yarn install
bundle install
cd ios
bundle exec pod install
```

### Performing Upgrades

1. Run `npx react-native upgrade`
2. Use the [upgrade helper](https://react-native-community.github.io/upgrade-helper/) for diffs to make manual updates for files that filed to the automatic upgrade.
3. Commit and push, wait for CI/CD to finish.
4. 



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

```bash
yarn run test
```
