// Transforms Emscripten's ES module (web/wasm/build) for Jest. Babel's
// CommonJS output can't contain import.meta, which the module reads only to
// find a .wasm file, and the build inlines the WebAssembly instead.
const babelJest = require('babel-jest').default;

const babel = babelJest.createTransformer();
const withoutImportMeta = (source) =>
  source.replaceAll('import.meta.url', 'undefined');

module.exports = {
  ...babel,
  process: (source, path, options) =>
    babel.process(withoutImportMeta(source), path, options),
  getCacheKey: (source, path, options) =>
    babel.getCacheKey(withoutImportMeta(source), path, options),
};
