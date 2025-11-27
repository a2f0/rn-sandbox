import React from 'react';

export const SafeAreaProvider = ({ children }: { children: React.ReactNode }) =>
  React.createElement('div', { 'data-testid': 'safe-area-provider' }, children);

export const SafeAreaView = ({ children }: { children?: React.ReactNode }) =>
  React.createElement('div', { 'data-testid': 'safe-area-view' }, children);

export const useSafeAreaInsets = () => ({
  top: 0,
  bottom: 0,
  left: 0,
  right: 0,
});
