import { Platform } from 'react-native';

export const light = {
  background: '#f6f7f9',
  card: '#ffffff',
  text: '#16181d',
  muted: '#5e6573',
  border: '#e2e5ea',
  pass: '#1a7f37',
  fail: '#cf222e',
  note: '#9a6700',
};

export type Colors = typeof light;

export const dark: Colors = {
  background: '#0f1115',
  card: '#181b21',
  text: '#e8eaee',
  muted: '#9aa1ad',
  border: '#2a2f38',
  pass: '#4ac26b',
  fail: '#ff7b72',
  note: '#d29922',
};

export const monospace = Platform.select({
  ios: 'Menlo',
  android: 'monospace',
  default: 'ui-monospace, Menlo, monospace',
});
