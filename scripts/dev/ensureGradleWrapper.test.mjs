import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { crc32 } from 'node:zlib';

const script = join(import.meta.dirname, 'ensureGradleWrapper.sh');

// A complete zip holding one stored file, standing in for the wrapper jar.
function zip() {
  const name = Buffer.from('a.txt');
  const data = Buffer.from('wrapper\n');
  const crc = crc32(data);
  const local = Buffer.alloc(30);
  local.writeUInt32LE(0x04034b50, 0);
  local.writeUInt16LE(10, 4);
  local.writeUInt32LE(crc, 14);
  local.writeUInt32LE(data.length, 18);
  local.writeUInt32LE(data.length, 22);
  local.writeUInt16LE(name.length, 26);
  const central = Buffer.alloc(46);
  central.writeUInt32LE(0x02014b50, 0);
  central.writeUInt16LE(10, 4);
  central.writeUInt16LE(10, 6);
  central.writeUInt32LE(crc, 16);
  central.writeUInt32LE(data.length, 20);
  central.writeUInt32LE(data.length, 24);
  central.writeUInt16LE(name.length, 28);
  const centralOffset = local.length + name.length + data.length;
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(1, 8);
  end.writeUInt16LE(1, 10);
  end.writeUInt32LE(central.length + name.length, 12);
  end.writeUInt32LE(centralOffset, 16);
  return Buffer.concat([local, name, data, central, name, end]);
}

const jar = zip();

// The script in a stand-in repository, with a fake Gradle that writes the jar
// and a cp that copies only its first ten bytes and fails, as an interrupted
// copy would. PATH holds only these and the system tools the script uses, by
// absolute path.
function setUp(t, { cp = '/usr/bin/head -c 10 "$1" >"$2"; exit 1' } = {}) {
  const root = mkdtempSync(join(tmpdir(), 'gradle-wrapper-test-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const bin = join(root, 'bin');
  const temp = join(root, 'tmp');
  const repo = join(root, 'repo');
  const wrapperDir = join(repo, 'android/gradle/wrapper');
  for (const dir of [bin, temp, join(repo, 'scripts/dev'), wrapperDir]) {
    mkdirSync(dir, { recursive: true });
  }
  copyFileSync(script, join(repo, 'scripts/dev/ensureGradleWrapper.sh'));
  const source = join(root, 'source.jar');
  writeFileSync(source, jar);
  const fakes = {
    gradle: `/bin/mkdir -p "$2/gradle/wrapper" && /bin/cp "${source}" "$2/gradle/wrapper/gradle-wrapper.jar"`,
    cp,
  };
  for (const [name, body] of Object.entries(fakes)) {
    writeFileSync(join(bin, name), `#!/bin/sh\n${body}\n`, { mode: 0o755 });
  }
  for (const tool of ['dirname', 'mktemp', 'mv', 'rm', 'unzip']) {
    const path = ['/usr/bin', '/bin']
      .map((dir) => join(dir, tool))
      .find(existsSync);
    symlinkSync(path, join(bin, tool));
  }
  const run = () =>
    spawnSync('/bin/sh', [join(repo, 'scripts/dev/ensureGradleWrapper.sh')], {
      encoding: 'utf8',
      env: { PATH: bin, HOME: root, TMPDIR: temp },
    });
  return {
    run,
    wrapperDir,
    wrapperJar: join(wrapperDir, 'gradle-wrapper.jar'),
  };
}

test('leaves no partial jar when the copy fails', (t) => {
  const { run, wrapperDir } = setUp(t);

  const result = run();

  assert.notEqual(result.status, 0, result.stderr);
  assert.deepEqual(readdirSync(wrapperDir), []);
});

test('installs the generated jar', (t) => {
  const { run, wrapperDir, wrapperJar } = setUp(t, { cp: '/bin/cp "$@"' });

  const result = run();

  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(readdirSync(wrapperDir), ['gradle-wrapper.jar']);
  assert.deepEqual(readFileSync(wrapperJar), jar);
});

test('regenerates a truncated jar', (t) => {
  const { run, wrapperDir, wrapperJar } = setUp(t, { cp: '/bin/cp "$@"' });
  writeFileSync(wrapperJar, jar.subarray(0, 10));

  const result = run();

  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(readdirSync(wrapperDir), ['gradle-wrapper.jar']);
  assert.deepEqual(readFileSync(wrapperJar), jar);
});

test('keeps a complete jar without running Gradle', (t) => {
  const { run, wrapperJar } = setUp(t, { cp: 'exit 1' });
  writeFileSync(wrapperJar, jar);

  const result = run();

  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout, '');
  assert.deepEqual(readFileSync(wrapperJar), jar);
});
