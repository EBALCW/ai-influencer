#!/usr/bin/env node
// `supabase db diff --linked` çıktısını değerlendirir (Deploy → sapma kontrolü).
// Kullanım: node scripts/check-drift.mjs drift.sql
// Supabase platformunun kendi oluşturduğu nesneler (supabase/drift-ignore.json) çıkarıldıktan sonra
// geriye herhangi bir SQL ifadesi kalırsa, veritabanı migration dışından değiştirilmiştir → exit 1.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const file = process.argv[2];
if (!file) {
  console.error('Kullanım: node scripts/check-drift.mjs <diff.sql>');
  process.exit(2);
}
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const ignore = JSON.parse(
  readFileSync(join(root, 'supabase/drift-ignore.json'), 'utf8'),
);
const ignoredFunctions = (ignore.functions ?? []).map((f) => f.toLowerCase());

// İfadeleri ayır: dollar-quoted gövdelerin ($function$ ... $function$) içindeki ';' bölmesin
function splitStatements(sql) {
  const out = [];
  let buf = '';
  let dollar = null;
  for (let i = 0; i < sql.length; i++) {
    const rest = sql.slice(i);
    const tag = rest.match(/^\$[A-Za-z_]*\$/)?.[0];
    if (tag) {
      if (dollar === null) dollar = tag;
      else if (dollar === tag) dollar = null;
      buf += tag;
      i += tag.length - 1;
      continue;
    }
    const ch = sql[i];
    buf += ch;
    if (ch === ';' && dollar === null) {
      out.push(buf.trim());
      buf = '';
    }
  }
  if (buf.trim()) out.push(buf.trim());
  return out;
}

const stripComments = (s) =>
  s
    .split('\n')
    .filter((l) => !/^\s*--/.test(l))
    .join('\n')
    .trim();

const statements = splitStatements(readFileSync(file, 'utf8'))
  .map(stripComments)
  .filter(Boolean);

const isNoise = (s) => /^set\s+check_function_bodies\s*=\s*off\s*;?$/i.test(s);
const isIgnored = (s) => {
  const lower = s.toLowerCase().replace(/"/g, '');
  return ignoredFunctions.some((fn) => {
    const name = fn.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(`function\\s+${name}\\s*\\(`).test(lower);
  });
};

const ignored = statements.filter((s) => !isNoise(s) && isIgnored(s));
const drift = statements.filter((s) => !isNoise(s) && !isIgnored(s));

if (ignored.length) {
  console.log(
    `Platform nesnesi olarak yok sayıldı (${ignored.length}): ${ignoredFunctions.join(', ')}`,
  );
}
if (drift.length) {
  console.error(
    "::error::Uzak veritabanında migration dışı şema değişikliği var. Değişikliği bir migration'a çevirin veya geri alın:",
  );
  for (const s of drift) console.error(`\n${s}`);
  process.exit(1);
}
console.log('✓ Sapma yok.');
