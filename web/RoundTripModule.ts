import type { EventSubscription } from 'react-native';
import type { Sample, Spec } from '../specs/NativeRoundTrip';
import { readFile, removeFile, writeFile } from './opfs';

// The web implementation of specs/NativeRoundTrip.ts. There is no bridge in
// the browser, so values are structured-cloned where native code would
// receive a copy, and samples are stored as JSON on the Origin Private File
// System.

const filesDirectory = '/roundtrip';
const safeName = /^[A-Za-z0-9_-]+$/;
const listeners = new Set<(value: Sample) => void>();

function rejection(code: string, message: string) {
  return Object.assign(new Error(message), { code });
}

function samplePath(name: string) {
  if (!safeName.test(name)) {
    throw rejection(
      'E_INVALID_NAME',
      'Sample names may only contain letters, digits, - and _',
    );
  }
  return `${filesDirectory}/${name}.json`;
}

const echo = <T>(value: T): T => structuredClone(value);

const RoundTripModule: Spec = {
  getConstants: () => ({ platform: 'web', filesDirectory }),

  echoString: echo,
  echoNumber: echo,
  echoInt32: echo,
  echoFloat: echo,
  echoDouble: echo,
  echoBoolean: echo,
  echoStringLiteral: echo,
  echoNumberLiteral: echo,
  echoBooleanLiteral: echo,
  echoStringUnion: echo,
  echoNumberUnion: echo,
  echoObjectUnion: echo,
  echoStringEnum: echo,
  echoNumberEnum: echo,
  echoNullableString: echo,
  echoNullableNumber: echo,
  echoOptionalString: (value) => value ?? null,
  echoStringArray: echo,
  echoMatrix: echo,
  echoPoint: echo,
  echoPoints: echo,
  echoDictionary: echo,
  echoObject: echo,
  echoRootTag: echo,
  echoSample: echo,

  echoSampleAsync: async (value) => echo(value),
  resolveVoid: async () => {},
  rejectPromise: async (code, message) => {
    throw rejection(code, message);
  },
  echoSampleCallback: (value, callback) => {
    queueMicrotask(() => callback(echo(value)));
  },

  onSample: (listener): EventSubscription => {
    listeners.add(listener);
    return { remove: () => listeners.delete(listener) };
  },
  emitSample: (value) => {
    queueMicrotask(() => {
      for (const listener of listeners) {
        listener(echo(value));
      }
    });
  },

  writeSample: async (name, value) => {
    const path = samplePath(name);
    const bytes = new TextEncoder().encode(JSON.stringify(value));
    await writeFile(path, bytes);
    return { path, bytes: bytes.byteLength };
  },
  readSample: async (name) => {
    const bytes = await readFile(samplePath(name));
    if (bytes === null) {
      throw rejection('E_NOT_FOUND', `No sample named ${name}`);
    }
    return JSON.parse(new TextDecoder().decode(bytes));
  },
  deleteFile: async (name) => removeFile(samplePath(name)),
};

export default RoundTripModule;
