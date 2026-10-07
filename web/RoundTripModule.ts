import type { EventSubscription } from 'react-native';
import type { Priority, Sample, Spec, Suit } from '../specs/NativeRoundTrip';
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

type Check = (value: unknown) => boolean;

const isString: Check = (value) => typeof value === 'string';
const isNumber: Check = (value) => typeof value === 'number';
const isBoolean: Check = (value) => typeof value === 'boolean';
const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const isArrayOf = (value: unknown, isItem: Check) =>
  Array.isArray(value) && value.every(isItem);
const oneOf =
  (...allowed: unknown[]): Check =>
  (value) =>
    allowed.includes(value);
const isPoint: Check = (value) =>
  isObject(value) && isNumber(value.x) && isNumber(value.y);

// What a file must hold to be read back as a Sample, field by field. Enum
// values are listed rather than imported: specs/ loads this module through
// TurboModuleRegistry, so importing it here would be circular.
const sampleFields: Record<keyof Sample, Check> = {
  text: isString,
  number: isNumber,
  int32: isNumber,
  floatValue: isNumber,
  doubleValue: isNumber,
  flag: isBoolean,
  stringLiteral: oneOf('exact'),
  numberLiteral: oneOf(42),
  booleanLiteral: oneOf(true),
  stringUnion: oneOf('north', 'south'),
  numberUnion: oneOf(1, 2, 3),
  objectUnion: (value) =>
    isObject(value) && (isNumber(value.radius) || isNumber(value.side)),
  stringEnum: oneOf(...(['hearts', 'spades'] satisfies `${Suit}`[])),
  numberEnum: oneOf(...([1, 3] satisfies Priority[])),
  nullableText: (value) => value === null || isString(value),
  optionalNumber: (value) => value === undefined || isNumber(value),
  strings: (value) => isArrayOf(value, isString),
  matrix: (value) => isArrayOf(value, (row) => isArrayOf(row, isNumber)),
  points: (value) => isArrayOf(value, isPoint),
  point: isPoint,
  dictionary: (value) =>
    isObject(value) && Object.values(value).every(isNumber),
  object: isObject,
};

function fromJson(json: string): Sample {
  const value: unknown = JSON.parse(json);
  if (!isObject(value)) {
    throw new Error('Not a sample');
  }
  for (const [key, isValid] of Object.entries(sampleFields)) {
    if (!isValid(value[key])) {
      throw new Error(`Not a sample: invalid ${key}`);
    }
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
    const path = samplePath(name);
    const bytes = await io(() => readFile(path));
    if (bytes === null) {
      throw rejection('E_NOT_FOUND', `No sample named ${name}`);
    }
    return io(async () => fromJson(new TextDecoder().decode(bytes)));
  },
  deleteFile: async (name) => {
    const path = samplePath(name);
    return io(() => removeFile(path));
  },
};

export default RoundTripModule;
