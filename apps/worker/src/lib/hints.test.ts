import assert from 'node:assert/strict';
import { test } from 'node:test';
import { CHECK_IDS } from './capabilities.ts';
import { installHint, type HintContext } from './hints.ts';

const posix: HintContext = {
  venvDir: '$HOME/.local/share/ai-influencer-film-venv',
  venvPython: '$HOME/.local/share/ai-influencer-film-venv/bin/python',
  filmWorkspace: '$HOME/ai-influencer-films',
  whisperModel:
    '$HOME/.local/share/whisper-models/ggml-large-v3-turbo-q5_0.bin',
  whisperVad: '$HOME/.local/share/whisper-models/ggml-silero-v6.2.0.bin',
};
const windows: HintContext = {
  venvDir: '$HOME\\ai-influencer-film-venv',
  venvPython: '$HOME\\ai-influencer-film-venv\\Scripts\\python.exe',
  filmWorkspace: '$HOME\\ai-influencer-films',
  whisperModel:
    '$HOME\\.local\\share\\whisper-models\\ggml-large-v3-turbo-q5_0.bin',
  whisperVad: '$HOME\\.local\\share\\whisper-models\\ggml-silero-v6.2.0.bin',
};

test('her denetimin her işletim sisteminde yönergesi var', () => {
  for (const id of CHECK_IDS) {
    assert.ok(installHint(id, 'darwin', posix), `darwin ${id}`);
    assert.ok(installHint(id, 'win32', windows), `win32 ${id}`);
    assert.ok(installHint(id, 'linux', posix), `linux ${id}`);
  }
});

test('macOS yönergeleri brew kullanır', () => {
  assert.match(
    installHint('ffmpeg', 'darwin', posix) ?? '',
    /^brew install ffmpeg-full/,
  );
  assert.match(
    installHint('ffmpeg.subtitles', 'darwin', posix) ?? '',
    /ffmpeg-full/,
  );
  assert.match(
    installHint('yt-dlp', 'darwin', posix) ?? '',
    /^brew install yt-dlp$/,
  );
  assert.match(
    installHint('blender', 'darwin', posix) ?? '',
    /^brew install --cask blender/,
  );
  assert.match(
    installHint('whisper-cli', 'darwin', posix) ?? '',
    /^brew install whisper-cpp$/,
  );
  assert.match(
    installHint('python', 'darwin', posix) ?? '',
    /^brew install python$/,
  );
  assert.match(
    installHint('chrome', 'darwin', posix) ?? '',
    /^brew install --cask google-chrome$/,
  );
});

test('Windows yönergeleri winget kullanır, brew ya da apt içermez', () => {
  assert.match(
    installHint('ffmpeg', 'win32', windows) ?? '',
    /^winget install Gyan\.FFmpeg/,
  );
  assert.match(
    installHint('yt-dlp', 'win32', windows) ?? '',
    /^winget install yt-dlp\.yt-dlp$/,
  );
  assert.match(
    installHint('blender', 'win32', windows) ?? '',
    /^winget install BlenderFoundation\.Blender/,
  );
  assert.match(
    installHint('python', 'win32', windows) ?? '',
    /^winget install Python\.Python\.3/,
  );
  assert.match(
    installHint('chrome', 'win32', windows) ?? '',
    /^winget install Google\.Chrome$/,
  );
  for (const id of CHECK_IDS)
    assert.doesNotMatch(
      installHint(id, 'win32', windows) ?? '',
      /\b(brew|apt|sudo)\b/,
      id,
    );
});

test('Linux yönergeleri brew ya da winget içermez', () => {
  assert.match(
    installHint('ffmpeg', 'linux', posix) ?? '',
    /^sudo apt install ffmpeg$/,
  );
  for (const id of CHECK_IDS)
    assert.doesNotMatch(
      installHint(id, 'linux', posix) ?? '',
      /\b(brew|winget)\b/,
      id,
    );
});

test('yol içeren yönergeler işletim sistemine uyar', () => {
  assert.equal(
    installHint('venv', 'darwin', posix),
    'python3 -m venv "$HOME/.local/share/ai-influencer-film-venv"  (başka klasör için FILM_VENV_DIR)',
  );
  assert.match(
    installHint('venv', 'win32', windows) ?? '',
    /^py -m venv "\$HOME\\ai-influencer-film-venv"/,
  );
  // PowerShell tırnaklı yolu `&` ile çalıştırır
  assert.match(
    installHint('py.skia', 'win32', windows) ?? '',
    /^& "\$HOME\\ai-influencer-film-venv\\Scripts\\python\.exe" -m pip install -r /,
  );
  assert.match(
    installHint('py.edge-tts', 'linux', posix) ?? '',
    /^"\$HOME\/\.local\/share\/ai-influencer-film-venv\/bin\/python" -m pip install .* edge-tts$/,
  );
  assert.match(
    installHint('whisper.model', 'win32', windows) ?? '',
    /^curl\.exe -L /,
  );
  assert.match(
    installHint('whisper.model', 'darwin', posix) ?? '',
    /^curl -L /,
  );
  assert.match(
    installHint('hyperframes', 'darwin', posix) ?? '',
    /init-workspace\.mjs --workspace "\$HOME\/ai-influencer-films" --install/,
  );
});
