import type { Config } from 'jest';

export default {
  preset: 'react-native',
  testMatch: ['**/__tests__/**/*-test.[jt]s?(x)'],
} satisfies Config;
