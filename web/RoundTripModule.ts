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

// Like the native modules, rejects with E_IO when a sample can't be written or
// read. JSON.stringify would write NaN and Infinity as null, so they throw.
async function io<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    throw rejection('E_IO', (error as Error).message);
  }
}

const isString = (value: unknown) => typeof value === 'string';
const isNumber = (value: unknown) => typeof value === 'number';
const isBoolean = (value: unknown) => typeof value === 'boolean';
const isObject = (value: unknown) =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const isArrayOf = (value: unknown, isItem: (item: unknown) => boolean) =>
  Array.isArray(value) && value.every(isItem);
const isPoint = (value: unknown) =>
  isObject(value) &&
  isNumber((value as Record<string, unknown>).x) &&
  isNumber((value as Record<string, unknown>).y);

// What a file must hold to be read back as a Sample. The native modules
// reject the same files through their typed getters.
const sampleFields: Record<keyof Sample, (value: unknown) => boolean> = {
  text: isString,
  number: isNumber,
  int32: isNumber,
  floatValue: isNumber,
  doubleValue: isNumber,
  flag: isBoolean,
  stringLiteral: isString,
  numberLiteral: isNumber,
  booleanLiteral: isBoolean,
  stringUnion: isString,
  numberUnion: isNumber,
  objectUnion: isObject,
  stringEnum: isString,
  numberEnum: isNumber,
  nullableText: (value) => value === null || isString(value),
  optionalNumber: (value) => value === undefined || isNumber(value),
  strings: (value) => isArrayOf(value, isString),
  matrix: (value) => isArrayOf(value, (row) => isArrayOf(row, isNumber)),
  points: (value) => isArrayOf(value, isPoint),
  point: isPoint,
  dictionary: isObject,
  object: isObject,
};

function fromJson(json: string): Sample {
  const value: unknown = JSON.parse(json);
  const invalid =
    !isObject(value) ||
    Object.entries(sampleFields).find(
      ([key, isValid]) => !isValid((value as Record<string, unknown>)[key]),
    );
  if (invalid) {
    throw new Error(
      `Not a sample${Array.isArray(invalid) ? `: invalid ${invalid[0]}` : ''}`,
    );
  }
  return value as Sample;
}

function toJson(value: Sample) {
  return JSON.stringify(value, (_key, item) => {
    if (typeof item === 'number' && !Number.isFinite(item)) {
      throw new Error(`${item} can't be represented as JSON`);
    }
    return item;
  });
}

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
    return io(async () => {
      const bytes = new TextEncoder().encode(toJson(value));
      await writeFile(path, bytes);
      return { path, bytes: bytes.byteLength };
    });
  },
  readSample: async (name) => {
    const bytes = await readFile(samplePath(name));
    if (bytes === null) {
      throw rejection('E_NOT_FOUND', `No sample named ${name}`);
    }
    return io(async () => fromJson(new TextDecoder().decode(bytes)));
  },
  deleteFile: async (name) => removeFile(samplePath(name)),
};

export default RoundTripModule;
