import { Priority, type Sample, Suit } from '../../specs/NativeRoundTrip';

// Every field set, with values that survive a JSON file on every platform.
export const fullSample: Sample = {
  text: 'Grüße, 世界 👋🏽',
  number: 1234.5678,
  int32: 2147483647,
  floatValue: 3.25,
  doubleValue: 0.1 + 0.2,
  flag: true,
  stringLiteral: 'exact',
  numberLiteral: 42,
  booleanLiteral: true,
  stringUnion: 'south',
  numberUnion: 2,
  objectUnion: { radius: 1.5 },
  stringEnum: Suit.Spades,
  numberEnum: Priority.High,
  nullableText: 'present',
  optionalNumber: -7.5,
  strings: ['alpha', '', 'γάμμα'],
  matrix: [[1, 2, 3], [], [-0.5]],
  points: [
    { x: 0, y: 0 },
    { x: -1.25, y: 1e21 },
  ],
  point: { x: Number.MAX_SAFE_INTEGER, y: -273.15 },
  dictionary: { one: 1, two: 2 },
  object: { nested: { list: [1, 'two', false] }, empty: {} },
};

// The optional field omitted, the nullable field null, and empty collections.
export const sparseSample: Sample = {
  text: '',
  number: 0,
  int32: -2147483648,
  floatValue: -0.5,
  doubleValue: 1e-7,
  flag: false,
  stringLiteral: 'exact',
  numberLiteral: 42,
  booleanLiteral: true,
  stringUnion: 'north',
  numberUnion: 1,
  objectUnion: { side: 2 },
  stringEnum: Suit.Hearts,
  numberEnum: Priority.Low,
  nullableText: null,
  strings: [],
  matrix: [],
  points: [],
  point: { x: 0, y: 0 },
  dictionary: {},
  object: {},
};

// 0x00 through 0xff.
export function byteRange(): ArrayBuffer {
  return Uint8Array.from({ length: 256 }, (_, i) => i).buffer;
}
