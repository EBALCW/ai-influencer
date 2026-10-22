import { assertEquals } from '@std/assert';
import { DEFAULT_PUBLISH_CONFIG, publishConfigFromEnv } from './config.ts';

const env = (values: Record<string, string>) => ({
  get: (k: string) => values[k],
});

Deno.test(
  'yayın ayarları ortamdan okunur, geçersiz değer varsayılana düşer',
  () => {
    assertEquals(publishConfigFromEnv(env({})), DEFAULT_PUBLISH_CONFIG);
    const c = publishConfigFromEnv(
      env({
        YOUTUBE_PRIVACY_STATUS: 'unlisted',
        INSTAGRAM_GRAPH_VERSION: 'v25.0',
        PUBLISH_MAX_VIDEO_BYTES: '5000',
      }),
    );
    assertEquals(
      [c.youtube.privacyStatus, c.instagram.version, c.maxVideoBytes],
      ['unlisted', 'v25.0', 5000],
    );
    const bad = publishConfigFromEnv(
      env({
        YOUTUBE_PRIVACY_STATUS: 'everyone',
        INSTAGRAM_GRAPH_VERSION: '../x',
        PUBLISH_MAX_VIDEO_BYTES: '-1',
      }),
    );
    assertEquals(
      [bad.youtube.privacyStatus, bad.instagram.version, bad.maxVideoBytes],
      [
        'public',
        DEFAULT_PUBLISH_CONFIG.instagram.version,
        DEFAULT_PUBLISH_CONFIG.maxVideoBytes,
      ],
    );
  },
);
