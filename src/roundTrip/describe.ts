// A compact, unambiguous rendering of a round-tripped value: unlike
// JSON.stringify it shows undefined, NaN, Infinity, -0, ArrayBuffers, and
// cycles. enclosing holds the objects that contain value.
export function describe(value: unknown, enclosing: object[] = []): string {
  if (typeof value === 'number') {
    return Object.is(value, -0) ? '-0' : String(value);
  }
  if (typeof value === 'string') {
    return JSON.stringify(value);
  }
  if (typeof value !== 'object' || value === null) {
    return String(value);
  }
  if (value instanceof ArrayBuffer) {
    const bytes = Array.from(new Uint8Array(value).slice(0, 8));
    return `ArrayBuffer(${value.byteLength})[${bytes.join(',')}${value.byteLength > 8 ? ',…' : ''}]`;
  }
  if (value instanceof Error) {
    return `Error(${JSON.stringify(value.message)})`;
  }
  if (enclosing.includes(value)) {
    return '[circular]';
  }
  const inner = [...enclosing, value];
  if (Array.isArray(value)) {
    return `[${value.map((item) => describe(item, inner)).join(', ')}]`;
  }
  const entries = Object.entries(value).map(
    ([key, item]) => `${key}: ${describe(item, inner)}`,
  );
  return `{${entries.join(', ')}}`;
}
