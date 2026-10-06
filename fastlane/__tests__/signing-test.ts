import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const libDir = resolve(__dirname, '../lib');

function runRuby(script: string, ...args: string[]) {
  const child = spawnSync('ruby', ['-e', script, libDir, ...args], {
    encoding: 'utf8',
  });
  if (child.error) {
    throw child.error;
  }
  if (child.status !== 0) {
    throw new Error(`ruby exited with ${child.status}: ${child.stderr}`);
  }
  return JSON.parse(child.stdout);
}

// Each case records the create/yield/delete calls and the error that escaped.
const keychainScript = `
require "json"
require File.join(ARGV.fetch(0), "signing_keychain")

def exercise(fail_create: false, created_before_failure: false, fail_block: false)
  events = []
  created = false
  passwords = []
  result = nil
  error = nil
  begin
    result = SigningKeychain.with_temporary(
      create: proc do |name, password|
        created = created_before_failure || !fail_create
        events << ["create", name]
        passwords << password
        raise "create failed" if fail_create
      end,
      delete: proc { |name| events << ["delete", name] },
      exists: proc { |_name| created }
    ) do |name, password|
      events << ["yield", name]
      passwords << password
      raise "build failed" if fail_block

      "built"
    end
  rescue StandardError => e
    error = e.message
  end
  names = events.map(&:last).uniq
  { events: events.map(&:first), one_name: names.length == 1, name: names.first,
    passwords: passwords.uniq.length, password_hex: passwords.all? { |p| p.match?(/\\A\\h{64}\\z/) },
    result: result, error: error }
end

keychains = ARGV.fetch(1)
File.write(File.join(keychains, "present-db"), "")

puts JSON.generate(
  success: exercise,
  block_failure: exercise(fail_block: true),
  create_failure: exercise(fail_create: true),
  partial_create_failure: exercise(fail_create: true, created_before_failure: true),
  exists_present: SigningKeychain.exists?("present", keychains_dir: keychains),
  exists_missing: SigningKeychain.exists?("missing", keychains_dir: keychains)
)
`;

const restoredFileScript = `
require "json"
require File.join(ARGV.fetch(0), "restored_file")

path = File.join(ARGV.fetch(1), "project.pbxproj")
File.write(path, "original")

success = RestoredFile.around(path) do
  File.write(path, "signed")
  File.read(path)
end
after_success = File.read(path)

error = nil
begin
  RestoredFile.around(path) do
    File.write(path, "signed")
    raise "build failed"
  end
rescue StandardError => e
  error = e.message
end

puts JSON.generate(success: success, after_success: after_success, error: error, after_failure: File.read(path))
`;

let workDir: string;

beforeEach(() => {
  workDir = mkdtempSync(join(tmpdir(), 'rn-sandbox-signing-'));
});

afterEach(() => {
  rmSync(workDir, { force: true, recursive: true });
});

test('temporary signing keychains are deleted however the lane ends', () => {
  const results = runRuby(keychainScript, workDir);

  expect(results.success).toMatchObject({
    events: ['create', 'yield', 'delete'],
    one_name: true,
    passwords: 1,
    password_hex: true,
    result: 'built',
    error: null,
  });
  expect(results.success.name).toMatch(/^rn-sandbox-fastlane-\d+-[0-9a-f]{8}$/);

  expect(results.block_failure).toMatchObject({
    events: ['create', 'yield', 'delete'],
    one_name: true,
    error: 'build failed',
  });
  expect(results.block_failure.name).not.toBe(results.success.name);

  // Nothing to delete, so the setup error isn't masked by a failed cleanup.
  expect(results.create_failure).toMatchObject({
    events: ['create'],
    error: 'create failed',
  });
  expect(results.partial_create_failure).toMatchObject({
    events: ['create', 'delete'],
    one_name: true,
    error: 'create failed',
  });

  expect(results.exists_present).toBe(true);
  expect(results.exists_missing).toBe(false);
});

test('the project file is restored after signing builds', () => {
  expect(runRuby(restoredFileScript, workDir)).toEqual({
    success: 'signed',
    after_success: 'original',
    error: 'build failed',
    after_failure: 'original',
  });
});
