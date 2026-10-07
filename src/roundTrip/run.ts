import RoundTrip from '../../specs/NativeRoundTrip';
import { createCases, type RoundTripPlatform } from './cases';
import { deepEqual } from './deepEqual';

export type RoundTripResult = {
  group: string;
  name: string;
  description: string;
  input: unknown;
  passed: boolean;
  expected: unknown;
  actual: unknown;
  // Why this platform's bridge changes the value, when it does.
  difference?: string;
};

const timeoutMs = 5000;

export async function runRoundTrips(): Promise<RoundTripResult[]> {
  const platform = RoundTrip.getConstants().platform as RoundTripPlatform;
  const results: RoundTripResult[] = [];
  for (const {
    group,
    name,
    description,
    input,
    run,
    ...testCase
  } of createCases()) {
    const difference = testCase.differences?.[platform];
    const expected = difference ? difference.expected : testCase.expected;
    let actual: unknown;
    try {
      actual = await withTimeout(Promise.resolve().then(run));
    } catch (error) {
      actual = error instanceof Error ? error : new Error(String(error));
    }
    results.push({
      group,
      name,
      description,
      input,
      passed: deepEqual(actual, expected),
      expected,
      actual,
      difference: difference?.reason,
    });
  }
  return results;
}

function withTimeout<T>(promise: Promise<T>): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () => reject(new Error(`Timed out after ${timeoutMs} ms`)),
      timeoutMs,
    );
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}
