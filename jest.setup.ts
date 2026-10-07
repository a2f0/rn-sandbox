// Jest runs the app against the web implementations of its native modules,
// as web/reactNative.ts does in the browser, with files kept in memory in place
// of the Origin Private File System.

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

jest.mock('./web/opfs', () => {
  const files = new Map<string, Uint8Array>();
  const key = (path: string) => path.split('/').filter(Boolean).join('/');
  return {
    writeFile: async (path: string, bytes: Uint8Array) => {
      files.set(key(path), bytes.slice());
    },
    readFile: async (path: string) => files.get(key(path))?.slice() ?? null,
    removeFile: async (path: string) => files.delete(key(path)),
  };
});
