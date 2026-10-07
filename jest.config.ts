import type { Config } from 'jest';

export default {
  preset: '@react-native/jest-preset',
  setupFiles: ['<rootDir>/jest.setup.ts'],
  setupFilesAfterEnv: ['<rootDir>/jest.setupAfterEnv.ts'],
  testMatch: ['**/__tests__/**/*-test.[jt]s?(x)'],
  // Merged ahead of the preset's transforms.
  transform: {
    '/web/wasm/build/.+\\.js$': '<rootDir>/jest.emscriptenTransformer.cjs',
  },
} satisfies Config;
