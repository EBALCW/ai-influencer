import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  blenderConfigDir,
  envGet,
  expandPattern,
  hyperframesRuntime,
  knownLocationPatterns,
  mpfbManifestPatterns,
  normalizePlatform,
  pathLookupCandidates,
  redactHome,
  toolCandidates,
  venvCandidates,
  venvPython,
  whisperModelPath,
  whisperVadPath,
  type HostContext,
  type ListDir,
} from './locations.ts';

const windows: HostContext = {
  platform: 'win32',
  home: 'C:\\Users\\Ayse',
  env: {
    Path: 'C:\\Windows\\system32;"C:\\Program Files\\nodejs";C:\\Users\\Ayse\\AppData\\Local\\Microsoft\\WindowsApps;',
    PATHEXT: '.COM;.EXE;.BAT;.CMD',
    ProgramFiles: 'C:\\Program Files',
    'ProgramFiles(x86)': 'C:\\Program Files (x86)',
    LOCALAPPDATA: 'C:\\Users\\Ayse\\AppData\\Local',
    APPDATA: 'C:\\Users\\Ayse\\AppData\\Roaming',
  },
};
const mac: HostContext = {
  platform: 'darwin',
  home: '/Users/ayse',
  env: { PATH: '/opt/homebrew/bin:/usr/bin:/bin' },
};
const linux: HostContext = {
  platform: 'linux',
  home: '/home/runner',
  env: { PATH: '/usr/local/bin:/usr/bin' },
};

/** Sahte dosya sistemi: klasör → içindeki adlar. */
const fakeFs =
  (tree: Record<string, string[]>): ListDir =>
  (dir) =>
    tree[dir] ?? [];

test('normalizePlatform: bilinmeyen platform Linux gibi ele alınır', () => {
  assert.equal(normalizePlatform('darwin'), 'darwin');
  assert.equal(normalizePlatform('win32'), 'win32');
  assert.equal(normalizePlatform('freebsd'), 'linux');
});

test('envGet: Windows adları büyük/küçük harfe duyarsız', () => {
  assert.match(envGet(windows, 'PATH') ?? '', /system32/);
  assert.equal(
    envGet(windows, 'localappdata'),
    'C:\\Users\\Ayse\\AppData\\Local',
  );
  assert.equal(envGet(mac, 'path'), undefined);
});

test('pathLookupCandidates: Windows PATHEXT uzantıları ve tırnaklı klasör', () => {
  const candidates = pathLookupCandidates(['ffmpeg'], windows);
  assert.ok(candidates.includes('C:\\Windows\\system32\\ffmpeg.exe'));
  assert.ok(candidates.includes('C:\\Program Files\\nodejs\\ffmpeg.cmd'));
  assert.ok(candidates.every((candidate) => !candidate.includes('"')));
  assert.ok(
    candidates.every((candidate) => /\.(com|exe|bat|cmd)$/.test(candidate)),
  );
  // Uzantı verilmişse yeniden eklenmez
  assert.deepEqual(pathLookupCandidates(['py.exe'], windows).slice(0, 1), [
    'C:\\Windows\\system32\\py.exe',
  ]);
});

test('pathLookupCandidates: POSIX', () => {
  assert.deepEqual(pathLookupCandidates(['python3', 'python'], mac), [
    '/opt/homebrew/bin/python3',
    '/opt/homebrew/bin/python',
    '/usr/bin/python3',
    '/usr/bin/python',
    '/bin/python3',
    '/bin/python',
  ]);
  assert.deepEqual(pathLookupCandidates(['ffmpeg'], { ...mac, env: {} }), []);
});

