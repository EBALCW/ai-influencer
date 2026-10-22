import 'server-only';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { MediaKitFonts } from './pdf';

// `geist` paketi (SIL OFL 1.1) TTF dosyalarını içerir. Yol paketin kendi düzenidir;
// panel `apps/panel` dizininden çalışır (next dev/start, vitest).
const fontDir = () =>
  join(process.cwd(), 'node_modules', 'geist', 'dist', 'fonts', 'geist-sans');

let cached: Promise<MediaKitFonts> | null = null;

export function loadMediaKitFonts(): Promise<MediaKitFonts> {
  cached ??= Promise.all([
    readFile(join(fontDir(), 'Geist-Regular.ttf')),
    readFile(join(fontDir(), 'Geist-Bold.ttf')),
  ])
    .then(([regular, bold]) => ({
      regular: new Uint8Array(regular),
      bold: new Uint8Array(bold),
    }))
    .catch((error: unknown) => {
      cached = null;
      throw new Error(
        'Medya kiti fontu yüklenemedi (geist paketi kurulu mu?).',
        {
          cause: error,
        },
      );
    });
  return cached;
}
