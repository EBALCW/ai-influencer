import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { compareAutomation } from './automation-cost.mjs';

test('CLI eksik/bozuk dosyada özel içeriği loglamaz; boş dosyada eksik rapor verir', async (t) => {
  const dir = await mkdtemp(join(tmpdir(), 'automation-private-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const script = fileURLToPath(
    new URL('../automation-cost.mjs', import.meta.url),
  );
  const input = join(dir, 'private-example.json');
  for (const content of ['{"private-marker":', '[]']) {
    await writeFile(input, content);
    const result = spawnSync(process.execPath, [script, input], {
      encoding: 'utf8',
    });
    if (content === '[]') {
      assert.equal(result.status, 0);
      assert.equal(JSON.parse(result.stdout).measurement_complete, false);
    } else {
      assert.equal(result.status, 1);
      assert.equal(result.stderr.includes('private-marker'), false);
      assert.equal(result.stderr.includes(input), false);
    }
  }
  const missing = spawnSync(
    process.execPath,
    [script, join(dir, 'not-there.json')],
    { encoding: 'utf8' },
  );
  assert.equal(missing.status, 1);
  assert.equal(missing.stderr.includes(dir), false);
});

const run = (changes = {}) => ({
  id: 'trial-1',
  scenario: 'image',
  method: 'manual',
  setup_id: 'setup-a',
  billing: 'higgsfield_subscription',
  model: 'test-model',
  assistant_model: null,
  status: 'succeeded',
  qc: 'passed',
  quality: 4,
  credits: '2.5',
  generation_usd: '0.1',
  assistant_usd: '0',
  minutes: '3',
  ...changes,
});

test('başarısız ve QC kaybı dahil tüm denemeler kullanılabilir çıktıya dağıtılır', () => {
  const rows = [
    run(),
    run({ id: 'trial-2', status: 'failed', qc: 'not_reviewed', quality: null }),
    run({ id: 'trial-3', qc: 'failed', quality: 1 }),
  ];
  const { groups, measurement_complete } = compareAutomation(rows);
  const first = groups[0];
  assert.equal(first.total_usd, '0.300000'); // 0.1 + 0.1 + 0.1 tam ondalık.
  assert.equal(first.credits_per_usable_output, '7.500000');
  assert.equal(first.usd_per_usable_output, '0.300000');
  assert.equal(first.failed_usd, '0.100000');
  assert.equal(first.technical_failure_percent, '33.33');
  assert.equal(first.qc_failed, 1);
  assert.equal(measurement_complete, false);
});

test('boş, eksik fiyat, sıfır başarılı çıktı ve altı hücre tamlığı', () => {
  const empty = compareAutomation([]);
  assert.equal(empty.measurement_complete, false);
  assert.ok(
    empty.groups.every(
      (group) => group.total_usd === null && group.credits === null,
    ),
  );
  const missing = compareAutomation([
    run({ generation_usd: null, qc: 'not_reviewed', quality: null }),
  ]).groups[0];
  assert.equal(missing.total_usd, null);
  assert.equal(missing.usd_per_usable_output, null);
  assert.equal(missing.pending_qc, 1);
  const all = ['image', 'image_to_video', 'video_to_video'].flatMap(
    (scenario) =>
      ['manual', 'mcp'].map((method) =>
        run({
          id: `${scenario}-${method}`,
          scenario,
          method,
          assistant_model: method === 'mcp' ? 'test-assistant' : null,
        }),
      ),
  );
  assert.equal(compareAutomation(all).measurement_complete, true);
  const failed = compareAutomation([
    run({
      status: 'failed',
      qc: 'not_reviewed',
      quality: null,
      credits: '0',
      generation_usd: '0',
    }),
  ]).groups[0];
  assert.equal(failed.total_usd, '0.000000');
  assert.equal(failed.credits_per_usable_output, null);
});

test('yinelenen deneme, eşleşmeyen ayar/model ve geçersiz ölçümler reddedilir', () => {
  assert.throws(() => compareAutomation([run(), run()]), /kimliği/);
  for (const changes of [{ setup_id: 'different' }, { model: 'different' }])
    assert.throws(
      () => compareAutomation([run(), run({ id: 'other', ...changes })]),
      /eşleşmeli/,
    );
  for (const changes of [
    { credits: '-1' },
    { generation_usd: 'NaN' },
    { assistant_usd: '1e3' },
    { generation_usd: 0.1 },
    { credits: '0.0000001' },
    { minutes: '-2' },
    { quality: 6 },
    { quality: null },
    { method: 'api' },
    { billing: 'cloud_api' },
    { status: 'failed' },
    { method: 'mcp', assistant_model: null },
  ])
    assert.throws(() => compareAutomation([run(changes)]));
});
