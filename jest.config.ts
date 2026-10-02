import type { Config } from 'jest';

export default {
  preset: '@react-native/jest-preset',
  testMatch: ['**/__tests__/**/*-test.[jt]s?(x)'],
} satisfies Config;
