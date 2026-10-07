import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import test from 'node:test';

const require = createRequire(import.meta.url);
const cli = require.resolve('markdownlint-cli');
const markdownlint = createRequire(cli);

test('Markdown CLI resolves the fixed TOML parser', () => {
  const version = JSON.parse(
    readFileSync(
      join(dirname(dirname(markdownlint.resolve('smol-toml'))), 'package.json'),
    ),
  ).version;
  assert.equal(version, '1.9.0');
});

function fixture(t, config, markdown = '# Good\n') {
  const directory = mkdtempSync(join(tmpdir(), 'rn-markdownlint-'));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  mkdirSync(join(directory, 'docs'));
  writeFileSync(join(directory, 'docs/good.md'), markdown);
  writeFileSync(join(directory, 'config.toml'), config);
  return directory;
}

function lint(directory, config = 'config.toml', files = ['docs/*.md']) {
  const result = spawnSync(
    process.execPath,
    [cli, '--config', config, ...files],
    {
      cwd: directory,
      encoding: 'utf8',
      timeout: 20_000,
    },
  );
  assert.ifError(result.error);
  return { status: result.status, output: result.stdout + result.stderr };
}

test('TOML nested options enforce prose limits while exempting headings', (t) => {
  const directory = fixture(
    t,
    `default = false
[MD013]
line_length = 12
headings = false
code_blocks = false
`,
    '# Heading is exempt\n\nThis paragraph exceeds twelve columns.\n',
  );
  const result = lint(directory);
  assert.equal(result.status, 1, result.output);
  assert.match(result.output, /MD013\/line-length/);
  assert.match(result.output, /good\.md:3/);
  assert.doesNotMatch(result.output, /good\.md:1/);
});

test('TOML nested options accept prose inside the configured limit', (t) => {
  const directory = fixture(
    t,
    'default = false\n[MD013]\nline_length = 12\n',
    'Short prose\n',
  );
  assert.equal(lint(directory).status, 0);
});

test('TOML enabled=false preserves an explicit disabled rule', (t) => {
  const directory = fixture(
    t,
    'default = false\n[MD018]\nenabled = false\n',
    '#Missing space\n',
  );
  assert.equal(lint(directory).status, 0);
});

test('TOML severity retains the same behavior as JSON options', (t) => {
  const directory = fixture(
    t,
    'default = false\n[MD018]\nseverity = "warning"\n',
    '#Missing space\n',
  );
  writeFileSync(
    join(directory, 'config.json'),
    JSON.stringify({ default: false, MD018: { severity: 'warning' } }),
  );
  const toml = lint(directory);
  const ordinary = lint(directory, 'config.json');
  assert.match(ordinary.output, /MD018\/no-missing-space-atx/);
  assert.deepEqual(toml, ordinary);
});

test('TOML default=false leaves unrelated rules disabled', (t) => {
  const directory = fixture(
    t,
    'default = false\nMD018 = true\n',
    'Plain text\n',
  );
  assert.equal(lint(directory).status, 0);
  writeFileSync(join(directory, 'docs/good.md'), '#Missing space\n');
  const result = lint(directory);
  assert.equal(result.status, 1, result.output);
  assert.match(result.output, /MD018\/no-missing-space-atx/);
});

test('YAML and JSON nested rules keep their existing behavior', (t) => {
  const directory = fixture(t, '', 'Prose exceeds twelve columns.\n');
  writeFileSync(
    join(directory, 'config.yaml'),
    'default: false\nMD013:\n  line_length: 12\n',
  );
  writeFileSync(
    join(directory, 'config.json'),
    JSON.stringify({ default: false, MD013: { line_length: 12 } }),
  );
  const yaml = lint(directory, 'config.yaml');
  const ordinary = lint(directory, 'config.json');
  assert.equal(yaml.status, 1, yaml.output);
  assert.match(yaml.output, /MD013\/line-length/);
  assert.deepEqual(yaml, ordinary);
});

test('TOML extends preserves JSON inheritance and explicit nested options', (t) => {
  const directory = fixture(
    t,
    'extends = "base.toml"\n[MD013]\nline_length = 12\nheadings = false\n',
    '# Heading is exempt\n\nThis paragraph exceeds twelve columns.\n',
  );
  writeFileSync(
    join(directory, 'base.toml'),
    'default = false\nMD018 = true\n',
  );
  writeFileSync(
    join(directory, 'base.json'),
    JSON.stringify({ default: false, MD018: true }),
  );
  writeFileSync(
    join(directory, 'config.json'),
    JSON.stringify({
      extends: 'base.json',
      MD013: { line_length: 12, headings: false },
    }),
  );
  const result = lint(directory);
  assert.equal(result.status, 1, result.output);
  assert.match(result.output, /MD013\/line-length/);
  assert.match(result.output, /good\.md:3/);
  assert.doesNotMatch(result.output, /good\.md:1/);
  assert.deepEqual(result, lint(directory, 'config.json'));
});

test('configuration rejected by every parser remains a fatal error', (t) => {
  const directory = fixture(t, '[invalid\n');
  const result = lint(directory);
  assert.notEqual(result.status, 0, result.output);
  assert.match(result.output, /Cannot read or parse config file/);
});

test('JavaScript class options retain their existing CLI behavior', (t) => {
  const directory = fixture(t, '', 'Prose exceeds twelve columns.\n');
  writeFileSync(
    join(directory, 'config.cjs'),
    `class RuleOptions {
  constructor() { this.line_length = 12; }
}
module.exports = { default: false, MD013: new RuleOptions() };
`,
  );
  const result = lint(directory, 'config.cjs');
  assert.equal(result.status, 1, result.output);
  assert.match(result.output, /MD013\/line-length/);
});

test('the CLI handles many flat TOML keys through the fixed parser', (t) => {
  const keys = Array.from({ length: 32_768 }, (_, index) => `key_${index} = 1`);
  const directory = fixture(
    t,
    `${keys.join('\n')}\ndefault = false\nMD018 = true\n`,
  );
  assert.equal(lint(directory).status, 0);
});
