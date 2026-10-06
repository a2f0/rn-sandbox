import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

const helperPath = resolve(__dirname, '../lib/play_version_code.rb');

// Each case maps a track to its version codes, or to an error message to raise.
const script = `
require "json"
require ARGV.fetch(0)

def run(responses)
  missing = []
  code = PlayVersionCode.next_code(responses.keys, on_missing: ->(track, _error) { missing << track }) do |track|
    response = responses.fetch(track)
    raise response if response.is_a?(String)

    response
  end
  { code: code, missing: missing }
rescue StandardError => e
  { error: e.message }
end

puts JSON.generate(
  highest: run("production" => [3, 5], "beta" => [7], "alpha" => [], "internal" => [6]),
  empty: run("production" => [], "internal" => []),
  no_app: run("production" => "Package not found: net.a2f0.sandbox.rn.", "internal" => "Package not found: net.a2f0.sandbox.rn."),
  no_track: run("production" => "Track not found", "internal" => [2]),
  string_codes: run("internal" => ["9", "10"]),
  auth_error: run("production" => [4], "internal" => "Request had invalid authentication credentials")
)
`;

test('next Play version code follows the highest existing code', () => {
  const child = spawnSync('ruby', ['-e', script, helperPath], {
    encoding: 'utf8',
  });
  if (child.error) {
    throw child.error;
  }
  if (child.status !== 0) {
    throw new Error(`ruby exited with ${child.status}: ${child.stderr}`);
  }

  const results = JSON.parse(child.stdout);
  expect(results.highest).toEqual({ code: 8, missing: [] });
  expect(results.empty).toEqual({ code: 1, missing: [] });
  expect(results.no_app).toEqual({
    code: 1,
    missing: ['production', 'internal'],
  });
  expect(results.no_track).toEqual({ code: 3, missing: ['production'] });
  expect(results.string_codes).toEqual({ code: 11, missing: [] });
  // Any other failure must stop the lane rather than risk a duplicate code.
  expect(results.auth_error).toEqual({
    error: 'Request had invalid authentication credentials',
  });
});
