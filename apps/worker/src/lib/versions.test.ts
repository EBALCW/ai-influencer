import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  compareVersions,
  meetsMinimum,
  parsePythonProbe,
  parseVersion,
  satisfiesRange,
  versionFromName,
} from './versions.ts';

test('parseVersion: macOS ve Linux çıktıları', () => {
  assert.equal(parseVersion('node', 'v24.14.1\n'), '24.14.1');
  assert.equal(parseVersion('pnpm', '10.34.7\n'), '10.34.7');
  assert.equal(
    parseVersion(
      'ffmpeg',
      'ffmpeg version 9.0.2 Copyright (c) 2000-2026 the FFmpeg developers\nbuilt with Apple clang',
    ),
    '9.0.2',
  );
  assert.equal(
    parseVersion('ffmpeg', 'ffmpeg version 6.1.1-3ubuntu5 Copyright (c)'),
    '6.1.1',
  );
  assert.equal(
    parseVersion('ffprobe', 'ffprobe version n7.1 Copyright (c) 2007-2024'),
    '7.1',
  );
  assert.equal(parseVersion('yt-dlp', '2026.08.19\n'), '2026.08.19');
  assert.equal(
    parseVersion('blender', 'Blender 5.3.0\n\tbuild date: 2026-11-10\n'),
    '5.3.0',
  );
  assert.equal(parseVersion('python', 'Python 3.14.8\n'), '3.14.8');
  assert.equal(
    parseVersion('whisper-cli', 'whisper.cpp version: 1.9.5\n'),
    '1.9.5',
  );
  assert.equal(
    parseVersion('chrome', 'Google Chrome 157.0.8103.51 \n'),
    '157.0.8103.51',
  );
  assert.equal(
    parseVersion('chrome', 'Chromium 130.0.6723.58 snap\n'),
    '130.0.6723.58',
  );
});

test('parseVersion: Windows çıktıları (CRLF, gyan.dev yapıları, öndeki uyarı satırları)', () => {
  assert.equal(
    parseVersion(
      'ffmpeg',
      'ffmpeg version 7.1-full_build-www.gyan.dev Copyright (c) 2000-2024 the FFmpeg developers\r\nbuilt with gcc 14.2.0 (Rev1, Built by MSYS2 project)\r\n',
    ),
    '7.1',
  );
  assert.equal(
    parseVersion(
      'ffmpeg',
      'ffmpeg version 2025-01-02-git-0457aaf0d3-full_build-www.gyan.dev Copyright (c)\r\n',
    ),
    '2025-01-02-git-0457aaf0d3',
  );
  assert.equal(
    parseVersion(
      'ffmpeg',
      'ffmpeg version N-118193-g5f38c82536-20250101 Copyright (c)\r\n',
    ),
    'N-118193-g5f38c82536-20250101',
  );
  assert.equal(
    parseVersion(
      'ffprobe',
      'ffprobe version 7.1-essentials_build-www.gyan.dev Copyright\r\n',
    ),
    '7.1',
  );
  assert.equal(
    parseVersion(
      'blender',
      'Color management: using fallback mode for management\r\nBlender 4.2.3 LTS\r\n\tbuild date: 2024-10-15\r\n',
    ),
    '4.2.3',
  );
  assert.equal(parseVersion('python', 'Python 3.12.7\r\n'), '3.12.7');
  assert.equal(
    parseVersion('yt-dlp', '2025.01.15.232816\r\n'),
    '2025.01.15.232816',
  );
  assert.equal(parseVersion('pnpm', '10.34.7\r\n'), '10.34.7');
});

test('parseVersion: sürüm söylemeyen çıktı null döner', () => {
  // Microsoft Store'a yönlendiren sahte python.exe
  assert.equal(
    parseVersion(
      'python',
      'Python was not found; run without arguments to install from the Microsoft Store, or disable this shortcut from Settings > Apps > Advanced app settings > App execution aliases.\r\n',
    ),
    null,
  );
  assert.equal(
    parseVersion(
      'ffmpeg',
      "'ffmpeg' is not recognized as an internal or external command,\r\noperable program or batch file.\r\n",
    ),
    null,
  );
  assert.equal(parseVersion('blender', ''), null);
  assert.equal(
    parseVersion('yt-dlp', 'Traceback (most recent call last):'),
    null,
  );
  assert.equal(
    parseVersion('whisper-cli', 'error: unknown argument: --version'),
    null,
  );
  assert.equal(parseVersion('node', 'node: bad option'), null);
});

test('versionFromName', () => {
  assert.equal(versionFromName('mac_arm-152.0.7977.30'), '152.0.7977.30');
  assert.equal(versionFromName('win64-152.0.7977.30'), '152.0.7977.30');
  assert.equal(versionFromName('Blender 5.3'), '5.3');
  assert.equal(versionFromName('chrome'), null);
});

test('compareVersions ve meetsMinimum', () => {
  assert.ok(compareVersions('5.3.0', '5.0') > 0);
  assert.equal(compareVersions('5.3', '5.3.0'), 0);
  assert.ok(compareVersions('4.2.3', '5.0') < 0);
  assert.ok(compareVersions('10.0', '9.9') > 0);
  assert.ok(compareVersions('144.1', '87.6') > 0);
  assert.equal(meetsMinimum('3.9.6', '3.9'), true);
  assert.equal(meetsMinimum('3.8.10', '3.9'), false);
  assert.equal(meetsMinimum('0.8.32', '0.8.32'), true);
  assert.equal(meetsMinimum(null, '1.0'), false);
});

test('satisfiesRange: package.json engines aralığı', () => {
  assert.equal(satisfiesRange('24.14.1', '>=24 <25'), true);
  assert.equal(satisfiesRange('22.11.0', '>=24 <25'), false);
  assert.equal(satisfiesRange('25.0.0', '>=24 <25'), false);
  assert.equal(satisfiesRange('24.0.0', '24'), true);
  assert.equal(satisfiesRange('24.0.0', '^24'), false);
});

test('parsePythonProbe: uyarı satırları arasından sonucu bulur', () => {
  const probe = parsePythonProbe(
    'UserWarning: something\r\nPROBE={"python": "3.12.7", "packages": {"numpy": {"ok": true, "version": "2.1.0"}, "scipy": {"ok": false, "version": null}}}\r\n',
  );
  assert.equal(probe?.python, '3.12.7');
  assert.deepEqual(probe?.packages.numpy, { ok: true, version: '2.1.0' });
  assert.equal(probe?.packages.scipy?.ok, false);
  assert.equal(parsePythonProbe('Python was not found'), null);
  assert.equal(parsePythonProbe('PROBE={bozuk'), null);
});
