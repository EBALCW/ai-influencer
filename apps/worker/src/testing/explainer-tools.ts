// Testler için anlatım araçları: gerçek şablon dosyaları + sahte komutlar (explainer-shim.mjs).
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { REPO_ROOT, type ExplainerTools } from '../handlers/explainer/tools.ts';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SHIM = path.join(HERE, 'explainer-shim.mjs');

/** `env`: sahte aracın davranışı (ör. `{ SHIM_FAIL: 'edge' }`). */
export function fakeExplainerTools(
  env: Record<string, string> = {},
): ExplainerTools {
  const command = (tool: string) => [process.execPath, SHIM, tool];
  const example = path.join(
    REPO_ROOT,
    '.claude',
    'skills',
    'anlatim-videosu',
    'ornek',
    'planor-stil',
    'assets',
  );
  const template = path.join(HERE, '..', 'handlers', 'explainer', 'template');
  return {
    python: command('python'),
    node: command('node'),
    ffmpeg: command('ffmpeg'),
    ffprobe: command('ffprobe'),
    hyperframes: command('hyperframes'),
    scripts: {
      edgeTakes: 'edge_takes.py',
      voice: 'voice.py',
      timing: 'zaman_js.py',
      sfxSync: 'sfx-sync.mjs',
    },
    assets: {
      engine: path.join(example, 'bp.js'),
      fonts: path.join(example, 'fonts'),
      template: path.join(template, 'sablon.js'),
      specPy: path.join(template, 'spec.py'),
    },
    env,
  };
}

/** Örnek iş parametreleri ve onaylı senaryo sürümü (panelin dondurduğu biçim). */
export function sampleEpisode(
  overrides: {
    scriptText?: string;
    script?: unknown;
    params?: Record<string, unknown>;
    version?: Record<string, unknown>;
  } = {},
) {
  const episodeId = '00000000-0000-4000-8000-0000000000e1';
  return {
    episodeId,
    params: {
      episode: {
        id: episodeId,
        number: 3,
        title: 'Planör nasıl uçar?',
        kind: 'how_it_works',
        language: 'tr',
        script_version: 2,
      },
      series: {
        id: '00000000-0000-4000-8000-0000000000a1',
        name: 'Gökyüzü Defteri',
        theme: 'Uçan şeyler',
      },
      visual_route: 'hyperframes',
      style_key: 'blueprint',
      voice: { provider: 'edge-tts', name: 'tr-TR-AhmetNeural', rate: '+8%' },
      caption_style: { mode: 'line' },
      params: {},
      ...overrides.params,
    },
    version: {
      version: 2,
      kind: 'how_it_works',
      language: 'tr',
      script_text:
        overrides.scriptText ??
        'Planörün motoru yok. Yine de saatlerce havada kalır.\n\nModern bir planör 1.000 metre alçalırken 40, 50 kilometre ileri gidebilir.',
      script: overrides.script ?? null,
      fact_notes: [
        {
          claim: 'Planörün motoru yok.',
          sources: [
            {
              title: 'NASA Glenn: Gliders',
              url: 'https://www1.grc.nasa.gov/gliders/',
            },
            { url: 'https://en.wikipedia.org/wiki/Glider_(sailplane)' },
          ],
        },
      ],
      approved_at: '2026-11-15T12:00:00Z',
      ...overrides.version,
    },
  };
}
