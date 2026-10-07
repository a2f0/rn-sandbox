import { loadCxx } from './web/cxx';

// The web modules run on the WebAssembly module (web/cxx.ts).
beforeAll(() => loadCxx());