test('expandPattern: Blender klasörleri, yeni sürüm önce', () => {
  const listDir = fakeFs({
    'C:\\Program Files\\Blender Foundation': [
      'Blender 4.2',
      'Blender 5.3',
      'Blender 5.10',
      'readme.txt',
    ],
  });
  assert.deepEqual(
    expandPattern(
      'C:\\Program Files\\Blender Foundation\\Blender *\\blender.exe',
      'win32',
      listDir,
    ),
    [
      'C:\\Program Files\\Blender Foundation\\Blender 5.10\\blender.exe',
      'C:\\Program Files\\Blender Foundation\\Blender 5.3\\blender.exe',
      'C:\\Program Files\\Blender Foundation\\Blender 4.2\\blender.exe',
    ],
  );
  // Klasör yoksa aday da yok
  assert.deepEqual(
    expandPattern('C:\\Yok\\Blender *\\blender.exe', 'win32', fakeFs({})),
    [],
  );
  // Yıldızsız yol olduğu gibi döner
  assert.deepEqual(expandPattern('/usr/bin/ffmpeg', 'linux', fakeFs({})), [
    '/usr/bin/ffmpeg',
  ]);
});

test('expandPattern: iki katlı kalıp (winget paket klasörü)', () => {
  const packages =
    'C:\\Users\\Ayse\\AppData\\Local\\Microsoft\\WinGet\\Packages';
  const gyan = `${packages}\\Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe`;
  const listDir = fakeFs({
    [packages]: [
      'Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe',
      'yt-dlp.yt-dlp_x',
    ],
    [gyan]: ['ffmpeg-7.1-full_build'],
  });
  assert.deepEqual(
    expandPattern(
      `${packages}\\Gyan.FFmpeg*\\ffmpeg-*\\bin\\ffmpeg.exe`,
      'win32',
      listDir,
    ),
    [`${gyan}\\ffmpeg-7.1-full_build\\bin\\ffmpeg.exe`],
  );
});

