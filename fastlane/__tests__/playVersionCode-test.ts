import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

const helperPath = resolve(__dirname, '../lib/play_version_code.rb');

// Each case maps a track (and "uploaded bundles") to its version codes, or to
// an error message to raise. Uploaded bundles have none unless a case says so.
const script = `
require "json"
require ARGV.fetch(0)

def run(responses)
  responses = { PlayVersionCode::UPLOADED => [] }.merge(responses)
  tracks = responses.keys - [PlayVersionCode::UPLOADED]
  missing = []
  code = PlayVersionCode.next_code(tracks, on_missing: ->(source, _error) { missing << source }) do |source|
    response = responses.fetch(source)
    raise response if response.is_a?(String)

    response
  end
  { code: code, missing: missing }
rescue StandardError => e
  { error: e.message }
end

not_found = "Package not found: net.a2f0.sandbox.rn."
puts JSON.generate(
  highest: run("production" => [3, 5], "beta" => [7], "alpha" => [], "internal" => [6]),
  empty: run("production" => [], "internal" => []),
  no_app: run("production" => not_found, "internal" => not_found, PlayVersionCode::UPLOADED => not_found),
  no_track: run("production" => "Track not found", "internal" => [2]),
  string_codes: run("internal" => ["9", "10"]),
  dropped_upload: run("internal" => [4], PlayVersionCode::UPLOADED => [4, 6]),
  auth_error: run("production" => [4], "internal" => "Request had invalid authentication credentials"),
  uploaded_auth_error: run("internal" => [4], PlayVersionCode::UPLOADED => "Request had invalid authentication credentials")
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
    missing: ['production', 'internal', 'uploaded bundles'],
  });
  expect(results.no_track).toEqual({ code: 3, missing: ['production'] });
  expect(results.string_codes).toEqual({ code: 11, missing: [] });
  // A build dropped from a draft keeps its code, so the next one must skip it.
  expect(results.dropped_upload).toEqual({ code: 7, missing: [] });
  // Any other failure must stop the lane rather than risk a duplicate code.
  expect(results.auth_error).toEqual({
    error: 'Request had invalid authentication credentials',
  });
  expect(results.uploaded_auth_error).toEqual({
    error: 'Request had invalid authentication credentials',
  });
});
