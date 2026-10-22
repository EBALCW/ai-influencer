#!/usr/bin/env node
// Repo kod haritası: sayfalar, API route'ları, lib export'ları, migration nesneleri,
// Edge Function'lar ve testler. Agent'lar işe başlarken bunu okuyup dosya taramasını kısaltır.
//
//   pnpm codemap                 → Markdown, stdout
//   pnpm codemap --out <dosya>   → dosyaya yaz (ör. .cache/CODEMAP.md, git'e girmez)
//   pnpm codemap --section db    → tek bölüm: pages | api | lib | db | functions | tests
//
// Üretilen çıktı commit'lenmez: her zaman koddan güncel üretilir, paralel PR'larda çakışmaz.
import {
  mkdirSync,
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  countTests,
  exportedNames,
  routeFromAppPath,
  routeMethods,
  sqlObjects,
} from './lib/codemap-lib.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const rel = (p) => relative(root, p).split(sep).join('/');
const read = (p) => readFileSync(p, 'utf8');

function walk(dir, filter, out = []) {
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return out;
  }
  for (const name of entries.sort()) {
    if (name === 'node_modules' || name === '.next' || name.startsWith('.'))
      continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, filter, out);
    else if (filter(p)) out.push(p);
  }
  return out;
}

const isTest = (p) => /\.(test|spec)\.(ts|tsx|mjs)$/.test(p);
const list = (xs, max = 12) =>
  xs.length > max
    ? `${xs.slice(0, max).join(', ')}, … (+${xs.length - max})`
    : xs.join(', ');

const appDir = join(root, 'apps/panel/src/app');

function pages() {
  const files = walk(appDir, (p) => /[\\/]page\.tsx$/.test(p));
  const lines = files.map((f) => {
    const r = routeFromAppPath(relative(appDir, f));
    return `- \`${r}\` → ${rel(f)}`;
  });
  return ['## Sayfalar (apps/panel)', '', ...lines];
}

function api() {
  const files = walk(appDir, (p) => /[\\/]route\.ts$/.test(p));
  const lines = files.map((f) => {
    const r = routeFromAppPath(relative(appDir, f));
    const m = routeMethods(read(f));
    return `- \`${m.join('|') || '?'} ${r}\` → ${rel(f)}`;
  });
  return ["## API route'ları", '', ...lines];
}

function lib() {
  const dirs = [
    'apps/panel/src/lib',
    'apps/panel/src/components',
    'packages/shared/src',
  ];
  const lines = [];
  for (const d of dirs) {
    const files = walk(
      join(root, d),
      (p) =>
        /\.(ts|tsx)$/.test(p) && !isTest(p) && !p.endsWith('database.types.ts'),
    );
    lines.push('', `### ${d}`, '');
    for (const f of files) {
      const names = exportedNames(read(f));
      lines.push(
        `- ${rel(f).slice(d.length + 1)}: ${names.length ? list(names) : '—'}`,
      );
    }
  }
  return ["## Modüller ve export'lar", ...lines];
}

function db() {
  const migDir = join(root, 'supabase/migrations');
  const files = walk(migDir, (p) => p.endsWith('.sql'));
  const lines = files.map((f) => {
    const objs = sqlObjects(read(f));
    const parts = Object.entries(objs).map(([k, v]) => `${k}: ${list(v, 8)}`);
    return `- **${rel(f).replace('supabase/migrations/', '')}** — ${parts.join(' · ') || '—'}`;
  });
  // Ters indeks: tablo → onu oluşturan migration
  const tables = [];
  for (const f of files) {
    for (const t of sqlObjects(read(f)).table ?? []) {
      tables.push(
        `${t} (${rel(f).replace('supabase/migrations/', '').slice(0, 14)})`,
      );
    }
  }
  return [
    '## Veritabanı (supabase/migrations, sırayla)',
    '',
    `Tablolar: ${tables.join(', ')}`,
    '',
    ...lines,
    '',
    'Tipler: `packages/shared/src/database.types.ts` (üretilmiş, CI farkı denetler).',
  ];
}

function functions() {
  const fnDir = join(root, 'supabase/functions');
  const files = walk(fnDir, (p) => p.endsWith('.ts') && !isTest(p));
  const lines = files.map((f) => {
    const names = exportedNames(read(f));
    return `- ${rel(f).replace('supabase/functions/', '')}: ${names.length ? list(names) : '(giriş noktası)'}`;
  });
  return [
    '## Edge Functions (supabase/functions, Deno)',
    '',
    ...(lines.length ? lines : ['- (yok)']),
  ];
}

function tests() {
  const groups = [
    [
      'Vitest (apps/panel, packages)',
      ['apps/panel/src', 'packages/shared/src'],
      (p) => /\.test\.tsx?$/.test(p),
    ],
    [
      'Playwright (apps/panel/e2e)',
      ['apps/panel/e2e'],
      (p) => /\.spec\.ts$/.test(p),
    ],
    ['pgTAP (supabase/tests)', ['supabase/tests'], (p) => p.endsWith('.sql')],
    [
      'Deno (supabase/functions)',
      ['supabase/functions'],
      (p) => /\.test\.ts$/.test(p),
    ],
    ['node:test (scripts)', ['scripts'], (p) => p.endsWith('.test.mjs')],
  ];
  const lines = [];
  for (const [title, dirs, filter] of groups) {
    const files = dirs.flatMap((d) => walk(join(root, d), filter));
    const total = files.reduce((s, f) => s + countTests(read(f)), 0);
    lines.push('', `### ${title} — ${files.length} dosya, ~${total} test`, '');
    for (const f of files) lines.push(`- ${rel(f)}`);
  }
  return ['## Testler', ...lines];
}

const SECTIONS = { pages, api, lib, db, functions, tests };

function main(argv) {
  const outIdx = argv.indexOf('--out');
  const secIdx = argv.indexOf('--section');
  const only = secIdx >= 0 ? argv[secIdx + 1] : null;
  if (only && !SECTIONS[only]) {
    console.error(
      `Bilinmeyen bölüm: ${only}. Seçenekler: ${Object.keys(SECTIONS).join(', ')}`,
    );
    process.exit(1);
  }
  const chosen = only ? [only] : Object.keys(SECTIONS);
  const body = [
    '# Kod haritası (otomatik, `pnpm codemap`)',
    '',
    'Elle düzenleme; koddan üretilir. Kurallar: AGENTS.md, docs/DEVELOPMENT.md.',
    '',
    ...chosen.flatMap((k) => [...SECTIONS[k](), '']),
  ].join('\n');
  if (outIdx >= 0) {
    const out = join(process.cwd(), argv[outIdx + 1]);
    mkdirSync(dirname(out), { recursive: true });
    writeFileSync(out, body);
    console.log(`✓ ${relative(process.cwd(), out)} yazıldı`);
  } else {
    process.stdout.write(body);
  }
}

// `pnpm codemap | head` gibi kullanımda boru kapanınca sessizce çık
process.stdout.on('error', (err) => {
  if (err.code === 'EPIPE') process.exit(0);
  throw err;
});

main(process.argv.slice(2));
