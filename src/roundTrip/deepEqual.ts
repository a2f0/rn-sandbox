// Structural equality for round-tripped values. Numbers compare with Object.is,
// so NaN equals NaN and -0 differs from 0; object keys compare in any order;
// ArrayBuffers compare byte by byte.
export function deepEqual(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) {
    return true;
  }
  if (a instanceof ArrayBuffer || b instanceof ArrayBuffer) {
    return (
      a instanceof ArrayBuffer &&
      b instanceof ArrayBuffer &&
      deepEqual(Array.from(new Uint8Array(a)), Array.from(new Uint8Array(b)))
    );
  }
  if (Array.isArray(a) || Array.isArray(b)) {
    return (
      Array.isArray(a) &&
      Array.isArray(b) &&
      a.length === b.length &&
      a.every((item, i) => deepEqual(item, b[i]))
    );
  }
  if (isObject(a) && isObject(b)) {
    const keys = Object.keys(a);
    return (
      keys.length === Object.keys(b).length &&
      keys.every((key) => Object.hasOwn(b, key) && deepEqual(a[key], b[key]))
    );
  }
  return false;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
