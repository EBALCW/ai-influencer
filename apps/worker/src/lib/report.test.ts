import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  CHECK_IDS,
  CHECK_LABELS,
  EXIT,
  OPTIONAL_CHECKS,
  type CheckId,
  type CheckResult,
} from './capabilities.ts';
import {
  UsageError,
  buildReport,
  formatReport,
  parseArgs,
  parseGpuLines,
  parseLspciGpu,
  parseMacGpu,
  redactReport,
  reportExitCode,
  type SystemInfo,
} from './report.ts';

const system: SystemInfo = {
  platform: 'win32',
  arch: 'x64',
  osRelease: '10.0.26100',
  cpu: 'AMD Ryzen 7 5800X',
  cores: 16,
  memoryGb: 32,
  gpu: ['NVIDIA GeForce RTX 3060'],
  diskFreeGb: 6,
  diskLow: true,
};

function fakeChecks(
  overrides: Partial<Record<CheckId, Partial<CheckResult>>> = {},
): CheckResult[] {
  return CHECK_IDS.map((id) => ({
    id,
    label: CHECK_LABELS[id],
    status: 'ok',
    version: '1.0.0',
    path: `C:\\Users\\Ayse\\tools\\${id}.exe`,
    required: null,
    optional: OPTIONAL_CHECKS.includes(id),
    detail: null,
    hint: null,
    ...overrides[id],
  }));
}

test('parseArgs', () => {
  assert.deepEqual(parseArgs([]), { json: false, help: false, require: [] });
  assert.deepEqual(
    parseArgs(['--json', '--require', 'clip.cut, fetch.youtube']),
    {
      json: true,
      help: false,
      require: ['clip.cut', 'fetch.youtube'],
    },
  );
  assert.deepEqual(parseArgs(['--require=render.skia,render.skia']).require, [
    'render.skia',
  ]);
  // pnpm, script'e araya `--` koyarak argüman geçirebilir
  assert.equal(parseArgs(['--', '--json']).json, true);
  assert.equal(parseArgs(['-h']).help, true);
  assert.throws(() => parseArgs(['--require']), UsageError);
  assert.throws(() => parseArgs(['--require', '--json']), UsageError);
  assert.throws(
    () => parseArgs(['--require', 'render.unity']),
    /Bilinmeyen yetenek/,
  );
  assert.throws(() => parseArgs(['--install']), /Bilinmeyen argüman/);
});

test('GPU ayrıştırıcıları', () => {
  assert.deepEqual(
    parseMacGpu(
      JSON.stringify({
        SPDisplaysDataType: [
          { _name: 'kHW_AppleM4Item', sppci_model: 'Apple M4' },
        ],
      }),
    ),
    ['Apple M4'],
  );
  assert.deepEqual(parseMacGpu('bozuk'), []);
  assert.deepEqual(
    parseGpuLines(
      'NVIDIA GeForce RTX 3060\r\nIntel(R) UHD Graphics 770\r\n\r\n',
    ),
    ['NVIDIA GeForce RTX 3060', 'Intel(R) UHD Graphics 770'],
  );
  assert.deepEqual(parseGpuLines('Name\r\n----\r\nAMD Radeon RX 6600\r\n'), [
    'AMD Radeon RX 6600',
  ]);
  assert.deepEqual(
    parseLspciGpu(
      '00:02.0 VGA compatible controller: Intel Corporation UHD Graphics (rev 04)\n00:1f.3 Audio device: Intel\n01:00.0 3D controller: NVIDIA Corporation GA107M\n',
    ),
    ['Intel Corporation UHD Graphics (rev 04)', 'NVIDIA Corporation GA107M'],
  );
});

test('buildReport: yetenekler ve yollar denetimlerden türetilir', () => {
  const report = buildReport(
    fakeChecks({ 'yt-dlp': { status: 'missing', version: null, path: null } }),
    system,
  );
  assert.equal(report.schemaVersion, 1);
  assert.equal(report.ok, true);
  assert.ok(!report.capabilities.includes('fetch.youtube'));
  assert.deepEqual(report.missingCapabilities, [
    { key: 'fetch.youtube', missing: ['yt-dlp'] },
  ]);
  assert.equal(
    report.routes.find((route) => route.key === 'clip')?.ready,
    false,
  );
  assert.equal(reportExitCode(report, []), EXIT.ok);
  assert.equal(reportExitCode(report, ['fetch.youtube']), EXIT.requireMissing);
});

test('boş makinede rapor dürüst: ok=false, çıkış kodu 2', () => {
  const report = buildReport(
    fakeChecks(
      Object.fromEntries(
        CHECK_IDS.filter((id) => id !== 'node' && id !== 'pnpm').map((id) => [
          id,
          { status: 'missing' as const, version: null, path: null },
        ]),
      ),
    ),
    system,
  );
  assert.equal(report.ok, false);
  assert.deepEqual(report.capabilities, []);
  assert.equal(reportExitCode(report, []), EXIT.nothing);
});

