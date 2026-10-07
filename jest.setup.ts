// Jest runs the app against the web implementations of its native modules, as
// web/reactNative.ts does in the browser, including the C++ module compiled to
// WebAssembly (npm run build:wasm), which jest.setupAfterEnv.ts loads.

jest.mock('react-native/Libraries/TurboModule/TurboModuleRegistry', () => {
  const actual = jest.requireActual(
    'react-native/Libraries/TurboModule/TurboModuleRegistry',
  );
  const web = jest.requireActual('./web/turboModules');
  return {
    ...actual,
    get: (name: string) => web.get(name) ?? actual.get(name),
    getEnforcing: (name: string) => web.get(name) ?? actual.getEnforcing(name),
  };
});
