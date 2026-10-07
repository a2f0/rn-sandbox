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

// Each case records the create/yield/delete calls, the keychain search list
// (from a fake security tool) during and after the block, and the error that
// escaped.
const keychainScript = `
require "json"
require File.join(ARGV.fetch(0), "signing_keychain")

LOGIN = "/keychains/login.keychain-db"

def exercise(fail_create: false, created_before_failure: false, fail_block: false)
  events = []
  created = false
  passwords = []
  search_list = [LOGIN]
  during = nil
  result = nil
  error = nil
  security = lambda do |*args|
    if args.include?("-s")
      search_list = args.drop(args.index("-s") + 1)
      events << ["search"]
    end
    search_list.map { |path| "    \\"#{path}\\"\n" }.join
  end
  begin
    result = SigningKeychain.with_temporary(
      create: proc do |name, password|
        created = created_before_failure || !fail_create
        events << ["create", name]
        passwords << password
        raise "create failed" if fail_create
      end,
      delete: proc { |name| events << ["delete", name] },
      exists: proc { |_name| created },
      security: security,
      path: proc { |name| "/keychains/#{name}-db" }
    ) do |name, password|
      events << ["yield", name]
      passwords << password
      during = search_list.dup
      raise "build failed" if fail_block

      "built"
    end
  rescue StandardError => e
    error = e.message
  end
  names = events.select { |event| event.length == 2 }.map(&:last).uniq
  { events: events.map(&:first), one_name: names.length == 1, name: names.first,
    passwords: passwords.uniq.length, password_hex: passwords.all? { |p| p.match?(/\\A\\h{64}\\z/) },
    search_during: during, search_after: search_list, result: result, error: error }
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
  const login = '/keychains/login.keychain-db';

  // Searched first while the block runs, then the search list is restored.
  expect(results.success).toMatchObject({
    events: ['create', 'search', 'yield', 'search', 'delete'],
    one_name: true,
    passwords: 1,
    password_hex: true,
    search_after: [login],
    result: 'built',
    error: null,
  });
  expect(results.success.name).toMatch(/^rn-sandbox-fastlane-\d+-[0-9a-f]{8}$/);
  expect(results.success.search_during).toEqual([
    `/keychains/${results.success.name}-db`,
    login,
  ]);

  expect(results.block_failure).toMatchObject({
    events: ['create', 'search', 'yield', 'search', 'delete'],
    one_name: true,
    search_after: [login],
    error: 'build failed',
  });
  expect(results.block_failure.name).not.toBe(results.success.name);

  // Nothing to delete, so the setup error isn't masked by a failed cleanup.
  expect(results.create_failure).toMatchObject({
    events: ['create', 'search'],
    search_after: [login],
    error: 'create failed',
  });
  expect(results.partial_create_failure).toMatchObject({
    events: ['create', 'search', 'delete'],
    one_name: true,
    search_after: [login],
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
