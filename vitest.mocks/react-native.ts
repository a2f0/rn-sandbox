import React from 'react';

export const Platform = {
  OS: 'ios',
  select: (obj: Record<string, unknown>) => obj.ios ?? obj.default,
};

export const StyleSheet = {
  create: <T>(styles: T): T => styles,
};

export const View = ({ children }: { children?: React.ReactNode }) =>
  React.createElement('div', { 'data-testid': 'view' }, children);

export const Text = ({ children }: { children?: React.ReactNode }) =>
  React.createElement('span', { 'data-testid': 'text' }, children);

export const Image = () =>
  React.createElement('img', { 'data-testid': 'image' });

export const ScrollView = ({ children }: { children?: React.ReactNode }) =>
  React.createElement('div', { 'data-testid': 'scrollview' }, children);

export const SafeAreaView = ({ children }: { children?: React.ReactNode }) =>
  React.createElement('div', { 'data-testid': 'safe-area-view' }, children);

export const StatusBar = () => null;

export const useColorScheme = () => 'light';
