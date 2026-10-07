import { Platform } from 'react-native';
import { createCases } from '../src/roundTrip/cases';
import { describe as describeValue } from '../src/roundTrip/describe';
import { runRoundTrips } from '../src/roundTrip/run';

// jest.setup.ts provides the web modules, which report the web platform.
beforeEach(() => {
  jest.replaceProperty(Platform, 'OS', 'web');
});

test('the web modules pass every case', async () => {
  const results = await runRoundTrips();
  expect(results).toHaveLength(createCases().length);
  const failures = results
    .filter((result) => !result.passed)
    .map(
      ({ group, name, expected, actual }) =>
        `${group}/${name}: expected ${describeValue(expected)}, got ${describeValue(actual)}`,
    );
  expect(failures).toEqual([]);
});
