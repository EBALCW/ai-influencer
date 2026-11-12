import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { exportVideo, parseArgs } from './export.mjs';

test('CLI hatalı veya çakışan yolları ve bilinmeyen seçenekleri reddeder', () => {
  for (const args of [
    [],
    ['input.mp4'],
    ['same.mp4', 'same.mp4'],
    ['input.mp4', 'output.mov'],
    ['input.mp4', 'output.mp4', '--overwrite'],
    ['input.mp4', 'output.mp4', '--mute', '--mute'],
  ])
    assert.throws(() => parseArgs(args));
  assert.deepEqual(parseArgs(['girdi boşluk.mp4', 'çıktı.mp4', '--mute']), {
    input: resolve('girdi boşluk.mp4'),
    output: resolve('çıktı.mp4'),
    mute: true,
  });
});

test('mevcut çıktı kaynak okunmadan veya ffmpeg çağrılmadan korunur', async (t) => {
  const dir = await mkdtemp(join(tmpdir(), 'export-existing-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const input = join(dir, 'input.mp4');
  const output = join(dir, 'output.mp4');
  await writeFile(input, 'kaynak');
  await writeFile(output, 'önceki çıktı');
  await assert.rejects(exportVideo({ input, output }), /Çıktı zaten var/);
  assert.equal(await readFile(output, 'utf8'), 'önceki çıktı');
});

const mediaTools = ['ffmpeg', 'ffprobe'].every(
  (tool) => spawnSync(tool, ['-version']).status === 0,
);
test(
  'gerçek FFmpeg: geometri, ses, sessiz çıktı ve yarım dosya temizliği',
  {
    skip:
      !mediaTools &&
      'FFmpeg/ffprobe yok; medya entegrasyonu yerelde çalıştırılmalı.',
  },
  async (t) => {
    const dir = await mkdtemp(join(tmpdir(), 'export medya boşluk-'));
    t.after(() => rm(dir, { recursive: true, force: true }));
    const input = join(dir, 'kaynak.mp4');
    const made = spawnSync('ffmpeg', [
      '-v',
      'error',
      '-f',
      'lavfi',
      '-i',
      'color=c=blue:s=320x240:r=24',
      '-f',
      'lavfi',
      '-i',
      'sine=frequency=440',
      '-t',
      '0.2',
      '-c:v',
      'libx264',
      '-pix_fmt',
      'yuv420p',
      '-c:a',
      'aac',
      input,
    ]);
    assert.equal(made.status, 0, made.stderr?.toString());
    for (const mute of [false, true]) {
      const output = join(dir, mute ? 'sessiz.mp4' : 'sesli.mp4');
      await exportVideo({ input, output, mute });
      const probe = spawnSync('ffprobe', [
        '-v',
        'error',
        '-show_streams',
        '-of',
        'json',
        output,
      ]);
      assert.equal(probe.status, 0);
      const streams = JSON.parse(probe.stdout).streams;
      const video = streams.find((stream) => stream.codec_type === 'video');
      assert.equal(video.codec_name, 'h264');
      assert.equal(video.width, 1080);
      assert.equal(video.height, 1920);
      assert.equal(video.sample_aspect_ratio, '1:1');
      assert.equal(video.r_frame_rate, '30/1');
      assert.equal(video.pix_fmt, 'yuv420p');
      assert.equal(
        streams.some((stream) => stream.codec_type === 'audio'),
        !mute,
      );
    }
    const invalid = join(dir, 'bozuk.mp4');
    const output = join(dir, 'yarım.mp4');
    await writeFile(invalid, 'video değil');
    await assert.rejects(
      exportVideo({ input: invalid, output }),
      /Export başarısız/,
    );
    assert.equal(
      (await readdir(dir)).some((name) => name.startsWith('.video-export-')),
      false,
    );
    await assert.rejects(readFile(output), { code: 'ENOENT' });
    assert.ok((await readFile(input)).length > 0);
  },
);
