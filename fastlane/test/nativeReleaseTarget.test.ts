import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

const fastlaneDir = resolve(__dirname, '..');
const repoRoot = resolve(fastlaneDir, '..');

// Loads fastlane/lib/native_release_target.rb, the Fastfile, or the Appfile in
// a fresh Ruby, since the tier is read once when the file loads, and prints
// what it selected or the error that stopped it.
const script = `
require "json"
require "fake_fastlane"
require "fake_appfile"

fastlane_dir = ARGV.fetch(0)
begin
  result =
    case ARGV.fetch(1)
    when "target"
      require File.join(fastlane_dir, "lib/native_release_target")
      { tier: NATIVE_RELEASE_TIER, app_identifier: NATIVE_APP_IDENTIFIER,
        secrets_dir: NATIVE_RELEASE_SECRETS_DIR }
    when "fastfile"
      { lanes: FakeFastfile.new(File.join(fastlane_dir, "Fastfile"), {}).lane_names }
    when "appfile"
      FakeAppfile.new(File.join(fastlane_dir, "Appfile")).values
    end
  puts JSON.generate(result)
rescue StandardError => e
  puts JSON.generate(error: e.message, type: e.class.name)
end
`;

function load(
  what: 'target' | 'fastfile' | 'appfile',
  env: Record<string, string> = {},
) {
  const {
    NATIVE_RELEASE_TIER: _tier,
    NATIVE_RELEASE_SECRETS_DIR: _secretsDir,
    ...inherited
  } = process.env;
  const child = spawnSync(
    'ruby',
    ['-I', resolve(__dirname, 'support'), '-e', script, fastlaneDir, what],
    { encoding: 'utf8', env: { ...inherited, ...env } },
  );
  if (child.error) {
    throw child.error;
  }
  if (child.status !== 0) {
    throw new Error(`ruby exited with ${child.status}: ${child.stderr}`);
  }
  return JSON.parse(child.stdout);
}

const unknownTier = (tier: string) => ({
  error: `Unknown NATIVE_RELEASE_TIER "${tier}". Declared tiers: production.`,
  type: 'FastlaneCore::UserError',
});

test('the tier defaults to production, which reads .secrets/prod', () => {
  const production = {
    tier: 'production',
    app_identifier: 'net.a2f0.sandbox.rn',
    secrets_dir: `${repoRoot}/.secrets/prod`,
  };
  expect(load('target')).toEqual(production);
  expect(load('target', { NATIVE_RELEASE_TIER: 'production' })).toEqual(
    production,
  );
});

test('NATIVE_RELEASE_SECRETS_DIR names another secrets folder', () => {
  expect(
    load('target', { NATIVE_RELEASE_SECRETS_DIR: '/elsewhere' }).secrets_dir,
  ).toBe('/elsewhere');
});

test('an undeclared or unknown tier fails, naming the declared tiers', () => {
  expect(load('target', { NATIVE_RELEASE_TIER: 'staging' })).toEqual(
    unknownTier('staging'),
  );
  expect(load('target', { NATIVE_RELEASE_TIER: 'Production' })).toEqual(
    unknownTier('Production'),
  );
  expect(load('target', { NATIVE_RELEASE_TIER: '' })).toEqual(unknownTier(''));
});

test('the Fastfile fails on an unknown tier before defining any lane', () => {
  expect(load('fastfile', { NATIVE_RELEASE_TIER: 'staging' })).toEqual(
    unknownTier('staging'),
  );
});

test('the Appfile reads the app identifier from the tier table', () => {
  expect(load('appfile')).toEqual({
    app_identifier: 'net.a2f0.sandbox.rn',
    package_name: 'net.a2f0.sandbox.rn',
  });
  expect(load('appfile', { NATIVE_RELEASE_TIER: 'staging' })).toEqual(
    unknownTier('staging'),
  );
});
