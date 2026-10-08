import type { Config } from 'jest';

export default {
  preset: '@react-native/jest-preset',
  setupFiles: [
    '<rootDir>/jest.setup.ts',
    // Mocks Google Sign-In's native module.
    '<rootDir>/node_modules/@react-native-google-signin/google-signin/jest/build/jest/setup.js',
  ],
  setupFilesAfterEnv: ['<rootDir>/jest.setupAfterEnv.ts'],
  testMatch: ['**/__tests__/**/*-test.[jt]s?(x)'],
  // The preset's pattern, plus the sign-in libraries, which ship ES modules.
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?|@react-native-google-signin|@invertase/react-native-apple-authentication)/)',
  ],
  // Merged ahead of the preset's transforms.
  transform: {
    '/web/wasm/build/.+\\.js$': '<rootDir>/jest.emscriptenTransformer.cjs',
  },
} satisfies Config;
