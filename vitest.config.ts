import path from 'node:path';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      'react-native': path.resolve(__dirname, './vitest.mocks/react-native.ts'),
      'react-native-safe-area-context': path.resolve(
        __dirname,
        './vitest.mocks/react-native-safe-area-context.ts',
      ),
      '@react-native/new-app-screen': path.resolve(
        __dirname,
        './vitest.mocks/new-app-screen.ts',
      ),
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    include: [
      '__tests__/**/*-test.{ts,tsx}',
      '__tests__/**/*.{test,spec}.{ts,tsx}',
    ],
  },
});
