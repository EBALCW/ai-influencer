// Bitmiş videonun denetimi için araç çıktılarını okuyan saf fonksiyonlar.

export interface ProbeSummary {
  duration: number | null;
  video: { width: number; height: number; codec: string } | null;
  audio: boolean;
}

/** `ffprobe -print_format json -show_format -show_streams` çıktısı. */
export function parseProbe(json: string): ProbeSummary | null {
  let data: unknown;
  try {
    data = JSON.parse(json);
  } catch {
    return null;
  }
  if (!data || typeof data !== 'object') return null;
  const root = data as {
    format?: { duration?: unknown };
    streams?: unknown;
  };
  const streams = Array.isArray(root.streams)
    ? (root.streams as Record<string, unknown>[])
    : [];
  const video = streams.find((stream) => stream?.codec_type === 'video');
  const duration = Number(root.format?.duration);
  return {
    duration: Number.isFinite(duration) && duration > 0 ? duration : null,
    video:
      video && Number(video.width) > 0 && Number(video.height) > 0
        ? {
            width: Number(video.width),
            height: Number(video.height),
            codec: String(video.codec_name ?? ''),
          }
        : null,
    audio: streams.some((stream) => stream?.codec_type === 'audio'),
  };
}

/** `ebur128` süzgecinin özetindeki bütünleşik ses yüksekliği (LUFS). */
export function parseLoudness(stderr: string): number | null {
  const matches = [...stderr.matchAll(/\bI:\s*(-?\d+(?:\.\d+)?)\s*LUFS/g)];
  const last = matches[matches.length - 1];
  if (!last) return null;
  const value = Number(last[1]);
  return Number.isFinite(value) ? value : null;
}

/** `blackdetect` süzgecinin bulduğu siyah aralıkların toplam süresi (sn). */
export function parseBlackSeconds(stderr: string): number {
  let total = 0;
  for (const match of stderr.matchAll(/black_duration:\s*(\d+(?:\.\d+)?)/g))
    total += Number(match[1]);
  return Math.round(total * 1000) / 1000;
}

/**
 * Dosyayı `limitBytes`'a sığdıran video bit hızı (kbps); ses ve kap payı düşülür.
 * `null`: bu süre o sınıra okunur kalitede sığmaz.
 */
export function fitVideoKbps(
  limitBytes: number,
  seconds: number,
  audioKbps = 128,
  minKbps = 220,
): number | null {
  if (!(seconds > 0) || !(limitBytes > 0)) return null;
  const total = (limitBytes * 8 * 0.95) / seconds / 1000;
  const video = Math.floor(total - audioKbps);
  return video >= minKbps ? video : null;
}

export const LOUDNESS_TARGET = -14;
export const LOUDNESS_TOLERANCE = 3;

export interface FinalCheckInput {
  probe: ProbeSummary | null;
  expectedSeconds: number;
  lufs: number | null;
  blackSeconds: number;
}

/** Bitmiş videonun temel denetimi; sorun yoksa boş liste. Mesajlar sabit metindir. */
export function finalProblems(input: FinalCheckInput): string[] {
  const problems: string[] = [];
  const { probe } = input;
  if (!probe) return ['video dosyası okunamadı'];
  if (!probe.video) problems.push('görüntü akışı yok');
  else if (probe.video.width !== 1080 || probe.video.height !== 1920)
    problems.push(
      `çözünürlük 1080×1920 değil (${probe.video.width}×${probe.video.height})`,
    );
  if (!probe.audio) problems.push('ses akışı yok');
  if (probe.duration === null) problems.push('süre okunamadı');
  else if (Math.abs(probe.duration - input.expectedSeconds) > 0.5)
    problems.push(
      `süre anlatımla uyuşmuyor (${probe.duration.toFixed(2)} sn, beklenen ${input.expectedSeconds.toFixed(2)} sn)`,
    );
  if (input.lufs === null) problems.push('ses yüksekliği ölçülemedi');
  else if (Math.abs(input.lufs - LOUDNESS_TARGET) > LOUDNESS_TOLERANCE)
    problems.push(
      `ses yüksekliği hedefin dışında (${input.lufs.toFixed(1)} LUFS, hedef ${LOUDNESS_TARGET})`,
    );
  if (input.blackSeconds > 0)
    problems.push(`siyah kare var (${input.blackSeconds.toFixed(2)} sn)`);
  return problems;
}
