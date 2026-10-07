import type { Config } from 'jest';

export default {
  preset: '@react-native/jest-preset',
  setupFiles: ['<rootDir>/jest.setup.ts'],
  testMatch: ['**/__tests__/**/*-test.[jt]s?(x)'],
} satisfies Config;
