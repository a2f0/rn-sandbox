import { execFileSync } from 'node:child_process';
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
