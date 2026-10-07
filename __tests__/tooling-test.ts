import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const repoRoot = resolve(__dirname, '..');

test('Wrangler local Images binding decodes SVG and transforms it to PNG', () => {
  const output = execFileSync(
    process.execPath,
    [join(repoRoot, 'scripts/checks/checkWranglerImages.mjs')],
    { cwd: repoRoot, encoding: 'utf8', timeout: 30_000 },
  );
  expect(JSON.parse(output.trim())).toEqual({
    width: 8,
    height: 6,
    channels: 3,
  });
}, 35_000);

test.each([
  ['toml', 'default = false\n[MD013]\nline_length = 8\n'],
  ['yaml', 'default: false\nMD013:\n  line_length: 8\n'],
])('Markdown CLI applies its %s configuration', (extension, config) => {
  const directory = mkdtempSync(join(tmpdir(), 'rn-sandbox-markdown-'));
  try {
    const configPath = join(directory, `config.${extension}`);
    const document = join(directory, 'fixture.md');
    writeFileSync(configPath, config);
    writeFileSync(document, 'This exceeds the configured length.\n');
    const result = spawnSync(
      process.execPath,
      [
        join(repoRoot, 'node_modules/markdownlint-cli/markdownlint.js'),
        '--config',
        configPath,
        document,
      ],
      { cwd: directory, encoding: 'utf8', timeout: 10_000 },
    );
    expect(result.error).toBeUndefined();
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('MD013/line-length');
    expect(result.stderr).toContain('Expected: 8');
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
