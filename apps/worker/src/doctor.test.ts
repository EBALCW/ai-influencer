// Duman testi: denetimi bu makinede gerçekten çalıştırır. CI'da (Linux, Windows) araçların çoğu
// yoktur; beklenen, komutun asılmadan bitmesi ve dürüst, kendi içinde tutarlı bir rapor vermesidir.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import os from 'node:os';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  CHECK_IDS,
  EXIT,
  WORKER_CAPABILITIES,
  deriveCapabilities,
} from './lib/capabilities.ts';
import type { DoctorReport } from './lib/report.ts';

const doctor = fileURLToPath(new URL('./doctor.ts', import.meta.url));

function runDoctor(args: string[]) {
  return spawnSync(process.execPath, [doctor, ...args], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    timeout: 240_000,
    // pnpm üzerinden çalışıyormuş gibi görünmesin: pnpm gerçekten aransın
    env: { ...process.env, npm_config_user_agent: '', NO_COLOR: '1' },
  });
}

test('--json: şemaya uyan, tutarlı ve ev klasörü içermeyen rapor', () => {
  const ran = runDoctor(['--json']);
  assert.equal(ran.error, undefined, 'denetim süresinde bitmeli');
  assert.ok(
    ran.status === EXIT.ok || ran.status === EXIT.nothing,
    `çıkış kodu ${ran.status}\n${ran.stderr}`,
  );
  const report = JSON.parse(ran.stdout) as DoctorReport;

  assert.equal(report.schemaVersion, 1);
  assert.deepEqual(
    report.checks.map((check) => check.id),
    [...CHECK_IDS],
  );
  for (const check of report.checks) {
    assert.ok(['ok', 'missing', 'outdated'].includes(check.status), check.id);
    // Eksik olan her şeyin yönergesi var; var olanın yok
    assert.equal(check.hint === null, check.status === 'ok', check.id);
  }
  // Bu test Node ile çalışıyor: Node denetimi onu bulmuş olmalı
  assert.equal(
    report.checks.find((check) => check.id === 'node')?.version,
    process.versions.node,
  );

  // Yetenekler denetimlerle tutarlı; çıkış kodu rapordaki `ok` ile tutarlı
  const derived = deriveCapabilities(report.checks);
  assert.deepEqual(report.capabilities, derived.available);
  assert.deepEqual(report.missingCapabilities, derived.unavailable);
  assert.equal(
    report.capabilities.length + report.missingCapabilities.length,
    WORKER_CAPABILITIES.length,
  );
  assert.equal(
    report.ok,
    report.routes.some((route) => route.ready),
  );
  assert.equal(ran.status, report.ok ? EXIT.ok : EXIT.nothing);

  assert.equal(report.system.platform, process.platform);
  assert.ok(report.system.cores >= 1);

  const home = os.homedir();
  if (home.length > 3)
    assert.ok(
      !ran.stdout
        .toLowerCase()
        .includes(JSON.stringify(home).slice(1, -1).toLowerCase()),
      'çıktıda ev klasörü olmamalı',
    );
});

test('tablo çıktısı ve --require çıkış kodları', () => {
  const table = runDoctor([]);
  assert.match(table.stdout, /Üretim makinesi denetimi/);
  assert.match(table.stdout, /Üretim yolları:/);
  assert.match(table.stdout, /^Node\.js\s+var\s/m);

  const report = JSON.parse(runDoctor(['--json']).stdout) as DoctorReport;
  const missing = report.missingCapabilities[0]?.key;
  if (missing)
    assert.equal(runDoctor(['--require', missing]).status, EXIT.requireMissing);
  const available = report.capabilities[0];
  if (available)
    assert.equal(runDoctor(['--require', available]).status, EXIT.ok);

  const usage = runDoctor(['--require', 'yok.boyle']);
  assert.equal(usage.status, EXIT.error);
  assert.match(usage.stderr, /Bilinmeyen yetenek/);
  assert.equal(runDoctor(['--help']).status, EXIT.ok);
});
