import { spawnSync } from 'node:child_process';
import { writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const pnpmExecPath = process.env.npm_execpath;
const command = pnpmExecPath
  ? process.execPath
  : process.platform === 'win32'
    ? 'pnpm.cmd'
    : 'pnpm';
const args = pnpmExecPath
  ? [pnpmExecPath, 'exec', 'supabase', 'gen', 'types', 'typescript', '--local']
  : ['exec', 'supabase', 'gen', 'types', 'typescript', '--local'];

const result = spawnSync(command, args, {
  cwd: repositoryRoot,
  encoding: 'utf8',
  maxBuffer: 5 * 1024 * 1024,
  shell: !pnpmExecPath && process.platform === 'win32',
});

if (result.error) {
  throw result.error;
}

if (result.status !== 0) {
  process.stderr.write(result.stderr ?? '');
  process.exit(result.status ?? 1);
}

if (!result.stdout.includes('export type Database')) {
  throw new Error(
    'Supabase CLI did not return a Database type. Is the local database running?',
  );
}

const outputPath = resolve(
  repositoryRoot,
  'packages/shared/src/database.types.ts',
);
await writeFile(
  outputPath,
  result.stdout.endsWith('\n') ? result.stdout : `${result.stdout}\n`,
  'utf8',
);
process.stdout.write(`Supabase types written to ${outputPath}\n`);
