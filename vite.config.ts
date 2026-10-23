import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// Builds the app for the browser with react-native-web; see web/.
export default defineConfig({
  root: 'web',
  // web/public holds the favicons that `bun run build:favicons` renders from
  // assets/brand/; Vite serves it in development and copies it into the build.
  publicDir: 'public',
  plugins: [react()],
  resolve: {
    alias: [
      {
        find: /^react-native$/,
        replacement: fileURLToPath(
          new URL('./web/reactNative.ts', import.meta.url),
        ),
      },
    ],
    extensions: [
      '.web.tsx',
      '.web.ts',
      '.web.js',
      '.tsx',
      '.ts',
      '.js',
      '.json',
    ],
  },
  build: {
    outDir: 'build',
    emptyOutDir: true,
  },
});
