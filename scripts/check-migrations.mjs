#!/usr/bin/env node
// PR'da migration kurallarını denetler (CI: "Migration kuralları").
// Kullanım: node scripts/check-migrations.mjs <base-ref>   ör. origin/test
//  1. Var olan migration dosyaları değiştirilemez / silinemez / yeniden adlandırılamaz.
//  2. Dosya adı: YYYYMMDDHHMMSS_kisa_ad.sql
//  3. Yeni migration'ın zaman damgası, hedef daldaki en yeni migration'dan büyük olmalı
//     (aksi halde `supabase db push` uzak veritabanında sırasız migration'ı reddeder).
import { execFileSync } from 'node:child_process';

const base = process.argv[2];
if (!base) {
  console.error('Kullanım: node scripts/check-migrations.mjs <base-ref>');
  process.exit(2);
}

const DIR = 'supabase/migrations/';
const NAME = /^(\d{14})_[a-z0-9_]+\.sql$/;
const git = (...args) => execFileSync('git', args, { encoding: 'utf8' });

const changes = git(
  'diff',
  '--name-status',
  '--no-renames',
  `${base}...HEAD`,
  '--',
  DIR,
)
  .split('\n')
  .filter(Boolean)
  .map((line) => {
    const [status, file] = line.split('\t');
    return { status, file };
  });

const baseVersions = git('ls-tree', '--name-only', base, DIR)
  .split('\n')
  .filter(Boolean)
  .map((f) => f.slice(DIR.length).match(NAME)?.[1])
  .filter(Boolean)
  .sort();
const latest = baseVersions.at(-1) ?? '0';

const errors = [];
for (const { status, file } of changes) {
  const name = file.slice(DIR.length);
  if (status !== 'A') {
    errors.push(
      `${file}: mevcut migration ${status === 'D' ? 'silinmiş' : 'değiştirilmiş'}. Migration'lar değiştirilmez, yeni bir migration ekleyin.`,
    );
    continue;
  }
  const match = name.match(NAME);
  if (!match) {
    errors.push(
      `${file}: dosya adı YYYYMMDDHHMMSS_kisa_ad.sql formatında olmalı.`,
    );
    continue;
  }
  if (match[1] <= latest) {
    errors.push(
      `${file}: zaman damgası (${match[1]}) hedef daldaki en yeni migration'dan (${latest}) büyük olmalı. Dosyayı yeniden adlandırın.`,
    );
  }
}

if (errors.length) {
  for (const e of errors) console.error(`::error::${e}`);
  process.exit(1);
}
console.log(
  changes.length
    ? `✓ ${changes.length} yeni migration kurallara uygun (en yeni hedef: ${latest}).`
    : '✓ Migration değişikliği yok.',
);
