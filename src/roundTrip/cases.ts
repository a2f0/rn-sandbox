import { type EventSubscription, Platform, type RootTag } from 'react-native';
import RoundTrip, {
  Priority,
  type Sample,
  Suit,
} from '../../specs/NativeRoundTrip';
import RoundTripCxx from '../../specs/NativeRoundTripCxx';
import { byteRange, fullSample, sparseSample } from './fixtures';

export type RoundTripPlatform = 'android' | 'ios' | 'web';

type Differences = Partial<
  Record<RoundTripPlatform, { expected: unknown; reason: string }>
>;

export type RoundTripCase = {
  group: string;
  name: string;
  // One sentence on what the case sends, shown when its row is expanded.
  description: string;
  // What the case sends; undefined when it sends no arguments.
  input: unknown;
  run: () => unknown;
  expected: unknown;
  // What a platform's bridge returns instead, where it changes the value.
  differences?: Differences;
};

type CaseSpec<I> = Omit<RoundTripCase, 'input' | 'run' | 'expected'> & {
  input?: I;
  run: (input: I) => unknown;
  // Defaults to input, since most cases expect their input back.
  expected?: unknown;
};

function roundTrip<I = undefined>({
  input,
  run,
  ...spec
}: CaseSpec<I>): RoundTripCase {
  return {
    ...spec,
    input,
    run: () => run(input as I),
    expected: 'expected' in spec ? spec.expected : input,
  };
}

const unicode = 'Grüße, 世界 👋🏽 é';

const numbers = [
  0,
  -0,
  1.5,
  -1e308,
  Number.MIN_VALUE,
  Number.MAX_SAFE_INTEGER,
  Number.NaN,
  Number.POSITIVE_INFINITY,
  Number.NEGATIVE_INFINITY,
];

const floats = [0, 3.25, -1.5, 0.1];

// The float made of a double's low 32 bits (little-endian).
function lowFloatBits(value: number): number {
  const view = new DataView(new ArrayBuffer(8));
  view.setFloat64(0, value, true);
  return view.getFloat32(0, true);
}

// Values only a C++ TurboModule can receive as `mixed`.
const mixed: unknown[] = [
  undefined,
  null,
  true,
  -0,
  Number.NaN,
  'a\u0000b',
  [1, 'two', [null, undefined]],
  { nested: { nullValue: null, undefinedValue: undefined }, list: [] },
  // Own properties that a naive copy would lose: one named __proto__, which
  // JSON.parse creates, and one with a NUL in its name.
  JSON.parse('{"__proto__": {"own": true}}'),
  { 'a\u0000b': 1 },
];

// NaN and the infinities can cross the bridge, though JSON can't hold them.
const nonFinitePoint = {
  x: Number.NaN,
  y: Number.NEGATIVE_INFINITY,
};
const nonFiniteSample: Sample = {
  ...fullSample,
  number: Number.NaN,
  doubleValue: Number.POSITIVE_INFINITY,
  point: nonFinitePoint,
};

const cyclic: Record<string, unknown> = { name: 'cyclic' };
cyclic.self = cyclic;

// Sample files every platform's readSample rejects. Built from sparseSample,
// whose JSON is ASCII.
const { text: _text, ...missingText } = sparseSample;
const malformedSamples: Record<string, unknown> = {
  'missing field': missingText,
  'wrong type': { ...sparseSample, flag: 'yes' },
  'fractional Int32': { ...sparseSample, int32: 1.5 },
  'Int32 out of range': { ...sparseSample, int32: 2147483648 },
  'other literal': { ...sparseSample, stringLiteral: 'inexact' },
  'value outside a union': { ...sparseSample, numberUnion: 4 },
  'object matching no union member': { ...sparseSample, objectUnion: {} },
  'unknown enum value': { ...sparseSample, stringEnum: 'clubs' },
  'number enum member name': { ...sparseSample, numberEnum: 'High' },
  'non-number dictionary value': {
    ...sparseSample,
    dictionary: { one: 'text' },
  },
  'null optional field': { ...sparseSample, optionalNumber: null },
  array: [sparseSample],
};

// Shorter than the runner's timeout, so the subscription is always removed.
const eventTimeoutMs = 4000;

function nextSampleEvent(emit: () => void): Promise<Sample> {
  let subscription: EventSubscription | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  return new Promise<Sample>((resolve, reject) => {
    subscription = RoundTrip.onSample(resolve);
    timer = setTimeout(
      () => reject(new Error('No onSample event arrived')),
      eventTimeoutMs,
    );
    emit();
  }).finally(() => {
    subscription?.remove();
    clearTimeout(timer);
  });
}

