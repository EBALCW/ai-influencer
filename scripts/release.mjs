#!/usr/bin/env node
// test → main release PR'ını açar ya da yeniler. Kullanım: pnpm release
//
// Neden script: Bot (GITHUB_TOKEN) test'e merge ettiğinde açık release PR'ı pull_request olayı
// almaz; GitHub, bot'un tetiklediği CI'ı PR'ın zorunlu kontrollerine de bağlamaz. Release PR'ını
// bir insanın/agent'ın kendi gh hesabıyla açması/yenilemesi gerekir. CI geçince auto-merge
// release'i merge eder → Deploy · production.
import { execFileSync } from 'node:child_process';

const isWin = process.platform === 'win32';
const gh = (...args) =>
  execFileSync('gh', args, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: isWin,
  }).trim();
const fail = (msg) => {
  console.error(`\n✗ ${msg}\n`);
  process.exit(1);
};

try {
  gh('auth', 'status');
} catch {
  fail('GitHub girişi yok: gh auth login --web --git-protocol https');
}

const compare = JSON.parse(
  gh(
    'api',
    'repos/{owner}/{repo}/compare/main...test',
    '--jq',
    '{ahead: .ahead_by}',
  ),
);
if (compare.ahead === 0) {
  console.log('✓ test, main ile aynı. Release edilecek bir şey yok.');
  process.exit(0);
}

// main'de olmayan, test'e merge edilmiş PR'lar (release notları için)
const prs = JSON.parse(
  gh(
    'api',
    'repos/{owner}/{repo}/compare/main...test',
    '--jq',
    '[.commits[].commit.message | capture("\\\\(#(?<n>[0-9]+)\\\\)") | .n] | unique',
  ),
);
const lines = [];
for (const n of prs) {
  try {
    const pr = JSON.parse(
      gh('pr', 'view', n, '--json', 'number,title,author,baseRefName'),
    );
    if (pr.baseRefName === 'test')
      lines.push(`- #${pr.number} ${pr.title} (@${pr.author.login})`);
  } catch {
    // issue numarası ya da silinmiş PR
  }
}
const body = [
  'test → main release (`pnpm release`).',
  '',
  lines.length
    ? lines.join('\n')
    : '- (PR listesi çıkarılamadı, commit geçmişine bakın)',
  '',
  "CI geçince otomatik merge edilir → **Deploy · production** (migration'lar, GitHub Release, test'e geri senkron).",
].join('\n');

const existing = gh(
  'pr',
  'list',
  '--base',
  'main',
  '--head',
  'test',
  '--state',
  'open',
  '--json',
  'number',
  '--jq',
  '.[0].number',
);
if (existing) {
  gh('pr', 'edit', existing, '--body', body);
  // Kendi hesabınla kapat/aç → pull_request olayı → CI yeni test içeriğiyle çalışır
  gh('pr', 'close', existing);
  gh('pr', 'reopen', existing);
  console.log(
    `✓ Release PR #${existing} yenilendi, CI başladı (${lines.length} PR).`,
  );
} else {
  const today = new Date().toISOString().slice(0, 10);
  const url = gh(
    'pr',
    'create',
    '--base',
    'main',
    '--head',
    'test',
    '--title',
    `Release ${today}`,
    '--body',
    body,
  );
  console.log(`✓ Release PR açıldı: ${url} (${lines.length} PR).`);
}
console.log(
  '  CI yeşil olunca otomatik merge edilir. Takip: gh pr checks <no> --watch',
);
