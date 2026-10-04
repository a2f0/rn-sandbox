import { fileURLToPath } from 'node:url';

import { transformAsync } from '@babel/core';
import react from '@vitejs/plugin-react';
import { defineConfig, type Plugin } from 'vite';

const webDir = fileURLToPath(new URL('./web', import.meta.url));

// Prefer .web files, as Metro prefers .ios and .android ones.
const extensions = [
  '.web.tsx',
  '.web.ts',
  '.web.jsx',
  '.web.js',
  '.tsx',
  '.ts',
  '.jsx',
  '.js',
  '.mjs',
  '.json',
];

// @react-native/new-app-screen publishes Flow and JSX source for Metro to
// compile, and loads its logos with require(), which Metro turns into assets.
function newAppScreen(): Plugin {
  return {
    name: 'new-app-screen',
    enforce: 'pre',
    async transform(code, id) {
      if (!id.includes('/node_modules/@react-native/new-app-screen/')) {
        return null;
      }
      const result = await transformAsync(
        code.replace(
          /require\(('[^']+\.png')\)/g,
          '{ uri: new URL($1, import.meta.url).href }',
        ),
        {
          babelrc: false,
          configFile: false,
          filename: id,
          sourceMaps: true,
          plugins: [
            '@babel/plugin-transform-flow-strip-types',
            ['@babel/plugin-transform-react-jsx', { runtime: 'automatic' }],
          ],
        },
      );
      return result?.code ? { code: result.code, map: result.map } : null;
    },
  };
}

export default defineConfig({
  root: webDir,
  plugins: [newAppScreen(), react()],
  define: {
    // NewAppScreen reads global.HermesInternal.
    global: 'globalThis',
  },
  resolve: {
    alias: [
      {
        find: 'react-native/Libraries/Core/Devtools/openURLInBrowser',
        replacement: `${webDir}/openURLInBrowser.ts`,
      },
      { find: /^react-native$/, replacement: `${webDir}/react-native.ts` },
    ],
    extensions,
  },
  optimizeDeps: {
    // Pre-bundling would skip the transform above.
    exclude: ['@react-native/new-app-screen'],
    // The dev pre-bundler resolves imports inside dependencies on its own.
    rolldownOptions: { resolve: { extensions } },
  },
  build: {
    outDir: fileURLToPath(new URL('./dist', import.meta.url)),
    emptyOutDir: true,
  },
});
