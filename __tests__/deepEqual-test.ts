import { deepEqual } from '../src/roundTrip/deepEqual';

test('compares numbers with Object.is', () => {
  expect(deepEqual(Number.NaN, Number.NaN)).toBe(true);
  expect(deepEqual(0, -0)).toBe(false);
  expect(deepEqual([1, 2], [1, 2])).toBe(true);
});

test('ignores key order but not missing keys', () => {
  expect(deepEqual({ a: 1, b: [2] }, { b: [2], a: 1 })).toBe(true);
  expect(deepEqual({ a: undefined }, {})).toBe(false);
  expect(deepEqual({ a: null }, { a: undefined })).toBe(false);
});

test('does not equate arrays and objects', () => {
  expect(deepEqual([1], { 0: 1 })).toBe(false);
  expect(deepEqual(null, {})).toBe(false);
});

test('compares ArrayBuffers by bytes', () => {
  const bytes = (...values: number[]) => Uint8Array.from(values).buffer;
  expect(deepEqual(bytes(1, 2, 3), bytes(1, 2, 3))).toBe(true);
  expect(deepEqual(bytes(1, 2, 3), bytes(1, 2, 4))).toBe(false);
  expect(deepEqual(bytes(1, 2), [1, 2])).toBe(false);
});
