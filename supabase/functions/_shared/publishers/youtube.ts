// YouTube Shorts yayıncısı (#58): Data API v3 videos.insert, resumable upload.
//
// Akış: (1) oturum aç (POST ?uploadType=resumable, gövde = metadata) → Location oturum adresi,
// hemen checkpoint'e yazılır; (2) baytları PUT et → yanıt video kaynağı. Worker yarıda kalırsa
// sonraki çalıştırma oturumun durumunu sorar (PUT Content-Range: bytes */N): 200/201 → yükleme
// zaten bitmiş (aynı video döner, çift yükleme yok); 308 → kalan baytlardan devam; 404/410 →
// oturum düşmüş, yeniden açılır.
//
// AI açıklaması her zaman açıktır (status.containsSyntheticMedia = true, #32). Shorts: dikey/kare
// ve ≤ 180 sn video otomatik Shorts sayılır; açıklamaya #Shorts eklenir.
import { PermanentError, TransientError } from '../collectors/types.ts';
import { youtubeError } from '../youtube/client.ts';
import { DEFAULT_SHORTS_RULE, detectShort } from '../youtube/map.ts';
import {
  DEFAULT_PUBLISH_CONFIG,
  PLATFORM_CAPABILITIES,
  type PublishConfig,
} from './config.ts';
import type {
  PublishContext,
  PublishInput,
  PublishOutcome,
  Publisher,
} from './types.ts';

export const YOUTUBE_UPLOAD_BASE =
  'https://www.googleapis.com/upload/youtube/v3/videos';
/** videos.insert kota maliyeti (birim). Güncel değer: developers.google.com/youtube/v3/determine_quota_cost */
export const YOUTUBE_INSERT_QUOTA_UNITS = 1600;

const LABEL = 'YouTube videos.insert';

/** YouTube başlık/açıklamada `<` ve `>` kabul etmez; başlık en çok 100 karakter. */
export function youtubeTitle(title: string): string {
  const clean = title.replace(/[<>]/g, '').replace(/\s+/g, ' ').trim();
  return (clean || 'Video').slice(0, 100);
}

export function youtubeDescription(
  caption: string,
  short: boolean,
  addTag: boolean,
) {
  let text = caption.replace(/[<>]/g, '');
  if (short && addTag && !/#shorts\b/i.test(text)) {
    text = text ? `${text}\n\n#Shorts` : '#Shorts';
  }
  return text.slice(0, 4900);
}

/** Etiketler toplamda ~500 karakteri aşamaz; virgül ve `<>` içeremez. */
export function youtubeTags(tags: string[]): string[] {
  const out: string[] = [];
  let total = 0;
  for (const raw of tags) {
    const tag = raw.replace(/[<>,]/g, '').replace(/^#/, '').trim();
    if (!tag) continue;
    const cost =
      tag.length + (tag.includes(' ') ? 2 : 0) + (out.length ? 1 : 0);
    if (total + cost > 480) break;
    out.push(tag);
    total += cost;
  }
  return out;
}

export function isShortVideo(input: PublishInput['video']): boolean {
  const durationS = input.durationMs === null ? null : input.durationMs / 1000;
  if (durationS === null) {
    return input.width && input.height ? input.height >= input.width : true;
  }
  return detectShort(
    { durationS, width: input.width, height: input.height },
    DEFAULT_SHORTS_RULE,
  );
}

/** Oturum adresi yalnız Google upload sunucusu olabilir; token başka hosta gönderilmez. */
function trustedSession(url: string | null): string | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    return u.protocol === 'https:' &&
      u.hostname === 'www.googleapis.com' &&
      u.pathname.startsWith('/upload/youtube/v3/videos')
      ? u.toString()
      : null;
  } catch {
    return null;
  }
}

async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

async function send(
  ctx: PublishContext,
  url: string,
  init: RequestInit,
): Promise<Response> {
  try {
    return await ctx.fetch(url, init);
  } catch {
    throw new TransientError(`${LABEL}: ağ hatası`);
  }
}

type VideoResource = { id?: unknown; snippet?: { publishedAt?: unknown } };

