import { type EventSubscription, Platform, type RootTag } from 'react-native';
import RoundTrip, {
  Priority,
  type Sample,
  Suit,
} from '../../specs/NativeRoundTrip';
import RoundTripCxx from '../../specs/NativeRoundTripCxx';
import { byteRange, fullSample, sparseSample } from './fixtures';

export type RoundTripPlatform = 'android' | 'ios' | 'web';

export type RoundTripCase = {
  group: string;
  name: string;
  run: () => unknown;
  expected: unknown;
  // What a platform's bridge returns instead, where it changes the value.
  differences?: Partial<
    Record<RoundTripPlatform, { expected: unknown; reason: string }>
  >;
};

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
    {
      group: 'constants',
      name: 'platform',
      run: () => RoundTrip.getConstants().platform,
      expected: Platform.OS,
    },
    {
      group: 'sync',
      name: 'string',
      run: () =>
        ['', 'plain', unicode].map((value) => RoundTrip.echoString(value)),
      expected: ['', 'plain', unicode],
    },
    {
      group: 'sync',
      name: 'string with NUL',
      run: () => RoundTrip.echoString('a\u0000b'),
      expected: 'a\u0000b',
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
    },
    {
      group: 'sync',
      name: 'number',
      run: () => numbers.map((value) => RoundTrip.echoNumber(value)),
      expected: numbers,
    },
    {
      group: 'sync',
      name: 'Int32',
      run: () =>
        [0, -1, 2147483647, -2147483648].map((value) =>
          RoundTrip.echoInt32(value),
        ),
      expected: [0, -1, 2147483647, -2147483648],
    },
    {
      group: 'sync',
      name: 'Float',
      run: () => floats.map((value) => RoundTrip.echoFloat(value)),
      expected: floats,
      differences: {
        ios: {
          expected: floats.map(lowFloatBits),
          reason:
            'ObjCTurboModule passes the double to the float parameter, which reads its low 32 bits',
        },
      },
    },
    {
      group: 'sync',
      name: 'Double',
      run: () =>
        [0.1 + 0.2, Number.MAX_VALUE, -Number.MIN_VALUE].map((value) =>
          RoundTrip.echoDouble(value),
        ),
      expected: [0.1 + 0.2, Number.MAX_VALUE, -Number.MIN_VALUE],
    },
    {
      group: 'sync',
      name: 'boolean',
      run: () => [true, false].map((value) => RoundTrip.echoBoolean(value)),
      expected: [true, false],
    },
    {
      group: 'sync',
      name: 'literals',
      run: () => [
        RoundTrip.echoStringLiteral('exact'),
        RoundTrip.echoNumberLiteral(42),
        RoundTrip.echoBooleanLiteral(true),
      ],
      expected: ['exact', 42, true],
    },
    {
      group: 'sync',
      name: 'string union',
      run: () =>
        (['north', 'south'] as const).map((value) =>
          RoundTrip.echoStringUnion(value),
        ),
      expected: ['north', 'south'],
    },
    {
      group: 'sync',
      name: 'number union',
      run: () =>
        ([1, 2, 3] as const).map((value) => RoundTrip.echoNumberUnion(value)),
      expected: [1, 2, 3],
    },
    {
      group: 'sync',
      name: 'object union',
      run: () =>
        [{ radius: 1.5 }, { side: 2 }].map((value) =>
          RoundTrip.echoObjectUnion(value),
        ),
      expected: [{ radius: 1.5 }, { side: 2 }],
    },
    {
      group: 'sync',
      name: 'string enum',
      run: () =>
        [Suit.Hearts, Suit.Spades].map((value) =>
          RoundTrip.echoStringEnum(value),
        ),
      expected: ['hearts', 'spades'],
    },
    {
      group: 'sync',
      name: 'number enum',
      run: () =>
        [Priority.Low, Priority.High].map((value) =>
          RoundTrip.echoNumberEnum(value),
        ),
      expected: [1, 3],
    },
    {
      group: 'sync',
      name: 'nullable',
      run: () => [
        RoundTrip.echoNullableString('text'),
        RoundTrip.echoNullableString(null),
        RoundTrip.echoNullableNumber(1.5),
        RoundTrip.echoNullableNumber(null),
      ],
      expected: ['text', null, 1.5, null],
    },
    {
      group: 'sync',
      name: 'optional',
      run: () => [
        RoundTrip.echoOptionalString('given'),
        RoundTrip.echoOptionalString(undefined),
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
    },
    {
      group: 'sync',
      name: 'array',
      run: () =>
        [[], ['a', '', unicode]].map((value) =>
          RoundTrip.echoStringArray(value),
        ),
      expected: [[], ['a', '', unicode]],
    },
    {
      group: 'sync',
      name: 'nested array',
      run: () => RoundTrip.echoMatrix([[1, 2], [], [3.5]]),
      expected: [[1, 2], [], [3.5]],
    },
    {
      group: 'sync',
      name: 'type alias',
      run: () => RoundTrip.echoPoint({ x: 1.5, y: -2 }),
      expected: { x: 1.5, y: -2 },
    },
    {
      group: 'sync',
      name: 'array of type alias',
      run: () =>
        RoundTrip.echoPoints([
          { x: 0, y: 0 },
          { x: 1, y: -1 },
        ]),
      expected: [
        { x: 0, y: 0 },
        { x: 1, y: -1 },
      ],
    },
    {
      group: 'sync',
      name: 'dictionary',
      run: () => RoundTrip.echoDictionary({ a: 1, b: -2.5 }),
      expected: { a: 1, b: -2.5 },
    },
    {
      group: 'sync',
      name: 'UnsafeObject',
      run: () =>
        RoundTrip.echoObject({
          nested: { list: [1, 'two', false, null] },
          empty: {},
        }),
      expected: { nested: { list: [1, 'two', false, null] }, empty: {} },
    },
    {
      group: 'sync',
      name: 'UnsafeObject null property',
      run: () => RoundTrip.echoObject({ kept: 1, dropped: null }),
      expected: { kept: 1, dropped: null },
      differences: {
        ios: {
          expected: { kept: 1 },
          reason:
            'null properties are dropped unless enableModuleArgumentNSNullConversionIOS is on',
        },
      },
    },
    {
      group: 'sync',
      name: 'RootTag',
      // RootTag is opaque in TypeScript; at runtime it's a number.
      run: () => RoundTrip.echoRootTag(11 as unknown as RootTag),
      expected: 11,
    },
    {
      group: 'sync',
      name: 'Sample with every field',
      run: () => RoundTrip.echoSample(fullSample),
      expected: fullSample,
    },
    {
      group: 'sync',
      name: 'sparse Sample',
      run: () => RoundTrip.echoSample(sparseSample),
      expected: sparseSample,
    },
    {
      group: 'sync',
      name: 'non-finite numbers in objects',
      run: () => [
        RoundTrip.echoPoint(nonFinitePoint),
        RoundTrip.echoSample(nonFiniteSample),
      ],
      expected: [nonFinitePoint, nonFiniteSample],
    },
    {
      group: 'promise',
      name: 'resolve Sample',
      run: () => RoundTrip.echoSampleAsync(fullSample),
      expected: fullSample,
    },
    {
      group: 'promise',
      name: 'resolve void',
      run: () => RoundTrip.resolveVoid(),
      expected: undefined,
      differences: {
        android: {
          expected: null,
          reason: 'promise.resolve(null) arrives as null',
        },
      },
    },
    {
      group: 'promise',
      name: 'reject',
      run: () =>
        rejection(RoundTrip.rejectPromise('E_ROUND_TRIP', 'on purpose')),
      expected: { code: 'E_ROUND_TRIP', message: 'on purpose' },
    },
    {
      group: 'callback',
      name: 'Sample',
      run: () =>
        new Promise((resolve) =>
          RoundTrip.echoSampleCallback(fullSample, resolve),
        ),
      expected: fullSample,
    },
    {
      group: 'event',
      name: 'Sample',
      run: () => nextSampleEvent(() => RoundTrip.emitSample(fullSample)),
      expected: fullSample,
    },
    {
      group: 'file',
      name: 'write and read Sample',
      run: () => fileRoundTrip('full', fullSample),
      expected: { path: true, bytes: true, sample: fullSample },
    },
    {
      group: 'file',
      name: 'write and read sparse Sample',
      run: () => fileRoundTrip('sparse', sparseSample),
      expected: { path: true, bytes: true, sample: sparseSample },
    },
    {
      group: 'file',
      name: 'delete',
      run: async () => {
        await RoundTrip.writeSample('deleted', sparseSample);
        return {
          deleted: await RoundTrip.deleteFile('deleted'),
          read: await rejection(RoundTrip.readSample('deleted')),
        };
      },
      expected: {
        deleted: true,
        read: { code: 'E_NOT_FOUND', message: 'No sample named deleted' },
      },
    },
    {
      group: 'file',
      name: 'unsafe names',
      run: () =>
        Promise.all(
          ['../escape', 'full\n', ''].map((name) =>
            rejection(RoundTrip.writeSample(name, sparseSample)),
          ),
        ),
      expected: Array(3).fill({
        code: 'E_INVALID_NAME',
        message: 'Sample names may only contain letters, digits, - and _',
      }),
    },
    {
      group: 'file',
      name: "Sample JSON can't represent",
      run: () =>
        rejectionCode(
          RoundTrip.writeSample('nan', { ...fullSample, number: Number.NaN }),
        ),
      expected: 'E_IO',
    },
    {
      group: 'file',
      name: 'corrupt file',
      run: async () => {
        // Written through the C++ module, which writes any bytes.
        await RoundTripCxx.writeBytes(
          `${filesDirectory}/corrupt.json`,
          asciiBytes('{"text":'),
        );
        return rejectionCode(RoundTrip.readSample('corrupt'));
      },
      expected: 'E_IO',
    },
    {
      group: 'file',
      name: 'file missing fields',
      run: async () => {
        await RoundTripCxx.writeBytes(
          `${filesDirectory}/empty.json`,
          asciiBytes('{}'),
        );
        return rejectionCode(RoundTrip.readSample('empty'));
      },
      expected: 'E_IO',
    },
    {
      group: 'file',
      name: 'malformed samples',
      run: async () => {
        const codes: Record<string, unknown> = {};
        for (const [name, sample] of Object.entries(malformedSamples)) {
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
    },
    {
      group: 'c++',
      name: 'ArrayBuffer',
      run: () =>
        [byteRange(), new ArrayBuffer(0)].map((value) =>
          RoundTripCxx.echoArrayBuffer(value),
        ),
      expected: [byteRange(), new ArrayBuffer(0)],
    },
    {
      group: 'c++',
      name: 'mixed',
      run: () => mixed.map((value) => RoundTripCxx.echoMixed(value)),
      expected: mixed,
    },
    {
      group: 'c++',
      name: 'cyclic mixed',
      run: () => attempt(() => RoundTripCxx.echoMixed(cyclic)),
      expected: { message: "echoMixed can't copy a cyclic value" },
    },
    {
      group: 'c++',
      name: 'mixed nesting limit',
      run: () => [
        RoundTripCxx.echoMixed(nested(256)),
        attempt(() => RoundTripCxx.echoMixed(nested(257))),
      ],
      expected: [
        nested(256),
        { message: 'echoMixed accepts values nested at most 256 deep' },
      ],
    },
    {
      group: 'c++',
      name: 'write and read bytes',
      run: async () => ({
        written: await RoundTripCxx.writeBytes(bytesPath, byteRange()),
        read: await RoundTripCxx.readBytes(bytesPath),
      }),
      expected: { written: 256, read: byteRange() },
    },
    {
      group: 'c++',
      name: 'bytes copied at call',
      run: async () => {
        const bytes = byteRange();
        const written = RoundTripCxx.writeBytes(bytesPath, bytes);
        new Uint8Array(bytes).fill(0);
        await written;
        return RoundTripCxx.readBytes(bytesPath);
      },
      expected: byteRange(),
    },
    {
      group: 'c++',
      name: 'read missing file',
      run: () => rejection(RoundTripCxx.readBytes(missingPath)),
      expected: { message: `Could not read ${missingPath}` },
    },
  ];
}
