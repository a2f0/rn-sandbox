// A compact, unambiguous rendering of a round-tripped value: unlike
// JSON.stringify it shows undefined, NaN, Infinity, -0, and ArrayBuffers.
export function describe(value: unknown): string {
  if (value === undefined) {
    return 'undefined';
  }
  if (typeof value === 'number') {
    return Object.is(value, -0) ? '-0' : String(value);
  }
  if (typeof value === 'string') {
    return JSON.stringify(value);
  }
  if (value instanceof ArrayBuffer) {
    const bytes = Array.from(new Uint8Array(value).slice(0, 8));
    return `ArrayBuffer(${value.byteLength})[${bytes.join(',')}${value.byteLength > 8 ? ',…' : ''}]`;
  }
  if (Array.isArray(value)) {
    return `[${value.map(describe).join(', ')}]`;
  }
  if (value instanceof Error) {
    return `Error(${JSON.stringify(value.message)})`;
  }
  if (typeof value === 'object' && value !== null) {
    const entries = Object.entries(value).map(
      ([key, item]) => `${key}: ${describe(item)}`,
    );
    return `{${entries.join(', ')}}`;
  }
  return String(value);
}
