import { describe as describeValue } from '../src/roundTrip/describe';

test('shows values JSON.stringify loses', () => {
  expect(describeValue(undefined)).toBe('undefined');
  expect(describeValue(-0)).toBe('-0');
  expect(describeValue(Number.NaN)).toBe('NaN');
  expect(describeValue('a\u0000b')).toBe('"a\\u0000b"');
  expect(describeValue([null, undefined])).toBe('[null, undefined]');
  expect(describeValue(new Error('failed'))).toBe('Error("failed")');
  expect(describeValue(Uint8Array.from([1, 2, 3]).buffer)).toBe(
    'ArrayBuffer(3)[1,2,3]',
  );
});

test('marks cycles instead of recursing into them', () => {
  const cyclic: Record<string, unknown> = { name: 'cyclic' };
  cyclic.self = cyclic;
  cyclic.list = [cyclic];
  expect(describeValue(cyclic)).toBe(
    '{name: "cyclic", self: [circular], list: [[circular]]}',
  );

  // A value repeated outside its own nesting isn't a cycle.
  const shared = { x: 1 };
  expect(describeValue([shared, shared])).toBe('[{x: 1}, {x: 1}]');
});