test('knownLocationPatterns: Windows kurulum yerleri', () => {
  const blender = knownLocationPatterns('blender', windows);
  assert.ok(
    blender.includes(
      'C:\\Program Files\\Blender Foundation\\Blender *\\blender.exe',
    ),
  );
  assert.ok(
    blender.includes(
      'C:\\Users\\Ayse\\scoop\\apps\\blender\\current\\blender.exe',
    ),
  );

  const ffmpeg = knownLocationPatterns('ffmpeg', windows);
  assert.ok(
    ffmpeg.includes(
      'C:\\Users\\Ayse\\AppData\\Local\\Microsoft\\WinGet\\Links\\ffmpeg.exe',
    ),
  );
  assert.ok(ffmpeg.includes('C:\\Users\\Ayse\\scoop\\shims\\ffmpeg.exe'));
  assert.ok(ffmpeg.some((pattern) => pattern.includes('Gyan.FFmpeg*')));

  const ytDlp = knownLocationPatterns('yt-dlp', windows);
  assert.ok(
    ytDlp.some((pattern) => pattern.endsWith('WinGet\\Links\\yt-dlp.exe')),
  );

  const chrome = knownLocationPatterns('chrome', windows);
  assert.ok(
    chrome.includes(
      'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    ),
  );
  assert.ok(
    chrome.includes(
      'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    ),
  );
  assert.ok(chrome[0]?.endsWith('chrome-headless-shell.exe'));

  const python = knownLocationPatterns('python', windows);
  assert.ok(
    python.includes(
      'C:\\Users\\Ayse\\AppData\\Local\\Programs\\Python\\Python3*\\python.exe',
    ),
  );
});

test('knownLocationPatterns: Windows ortam değişkenleri yoksa varsayılan klasörler', () => {
  const bare: HostContext = {
    platform: 'win32',
    home: 'D:\\Kullanici',
    env: {},
  };
  assert.ok(
    knownLocationPatterns('blender', bare).includes(
      'C:\\Program Files\\Blender Foundation\\Blender *\\blender.exe',
    ),
  );
  assert.ok(
    knownLocationPatterns('ffmpeg', bare).includes(
      'D:\\Kullanici\\AppData\\Local\\Microsoft\\WinGet\\Links\\ffmpeg.exe',
    ),
  );
});

test('knownLocationPatterns: macOS (ffmpeg-full önce, Blender.app, Chrome.app)', () => {
  const ffmpeg = knownLocationPatterns('ffmpeg', mac);
  assert.equal(ffmpeg[0], '/opt/homebrew/opt/ffmpeg-full/bin/ffmpeg');
  assert.equal(ffmpeg[1], '/usr/local/opt/ffmpeg-full/bin/ffmpeg');
  assert.ok(ffmpeg.includes('/usr/local/bin/ffmpeg'));
  assert.equal(
    knownLocationPatterns('ffprobe', mac)[0],
    '/opt/homebrew/opt/ffmpeg-full/bin/ffprobe',
  );
  assert.equal(
    knownLocationPatterns('blender', mac)[0],
    '/Applications/Blender.app/Contents/MacOS/Blender',
  );
  assert.ok(
    knownLocationPatterns('chrome', mac).includes(
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    ),
  );
  assert.ok(
    knownLocationPatterns('whisper-cli', mac).includes(
      '/opt/homebrew/bin/whisper-cli',
    ),
  );
});

test('knownLocationPatterns: Linux', () => {
  assert.ok(knownLocationPatterns('ffmpeg', linux).includes('/usr/bin/ffmpeg'));
  assert.ok(
    knownLocationPatterns('yt-dlp', linux).includes(
      '/home/runner/.local/bin/yt-dlp',
    ),
  );
  assert.ok(
    knownLocationPatterns('chrome', linux).includes('/usr/bin/google-chrome'),
  );
  assert.ok(
    knownLocationPatterns('blender', linux).includes('/snap/bin/blender'),
  );
});

test('toolCandidates: önce kullanıcının verdiği yol, sonra PATH, sonra bilinen yerler', () => {
  const ctx: HostContext = {
    ...mac,
    env: { ...mac.env, FFMPEG_PATH: '/ozel/ffmpeg' },
  };
  const candidates = toolCandidates('ffmpeg', ctx, fakeFs({}));
  assert.deepEqual(candidates.slice(0, 3), [
    '/ozel/ffmpeg',
    '/opt/homebrew/bin/ffmpeg',
    '/usr/bin/ffmpeg',
  ]);
  assert.ok(candidates.includes('/opt/homebrew/opt/ffmpeg-full/bin/ffmpeg'));
  // Yinelenen yol bir kez geçer
  assert.equal(new Set(candidates).size, candidates.length);

  const blender = toolCandidates(
    'blender',
    {
      ...windows,
      env: { ...windows.env, BLENDER_PATH: 'D:\\Blender\\blender.exe' },
    },
    fakeFs({ 'C:\\Program Files\\Blender Foundation': ['Blender 5.3'] }),
  );
  assert.equal(blender[0], 'D:\\Blender\\blender.exe');
  assert.ok(
    blender.includes(
      'C:\\Program Files\\Blender Foundation\\Blender 5.3\\blender.exe',
    ),
  );
  assert.ok(blender.every((candidate) => !candidate.includes('*')));
});

test('toolCandidates: HyperFrames başsız Chrome önbelleği', () => {
  const shell = '/Users/ayse/.cache/hyperframes/chrome/chrome-headless-shell';
  const candidates = toolCandidates(
    'chrome',
    mac,
    fakeFs({
      [shell]: ['mac_arm-150.0.1.2', 'mac_arm-152.0.7977.30'],
      [`${shell}/mac_arm-152.0.7977.30`]: ['chrome-headless-shell-mac-arm64'],
      [`${shell}/mac_arm-150.0.1.2`]: ['chrome-headless-shell-mac-arm64'],
    }),
  );
  assert.ok(
    candidates.indexOf(
      `${shell}/mac_arm-152.0.7977.30/chrome-headless-shell-mac-arm64/chrome-headless-shell`,
    ) <
      candidates.indexOf(
        `${shell}/mac_arm-150.0.1.2/chrome-headless-shell-mac-arm64/chrome-headless-shell`,
      ),
  );
});

test('sanal ortam, HyperFrames, whisper ve Blender ayar yolları', () => {
  assert.deepEqual(venvCandidates(mac), [
    '/Users/ayse/.local/share/ai-influencer-film-venv',
  ]);
  assert.deepEqual(venvCandidates(windows), [
    'C:\\Users\\Ayse\\ai-influencer-film-venv',
    'C:\\Users\\Ayse\\.local\\share\\ai-influencer-film-venv',
  ]);
  assert.deepEqual(
    venvCandidates({ ...mac, env: { FILM_VENV_DIR: '/veri/venv' } }),
    ['/veri/venv'],
  );
  assert.equal(venvPython('/veri/venv', 'linux'), '/veri/venv/bin/python');
  assert.equal(
    venvPython('C:\\Users\\Ayse\\ai-influencer-film-venv', 'win32'),
    'C:\\Users\\Ayse\\ai-influencer-film-venv\\Scripts\\python.exe',
  );

  assert.equal(
    hyperframesRuntime(mac),
    '/Users/ayse/ai-influencer-films/.favstash-studio/runtime',
  );
  assert.equal(
    hyperframesRuntime({
      ...windows,
      env: { FILM_WORKSPACE_DIR: 'D:\\Filmler' },
    }),
    'D:\\Filmler\\.favstash-studio\\runtime',
  );

  assert.equal(
    whisperModelPath(mac),
    '/Users/ayse/.local/share/whisper-models/ggml-large-v3-turbo-q5_0.bin',
  );
  assert.equal(
    whisperVadPath({
      ...mac,
      env: { WHISPER_MODEL: '/modeller/ggml-small.bin' },
    }),
    '/modeller/ggml-silero-v6.2.0.bin',
  );

  assert.equal(
    blenderConfigDir(windows),
    'C:\\Users\\Ayse\\AppData\\Roaming\\Blender Foundation\\Blender',
  );
  assert.equal(blenderConfigDir(linux), '/home/runner/.config/blender');
  assert.equal(
    mpfbManifestPatterns(mac)[0],
    '/Users/ayse/Library/Application Support/Blender/*/extensions/*/mpfb/blender_manifest.toml',
  );
});

test('redactHome: ev klasörü ~ olur, benzer adlı klasör olmaz', () => {
  assert.equal(
    redactHome('/Users/ayse/.local/share/x', '/Users/ayse', 'darwin'),
    '~/.local/share/x',
  );
  assert.equal(redactHome('/Users/ayse', '/Users/ayse', 'darwin'), '~');
  assert.equal(
    redactHome('/Users/aysegul/film', '/Users/ayse', 'darwin'),
    '/Users/aysegul/film',
  );
  assert.equal(
    redactHome(
      'yol "/Users/ayse/a b" ve /Users/ayse/c',
      '/Users/ayse',
      'darwin',
    ),
    'yol "~/a b" ve ~/c',
  );
  assert.equal(
    redactHome(
      'c:\\users\\ayse\\scoop\\shims\\ffmpeg.exe',
      'C:\\Users\\Ayse',
      'win32',
    ),
    '~\\scoop\\shims\\ffmpeg.exe',
  );
  assert.equal(
    redactHome('C:/Users/Ayse/venv', 'C:\\Users\\Ayse\\', 'win32'),
    '~/venv',
  );
  assert.equal(
    redactHome('C:\\Users\\Ayse\\venv', 'C:\\Users\\Ayse', 'win32', '$HOME'),
    '$HOME\\venv',
  );
  // Kök ev klasörü (kapsayıcı) her yolu bozmasın
  assert.equal(redactHome('/usr/bin/ffmpeg', '/', 'linux'), '/usr/bin/ffmpeg');
  assert.equal(redactHome('/usr/bin/ffmpeg', '', 'linux'), '/usr/bin/ffmpeg');
});