// Arrays nested depth deep: [[…[]…]].
function nested(depth: number): unknown[] {
  let value: unknown[] = [];
  for (let level = 1; level < depth; level++) {
    value = [value];
  }
  return value;
}

function attempt(call: () => unknown) {
  try {
    return call();
  } catch (error) {
    return { message: (error as Error).message };
  }
}

async function rejection(promise: Promise<unknown>) {
  try {
    await promise;
    return 'resolved';
  } catch (error) {
    const { code, message } = error as { code?: string; message: string };
    return code === undefined ? { message } : { code, message };
  }
}

async function rejectionCode(promise: Promise<unknown>) {
  const result = await rejection(promise);
  return typeof result === 'string' ? result : result.code;
}

// ASCII only: Hermes has no TextEncoder.
function asciiBytes(text: string): ArrayBuffer {
  return Uint8Array.from(text, (char) => char.charCodeAt(0)).buffer;
}

async function fileRoundTrip(name: string, sample: Sample) {
  const info = await RoundTrip.writeSample(name, sample);
  return {
    path: info.path.endsWith(`/${name}.json`),
    bytes: info.bytes > 0,
    sample: await RoundTrip.readSample(name),
  };
}

export function createCases(): RoundTripCase[] {
  const { filesDirectory } = RoundTrip.getConstants();
  const bytesPath = `${filesDirectory}/bytes.bin`;
  const missingPath = `${filesDirectory}/missing.bin`;

  return [
    roundTrip({
      group: 'constants',
      name: 'platform',
      description:
        'Reads the constants the native module exports, which name the platform it runs on.',
      run: () => RoundTrip.getConstants().platform,
      expected: Platform.OS,
    }),
    roundTrip({
      group: 'sync',
      name: 'string',
      description:
        'Sends empty, ASCII, and non-ASCII strings to a synchronous method that returns them.',
      input: ['', 'plain', unicode],
      run: (strings) => strings.map((value) => RoundTrip.echoString(value)),
    }),
    roundTrip({
      group: 'sync',
      name: 'string with NUL',
      description: 'Sends a string with a NUL character in the middle.',
      input: 'a\u0000b',
      run: (value) => RoundTrip.echoString(value),
      differences: {
        android: {
          expected: 'a',
          reason:
            'JavaTurboModule converts strings with NewStringUTF(…c_str())',
        },
        ios: {
          expected: 'a',
          reason: 'ObjCTurboModule converts strings with stringWithUTF8String:',
        },
      },
    }),
    roundTrip({
      group: 'sync',
      name: 'number',
      description:
        'Sends numbers as `number`, including -0, the smallest and largest magnitudes, NaN, and the infinities.',
      input: numbers,
      run: (values) => values.map((value) => RoundTrip.echoNumber(value)),
    }),
    roundTrip({
      group: 'sync',
      name: 'Int32',
      description:
        'Sends 0, -1, and the largest and smallest 32-bit integers as `Int32`.',
      input: [0, -1, 2147483647, -2147483648],
      run: (values) => values.map((value) => RoundTrip.echoInt32(value)),
    }),
    roundTrip({
      group: 'sync',
      name: 'Float',
      description:
        'Sends numbers as `Float`, which Objective-C declares as a 32-bit float and Java as a double.',
      input: floats,
      run: (values) => values.map((value) => RoundTrip.echoFloat(value)),
      differences: {
        ios: {
          expected: floats.map(lowFloatBits),
          reason:
            'ObjCTurboModule passes the double to the float parameter, which reads its low 32 bits',
        },
      },
    }),
    roundTrip({
      group: 'sync',
      name: 'Double',
      description:
        'Sends doubles that need all 17 significant digits, and the largest and smallest magnitudes, as `Double`.',
      input: [0.1 + 0.2, Number.MAX_VALUE, -Number.MIN_VALUE],
      run: (values) => values.map((value) => RoundTrip.echoDouble(value)),
    }),
    roundTrip({
      group: 'sync',
      name: 'boolean',
      description: 'Sends true and false.',
      input: [true, false],
      run: (values) => values.map((value) => RoundTrip.echoBoolean(value)),
    }),
    roundTrip({
      group: 'sync',
      name: 'literals',
      description:
        'Sends a string, a number, and a boolean, each to a method typed with that exact literal.',
      input: ['exact', 42, true] as const,
      run: ([text, number, flag]) => [
        RoundTrip.echoStringLiteral(text),
        RoundTrip.echoNumberLiteral(number),
        RoundTrip.echoBooleanLiteral(flag),
      ],
    }),
    roundTrip({
      group: 'sync',
      name: 'string union',
      description: 'Sends each member of a union of string literals.',
      input: ['north', 'south'] as const,
      run: (values) => values.map((value) => RoundTrip.echoStringUnion(value)),
    }),
    roundTrip({
      group: 'sync',
      name: 'number union',
      description: 'Sends each member of a union of number literals.',
      input: [1, 2, 3] as const,
      run: (values) => values.map((value) => RoundTrip.echoNumberUnion(value)),
    }),
    roundTrip({
      group: 'sync',
      name: 'object union',
      description: 'Sends one object of each shape in a union of object types.',
      input: [{ radius: 1.5 }, { side: 2 }],
      run: (values) => values.map((value) => RoundTrip.echoObjectUnion(value)),
    }),
    roundTrip({
      group: 'sync',
      name: 'string enum',
      description: 'Sends the members of a TypeScript string enum.',
      input: [Suit.Hearts, Suit.Spades],
      run: (values) => values.map((value) => RoundTrip.echoStringEnum(value)),
    }),
    roundTrip({
      group: 'sync',
      name: 'number enum',
      description: 'Sends the members of a TypeScript number enum.',
      input: [Priority.Low, Priority.High],
      run: (values) => values.map((value) => RoundTrip.echoNumberEnum(value)),
    }),
    roundTrip({
      group: 'sync',
      name: 'nullable',
      description:
        'Sends a nullable string and a nullable number, each with a value and as null.',
      input: { strings: ['text', null], numbers: [1.5, null] },
      run: ({ strings, numbers: values }) => ({
        strings: strings.map((value) => RoundTrip.echoNullableString(value)),
        numbers: values.map((value) => RoundTrip.echoNullableNumber(value)),
      }),
    }),
    roundTrip({
      group: 'sync',
      name: 'optional',
      description:
        'Calls a method with an optional argument given, passed as undefined, and then left out.',
      input: ['given', undefined] as const,
      run: ([given, missing]) => [
        RoundTrip.echoOptionalString(given),
        RoundTrip.echoOptionalString(missing),
        attempt(() => RoundTrip.echoOptionalString()),
      ],
      expected: ['given', null, null],
      differences: {
        android: {
          expected: [
            'given',
            null,
            {
              message:
                'Exception in HostFunction: TurboModule method "echoOptionalString" called with 0 arguments (expected argument count: 1).',
            },
          ],
          reason:
            'JavaTurboModule requires every argument; pass undefined for an optional one',
        },
      },
    }),
    roundTrip({
      group: 'sync',
      name: 'array',
      description: 'Sends an empty and a non-empty array of strings.',
      input: [[], ['a', '', unicode]],
      run: (arrays) => arrays.map((value) => RoundTrip.echoStringArray(value)),
    }),
    roundTrip({
      group: 'sync',
      name: 'nested array',
      description: 'Sends an array of number arrays, one of them empty.',
      input: [[1, 2], [], [3.5]],
      run: (matrix) => RoundTrip.echoMatrix(matrix),
    }),
    roundTrip({
      group: 'sync',
      name: 'type alias',
      description:
        'Sends an object of a named type, which codegen turns into a native struct.',
      input: { x: 1.5, y: -2 },
      run: (point) => RoundTrip.echoPoint(point),
    }),
    roundTrip({
      group: 'sync',
      name: 'array of type alias',
      description: 'Sends an array of objects of a named type.',
      input: [
        { x: 0, y: 0 },
        { x: 1, y: -1 },
      ],
      run: (points) => RoundTrip.echoPoints(points),
    }),
    roundTrip({
      group: 'sync',
      name: 'dictionary',
      description: 'Sends an object with any string keys and number values.',
      input: { a: 1, b: -2.5 },
      run: (dictionary) => RoundTrip.echoDictionary(dictionary),
    }),
    roundTrip({
      group: 'sync',
      name: 'UnsafeObject',
      description:
        'Sends an untyped object holding nested objects and a mixed array.',
      input: { nested: { list: [1, 'two', false, null] }, empty: {} },
      run: (object) => RoundTrip.echoObject(object),
    }),
    roundTrip({
      group: 'sync',
      name: 'UnsafeObject null property',
      description: 'Sends an untyped object with a property set to null.',
      input: { kept: 1, dropped: null },
      run: (object) => RoundTrip.echoObject(object),
      differences: {
        ios: {
          expected: { kept: 1 },
          reason:
            'null properties are dropped unless enableModuleArgumentNSNullConversionIOS is on',
        },
      },
    }),
    roundTrip({
      group: 'sync',
      name: 'RootTag',
      description:
        'Sends a root tag, the number React Native uses to identify a root view.',
      input: 11,
      // RootTag is opaque in TypeScript; at runtime it's a number.
      run: (tag) => RoundTrip.echoRootTag(tag as unknown as RootTag),
    }),
    roundTrip({
      group: 'sync',
      name: 'Sample with every field',
      description:
        'Sends an object with a field of every type a typed object can hold.',
      input: fullSample,
      run: (sample) => RoundTrip.echoSample(sample),
    }),
    roundTrip({
      group: 'sync',
      name: 'sparse Sample',
      description:
        'Sends the same type with the optional field left out, the nullable field null, and empty collections.',
      input: sparseSample,
      run: (sample) => RoundTrip.echoSample(sample),
    }),
    roundTrip({
      group: 'sync',
      name: 'non-finite numbers in objects',
      description:
        "Sends NaN and the infinities inside typed objects, which can carry them although JSON can't.",
      input: [nonFinitePoint, nonFiniteSample] as const,
      run: ([point, sample]) => [
        RoundTrip.echoPoint(point),
        RoundTrip.echoSample(sample),
      ],
    }),
    roundTrip({
      group: 'promise',
      name: 'resolve Sample',
      description:
        'Sends the full sample to a method that returns it by resolving a promise.',
      input: fullSample,
      run: (sample) => RoundTrip.echoSampleAsync(sample),
    }),
    roundTrip({
      group: 'promise',
      name: 'resolve void',
      description: 'Calls a method whose promise resolves with no value.',
      run: () => RoundTrip.resolveVoid(),
      expected: undefined,
      differences: {
        android: {
          expected: null,
          reason: 'promise.resolve(null) arrives as null',
        },
      },
    }),
    roundTrip({
      group: 'promise',
      name: 'reject',
      description:
        "Calls a method that rejects its promise with the code and message it's given.",
      input: { code: 'E_ROUND_TRIP', message: 'on purpose' },
      run: ({ code, message }) =>
        rejection(RoundTrip.rejectPromise(code, message)),
    }),
    roundTrip({
      group: 'callback',
      name: 'Sample',
      description:
        'Sends the full sample to a method that passes it back to a callback.',
      input: fullSample,
      run: (sample) =>
        new Promise((resolve) => RoundTrip.echoSampleCallback(sample, resolve)),
    }),
    roundTrip({
      group: 'event',
      name: 'Sample',
      description:
        'Sends the full sample to a method that emits it back as an onSample event.',
      input: fullSample,
      run: (sample) => nextSampleEvent(() => RoundTrip.emitSample(sample)),
    }),
    roundTrip({
      group: 'file',
      name: 'write and read Sample',
      description:
        'Has native code write the full sample to a JSON file, then read it back.',
      input: fullSample,
      run: (sample) => fileRoundTrip('full', sample),
      expected: { path: true, bytes: true, sample: fullSample },
    }),
    roundTrip({
      group: 'file',
      name: 'write and read sparse Sample',
      description:
        'Has native code write the sparse sample to a JSON file, then read it back.',
      input: sparseSample,
      run: (sample) => fileRoundTrip('sparse', sample),
      expected: { path: true, bytes: true, sample: sparseSample },
    }),
    roundTrip({
      group: 'file',
      name: 'delete',
      description:
        'Writes a sample, deletes its file, and checks that reading it then fails.',
      input: sparseSample,
      run: async (sample) => {
        await RoundTrip.writeSample('deleted', sample);
        return {
          deleted: await RoundTrip.deleteFile('deleted'),
          read: await rejection(RoundTrip.readSample('deleted')),
        };
      },
      expected: {
        deleted: true,
        read: { code: 'E_NOT_FOUND', message: 'No sample named deleted' },
      },
    }),
    roundTrip({
      group: 'file',
      name: 'unsafe names',
      description:
        'Tries to write samples under names that are empty or could leave the folder.',
      input: ['../escape', 'full\n', ''],
      run: (names) =>
        Promise.all(
          names.map((name) =>
            rejection(RoundTrip.writeSample(name, sparseSample)),
          ),
        ),
      expected: Array(3).fill({
        code: 'E_INVALID_NAME',
        message: 'Sample names may only contain letters, digits, - and _',
      }),
    }),
    roundTrip({
      group: 'file',
      name: "Sample JSON can't represent",
      description:
        "Tries to write a sample holding NaN, which JSON can't represent, so the write must fail.",
      input: { ...fullSample, number: Number.NaN },
      run: (sample) => rejectionCode(RoundTrip.writeSample('nan', sample)),
      expected: 'E_IO',
    }),
    roundTrip({
      group: 'file',
      name: 'corrupt file',
      description:
        'Writes truncated JSON through the C++ module, then reads it as a sample, which must fail.',
      input: '{"text":',
      run: async (json) => {
        // Written through the C++ module, which writes any bytes.
        await RoundTripCxx.writeBytes(
          `${filesDirectory}/corrupt.json`,
          asciiBytes(json),
        );
        return rejectionCode(RoundTrip.readSample('corrupt'));
      },
      expected: 'E_IO',
    }),
    roundTrip({
      group: 'file',
      name: 'file missing fields',
      description:
        'Writes an empty JSON object through the C++ module, then reads it as a sample, which must fail.',
      input: '{}',
      run: async (json) => {
        await RoundTripCxx.writeBytes(
          `${filesDirectory}/empty.json`,
          asciiBytes(json),
        );
        return rejectionCode(RoundTrip.readSample('empty'));
      },
      expected: 'E_IO',
    }),
    roundTrip({
      group: 'file',
      name: 'malformed samples',
      description:
        'Writes files that each break the sample type one way, and checks that reading every one fails.',
      input: malformedSamples,
      run: async (samples) => {
        const codes: Record<string, unknown> = {};
        for (const [name, sample] of Object.entries(samples)) {
          await RoundTripCxx.writeBytes(
            `${filesDirectory}/malformed.json`,
            asciiBytes(JSON.stringify(sample)),
          );
          codes[name] = await rejectionCode(RoundTrip.readSample('malformed'));
        }
        return codes;
      },
      expected: Object.fromEntries(
        Object.keys(malformedSamples).map((name) => [name, 'E_IO']),
      ),
    }),
    roundTrip({
      group: 'c++',
      name: 'ArrayBuffer',
      description:
        'Sends the bytes 0 to 255, and an empty buffer, to the C++ module, which returns copies.',
      input: [byteRange(), new ArrayBuffer(0)],
      run: (buffers) =>
        buffers.map((value) => RoundTripCxx.echoArrayBuffer(value)),
    }),
    roundTrip({
      group: 'c++',
      name: 'mixed',
      description:
        'Sends JSON-like values of every kind to the C++ module, which copies them through C++.',
      input: mixed,
      run: (values) => values.map((value) => RoundTripCxx.echoMixed(value)),
    }),
    roundTrip({
      group: 'c++',
      name: 'cyclic mixed',
      description:
        'Sends an object that contains itself, which the C++ module must reject.',
      input: cyclic,
      run: (value) => attempt(() => RoundTripCxx.echoMixed(value)),
      expected: { message: "echoMixed can't copy a cyclic value" },
    }),
    roundTrip({
      group: 'c++',
      name: 'mixed nesting limit',
      description:
        'Sends arrays nested 256 and 257 deep; the C++ module copies the first and rejects the second.',
      input: [nested(256), nested(257)] as const,
      run: ([accepted, rejected]) => [
        RoundTripCxx.echoMixed(accepted),
        attempt(() => RoundTripCxx.echoMixed(rejected)),
      ],
      expected: [
        nested(256),
        { message: 'echoMixed accepts values nested at most 256 deep' },
      ],
    }),
    roundTrip({
      group: 'c++',
      name: 'write and read bytes',
      description:
        'Has the C++ module write 256 bytes to a file on a background thread, then read them back.',
      input: byteRange(),
      run: async (bytes) => ({
        written: await RoundTripCxx.writeBytes(bytesPath, bytes),
        read: await RoundTripCxx.readBytes(bytesPath),
      }),
      expected: { written: 256, read: byteRange() },
    }),
    roundTrip({
      group: 'c++',
      name: 'bytes copied at call',
      description:
        'Overwrites a buffer right after asking the C++ module to write it, which must not change the file.',
      input: byteRange(),
      run: async (bytes) => {
        const buffer = bytes.slice(0);
        const written = RoundTripCxx.writeBytes(bytesPath, buffer);
        new Uint8Array(buffer).fill(0);
        await written;
        return RoundTripCxx.readBytes(bytesPath);
      },
    }),
    roundTrip({
      group: 'c++',
      name: 'read missing file',
      description:
        "Has the C++ module read a file that doesn't exist, which must fail.",
      input: missingPath,
      run: (path) => rejection(RoundTripCxx.readBytes(path)),
      expected: { message: `Could not read ${missingPath}` },
    }),
  ];
}