export function createYoutubePublisher(
  config: PublishConfig = DEFAULT_PUBLISH_CONFIG,
): Publisher {
  const auth = (ctx: PublishContext) => `Bearer ${ctx.token.accessToken}`;

  function outcome(
    body: unknown,
    input: PublishInput,
    short: boolean,
  ): PublishOutcome {
    const video = (body ?? {}) as VideoResource;
    const id = typeof video.id === 'string' && video.id ? video.id : null;
    if (!id) throw new PermanentError(`${LABEL}: yanıtta video id yok`);
    const at =
      typeof video.snippet?.publishedAt === 'string'
        ? new Date(video.snippet.publishedAt)
        : null;
    return {
      kind: 'published',
      externalId: id,
      url: short
        ? `https://www.youtube.com/shorts/${id}`
        : `https://www.youtube.com/watch?v=${id}`,
      publishedAt: at && !Number.isNaN(at.getTime()) ? at : null,
      durationS:
        input.video.durationMs === null ? null : input.video.durationMs / 1000,
      isShort: short,
    };
  }

  async function openSession(
    ctx: PublishContext,
    input: PublishInput,
    size: number,
    short: boolean,
  ): Promise<string> {
    const url = new URL(YOUTUBE_UPLOAD_BASE);
    url.searchParams.set('uploadType', 'resumable');
    url.searchParams.set('part', 'snippet,status,paidProductPlacementDetails');
    const metadata = {
      snippet: {
        title: youtubeTitle(input.title),
        description: youtubeDescription(
          input.caption,
          short,
          config.youtube.addShortsTag,
        ),
        tags: youtubeTags(input.tags),
        categoryId: config.youtube.categoryId,
      },
      status: {
        privacyStatus: config.youtube.privacyStatus,
        selfDeclaredMadeForKids: false,
        // #32: gerçekçi AI içerik her zaman açıklanır. Etiketsiz yükleme seçeneği yok.
        containsSyntheticMedia: true,
        embeddable: true,
      },
      paidProductPlacementDetails: {
        hasPaidProductPlacement: input.paidPartnership,
      },
    };
    const response = await send(ctx, url.toString(), {
      method: 'POST',
      headers: {
        authorization: auth(ctx),
        'content-type': 'application/json; charset=UTF-8',
        'x-upload-content-length': String(size),
        'x-upload-content-type': input.video.mimeType || 'video/mp4',
      },
      body: JSON.stringify(metadata),
    });
    if (!response.ok) {
      throw youtubeError(response, await readJson(response), LABEL, ctx.now);
    }
    await response.body?.cancel();
    const session = trustedSession(response.headers.get('location'));
    if (!session) {
      throw new PermanentError(`${LABEL}: geçerli upload oturumu dönmedi`);
    }
    return session;
  }

  /** Oturum durumu: tamamlanmış video, devam ofseti ya da düşmüş oturum (null). */
  async function sessionStatus(
    ctx: PublishContext,
    session: string,
    size: number,
  ): Promise<{ done: unknown } | { offset: number } | null> {
    const response = await send(ctx, session, {
      method: 'PUT',
      headers: {
        authorization: auth(ctx),
        'content-range': `bytes */${size}`,
      },
      body: new Uint8Array(0),
    });
    if (response.status === 200 || response.status === 201) {
      return { done: await readJson(response) };
    }
    if (response.status === 308) {
      await response.body?.cancel();
      const range = response.headers.get('range');
      const m = range?.match(/bytes=0-(\d+)/);
      return { offset: m ? Number(m[1]) + 1 : 0 };
    }
    if (response.status === 404 || response.status === 410) {
      await response.body?.cancel();
      return null;
    }
    throw youtubeError(response, await readJson(response), LABEL, ctx.now);
  }

  async function upload(
    ctx: PublishContext,
    session: string,
    bytes: Uint8Array<ArrayBuffer>,
    offset: number,
    mime: string,
  ): Promise<unknown> {
    const size = bytes.byteLength;
    const headers: Record<string, string> = {
      authorization: auth(ctx),
      'content-type': mime,
    };
    if (offset > 0) {
      headers['content-range'] = `bytes ${offset}-${size - 1}/${size}`;
    }
    const response = await send(ctx, session, {
      method: 'PUT',
      headers,
      body: offset > 0 ? bytes.subarray(offset) : bytes,
    });
    if (response.status === 200 || response.status === 201) {
      return await readJson(response);
    }
    if (response.status === 308) {
      await response.body?.cancel();
      throw new TransientError(`${LABEL}: yükleme yarım kaldı (308)`);
    }
    if (response.status === 404 || response.status === 410) {
      await response.body?.cancel();
      await ctx.checkpoint({ uploadUrl: null });
      throw new TransientError(
        `${LABEL}: upload oturumu düştü (${response.status})`,
      );
    }
    throw youtubeError(response, await readJson(response), LABEL, ctx.now);
  }

  return {
    platform: 'youtube',
    capabilities: PLATFORM_CAPABILITIES.youtube,
    async publish(ctx, input) {
      const short = isShortVideo(input.video);
      const mime = input.video.mimeType || 'video/mp4';
      const bytes = await ctx.loadVideo();
      if (bytes.byteLength === 0) {
        throw new PermanentError(`${LABEL}: video dosyası boş`);
      }
      let session = trustedSession(input.uploadUrl);
      let offset = 0;
      if (session) {
        const status = await sessionStatus(ctx, session, bytes.byteLength);
        if (status && 'done' in status)
          return outcome(status.done, input, short);
        if (status) offset = status.offset;
        else session = null;
      }
      if (!session) {
        session = await openSession(ctx, input, bytes.byteLength, short);
        await ctx.checkpoint({ uploadUrl: session });
        offset = 0;
      }
      const video = await upload(ctx, session, bytes, offset, mime);
      return outcome(video, input, short);
    },
  };
}

export const youtubePublisher = createYoutubePublisher();
