import type { Config } from 'jest';

const config: Config = {
  preset: 'react-native',
  testMatch: ['**/__tests__/**/*-test.[jt]s?(x)'],
};

export default config;
