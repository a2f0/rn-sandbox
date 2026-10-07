import type { Spec } from '../specs/NativeRoundTripCxx';
import { readFile, writeFile } from './opfs';

const maxDepth = 256;

// Copies a JSON-like value the way shared/NativeRoundTripCxx.cpp does,
// rejecting what it rejects. ancestors holds the objects enclosing value.
function copyMixed(value: unknown, ancestors: object[]): unknown {
  if (typeof value !== 'object' || value === null) {
    if (['function', 'symbol', 'bigint'].includes(typeof value)) {
      throw new Error('echoMixed accepts only JSON-like values');
    }
    return value;
  }
  if (value instanceof ArrayBuffer) {
    throw new Error('echoMixed accepts only JSON-like values');
  }
  if (ancestors.includes(value)) {
    throw new Error("echoMixed can't copy a cyclic value");
  }
  if (ancestors.length === maxDepth) {
    throw new Error(`echoMixed accepts values nested at most ${maxDepth} deep`);
  }
  const enclosing = [...ancestors, value];
  if (Array.isArray(value)) {
    return Array.from(value, (item) => copyMixed(item, enclosing));
  }
  const copy = {};
  // for...in matches JSI's getPropertyNames: enumerable, including inherited.
  for (const key in value) {
    Object.defineProperty(copy, key, {
      value: copyMixed((value as Record<string, unknown>)[key], enclosing),
      writable: true,
      enumerable: true,
      configurable: true,
    });
  }
  return copy;
}

// The web implementation of specs/NativeRoundTripCxx.ts.
const RoundTripCxxModule: Spec = {
  echoArrayBuffer: (value) => value.slice(0),
  echoMixed: (value) => copyMixed(value, []),

  writeBytes: async (path, value) => {
    await writeFile(path, new Uint8Array(value));
    return value.byteLength;
  },
  readBytes: async (path) => {
    const bytes = await readFile(path);
    if (bytes === null) {
      throw new Error(`Could not read ${path}`);
    }
    return bytes.slice().buffer;
  },
};

export default RoundTripCxxModule;