test('redactReport: JSON çıktısında ev klasörü kalmaz', () => {
  const report = redactReport(
    buildReport(
      fakeChecks({
        venv: { detail: 'bkz. C:\\Users\\Ayse\\ai-influencer-film-venv' },
      }),
      system,
    ),
    'C:\\Users\\Ayse',
    'win32',
  );
  assert.doesNotMatch(JSON.stringify(report), /Ayse/);
  assert.equal(report.checks[0]?.path, '~\\tools\\node.exe');
  // Metin olmayan alanlar aynen kalır
  assert.equal(report.system.cores, 16);
  assert.equal(report.checks[0]?.optional, false);
});

test('formatReport: Türkçe tablo, yönergeler ve özet satırları', () => {
  const report = buildReport(
    fakeChecks({
      'yt-dlp': {
        status: 'missing',
        version: null,
        path: null,
        hint: 'winget install yt-dlp.yt-dlp',
      },
      blender: {
        status: 'outdated',
        version: '4.2.3',
        required: '>=5.0',
        hint: 'winget install BlenderFoundation.Blender',
      },
      'blender.mpfb': {
        status: 'missing',
        version: null,
        path: null,
        hint: 'MPFB kur',
      },
      'py.numpy': {
        status: 'missing',
        version: null,
        path: null,
        hint: 'pip kur',
      },
      'py.pillow': {
        status: 'missing',
        version: null,
        path: null,
        hint: 'pip kur',
      },
    }),
    system,
  );
  const text = formatReport(report, { color: false, required: [] });
  assert.match(text, /Üretim makinesi denetimi: Windows 10\.0\.26100 \(x64\)/);
  assert.match(
    text,
    /16 çekirdek · 32 GB RAM · GPU: NVIDIA GeForce RTX 3060 · boş disk: 6 GB/,
  );
  assert.match(text, /Uyarı: boş disk 10 GB'ın altında/);
  assert.match(text, /^yt-dlp\s+eksik\s+-\s+-$/m);
  assert.match(text, /^Blender\s+eski sürüm\s+4\.2\.3 \(gereken >=5\.0\)/m);
  assert.match(text, /^Blender MPFB eklentisi\s+eksik \(isteğe bağlı\)/m);
  assert.match(text, /^ffmpeg\s+var\s+1\.0\.0/m);
  assert.match(
    text,
    /Eksikler için kurulum \(Windows; bu komut hiçbir şey kurmaz\):/,
  );
  assert.match(text, /yt-dlp:\n\s+winget install yt-dlp\.yt-dlp/);
  // Aynı yönerge bir kez yazılır
  assert.match(text, /numpy, pillow:\n\s+pip kur/);
  assert.equal(text.match(/pip kur/g)?.length, 1);
  assert.match(
    text,
    /Bu makine şunları üretebilir: captions\.burn, render\.hyperframes/,
  );
  // Seslendirme kayıtları numpy ile birleştirilir: numpy yoksa ses yeteneği de yok
  assert.match(text, /Üretemez: voice\.edge-tts \(eksik: numpy\)/);
  assert.match(text, /Üretemez: .*render\.blender \(eksik: Blender\)/);
  assert.match(text, /fetch\.youtube \(eksik: yt-dlp\)/);
  assert.match(
    text,
    /hazır değil\s+Yayıncı klibi \(eksik yetenek: fetch\.youtube\)/,
  );
  assert.match(
    text,
    /^  hazır değil\s+Anlatım videosu, stil yolu \(HyperFrames\) \(eksik yetenek: voice\.edge-tts\)/m,
  );
  // Renk kapalıyken kaçış kodu yok
  assert.doesNotMatch(text, /\x1b\[/);
});

test('formatReport: --require sonucu ve boş makine mesajı', () => {
  const report = buildReport(
    fakeChecks({ 'yt-dlp': { status: 'missing', version: null, path: null } }),
    system,
  );
  assert.match(
    formatReport(report, {
      color: false,
      required: ['fetch.youtube', 'clip.cut'],
    }),
    /İstenen yetenekler eksik: fetch\.youtube \(yt-dlp\)$/,
  );
  assert.match(
    formatReport(report, { color: false, required: ['clip.cut'] }),
    /İstenen yeteneklerin hepsi var: clip\.cut$/,
  );

  const empty = buildReport(
    fakeChecks(
      Object.fromEntries(
        CHECK_IDS.map((id) => [
          id,
          { status: 'missing' as const, version: null, path: null },
        ]),
      ),
    ),
    { ...system, gpu: [], cpu: null, diskFreeGb: null, diskLow: false },
  );
  const text = formatReport(empty, { color: true, required: [] });
  assert.match(text, /Bu makine şu an hiçbir yeteneğe sahip değil\./);
  assert.match(text, /Hiçbir üretim yolu tam değil\./);
  assert.match(text, /GPU: bilinmiyor · boş disk: bilinmiyor/);
});
