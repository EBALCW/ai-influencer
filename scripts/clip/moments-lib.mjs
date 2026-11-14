// Uzun bir yayında "en çok izlenecek" anları bulmak için saf mantık (dosya/süreç yok).
// Üç sinyal saniye çözünürlüğünde diziye çevrilir, ortak ölçeğe getirilir ve birleştirilir:
//   replay → YouTube "most replayed" ısı haritası (izleyicinin geri sarıp izlediği yerler)
//   chat   → canlı sohbet tekrarında mesaj hızı + gülme/şaşırma tepkileri
//   audio  → ses zirveleri (bağırma, kahkaha)
// Testler: moments-lib.test.mjs.

export const BUCKET_SECONDS = 5;
// Sohbet olaydan sonra tepki verir (yazma + yayın gecikmesi); sinyal bu kadar geri kaydırılır.
export const CHAT_LAG_SECONDS = 8;
export const WEIGHTS = { replay: 0.4, chat: 0.35, audio: 0.25 };

// Tepki sözcükleri mesajı 3 kat sayar: sıradan sohbet değil, "bir şey oldu" işareti.
const REACTION =
  /\b(lo+l|lmf?a+o+|rofl|kekw|omegalul|lul|ha(ha)+|ah(ah)+|jaja+|wtf+|omg+|no way|bro+|clip( it| that)?|w+|l+|sheesh|ayo+|dead|crying|insane|crazy)\b|[😂🤣💀😭😱🔥]/iu;

/**
 * Yayın süresine göre kaç klip çıkarılacağı: her 10 dakikaya bir klip, en az 3, en çok 15.
 * Kısa videodan çok klip zayıf anları da alır; saatlerce süren yayında 15 seçim için yeter.
 */
export function clipCountFor(durationSeconds) {
  if (!(durationSeconds > 0)) return 3;
  return Math.min(15, Math.max(3, Math.round(durationSeconds / 600)));
}

/** yt-dlp info.json → heatmap [{start_time,end_time,value}] → saniye başına değer (0-1). */
export function replaySeries(heatmap, duration) {
  if (!Array.isArray(heatmap) || heatmap.length === 0) return null;
  const series = new Float64Array(Math.ceil(duration));
  for (const part of heatmap) {
    const from = Math.max(0, Math.floor(part.start_time));
    const to = Math.min(series.length, Math.ceil(part.end_time));
    for (let s = from; s < to; s++) series[s] = part.value;
  }
  return series;
}

function chatText(item) {
  const renderer =
    item?.liveChatTextMessageRenderer ?? item?.liveChatPaidMessageRenderer;
  return (renderer?.message?.runs ?? [])
    .map((run) => run.text ?? run.emoji?.emojiId ?? '')
    .join('');
}

/**
 * yt-dlp `.live_chat.json` (satır başına bir JSON) → saniye başına ağırlıklı mesaj sayısı.
 * Satır satır beslenir: saatlerce süren yayının sohbeti yüzlerce MB olabilir, belleğe alınmaz.
 * Bozuk satır atlanır; tek satır işi durdurmamalı.
 */
export function createChatCounter(duration) {
  const series = new Float64Array(Math.ceil(duration));
  let messages = 0;
  return {
    push(line) {
      if (!line) return;
      let replay;
      try {
        replay = JSON.parse(line).replayChatItemAction;
      } catch {
        return;
      }
      const offset = Number(replay?.videoOffsetTimeMsec);
      if (!Number.isFinite(offset) || offset < 0) return;
      for (const action of replay.actions ?? []) {
        const item = action.addChatItemAction?.item;
        if (!item) continue;
        const second = Math.floor(offset / 1000) - CHAT_LAG_SECONDS;
        if (second < 0 || second >= series.length) continue;
        series[second] += REACTION.test(chatText(item)) ? 3 : 1;
        messages++;
      }
    },
    messages: () => messages,
    series: () => (messages > 0 ? series : null),
  };
}

export function chatSeries(lines, duration) {
  const counter = createChatCounter(duration);
  for (const line of lines) counter.push(line);
  return counter.series();
}

/**
 * Ham ses (s16le, mono) parçalarından saniye başına RMS biriktirir. Parça sınırı
 * örneğin ortasına denk gelebilir; artan bayt bir sonraki parçaya taşınır.
 */
export function createLoudnessMeter(sampleRate) {
  const sums = [];
  const counts = [];
  let index = 0;
  let carry = null;
  return {
    push(chunk) {
      let buffer = chunk;
      if (carry) {
        buffer = Buffer.concat([carry, chunk]);
        carry = null;
      }
      const usable = buffer.length - (buffer.length % 2);
      for (let i = 0; i < usable; i += 2) {
        const second = Math.floor(index / sampleRate);
        const sample = buffer.readInt16LE(i) / 32768;
        sums[second] = (sums[second] ?? 0) + sample * sample;
        counts[second] = (counts[second] ?? 0) + 1;
        index++;
      }
      if (usable < buffer.length) carry = buffer.subarray(usable);
    },
    series() {
      if (sums.length === 0) return null;
      return Float64Array.from(sums, (sum, i) => Math.sqrt(sum / counts[i]));
    },
  };
}

/** Saniyelik diziyi `size` saniyelik kovalara böler (kova = ortalama). */
export function bucketize(series, size = BUCKET_SECONDS) {
  const out = new Float64Array(Math.ceil(series.length / size));
  for (let b = 0; b < out.length; b++) {
    let sum = 0;
    let n = 0;
    for (let s = b * size; s < Math.min(series.length, (b + 1) * size); s++) {
      sum += series[s];
      n++;
    }
    out[b] = n ? sum / n : 0;
  }
  return out;
}

function median(values) {
  const sorted = Float64Array.from(values).sort();
  const mid = sorted.length >> 1;
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/**
 * Ortanca ve MAD ile ölçekler: birkaç dev zirve ortalamayı bozmasın, sessiz geçen uzun
 * yayında küçük ama gerçek sıçramalar kaybolmasın. Sonuç 0-6 aralığına kırpılır
 * (tek bir sinyal toplamı tek başına belirlemesin). Düz sinyal sıfır döner.
 */
export function robustScale(series) {
  const mid = median(series);
  const spread = median(series.map((v) => Math.abs(v - mid))) * 1.4826;
  const out = new Float64Array(series.length);
  if (!(spread > 0)) {
    // MAD sıfırsa (çoğu kova aynı) standart sapmaya düş; o da sıfırsa sinyal bilgi taşımıyor
    const mean = series.reduce((a, b) => a + b, 0) / (series.length || 1);
    const sd = Math.sqrt(
      series.reduce((a, b) => a + (b - mean) ** 2, 0) / (series.length || 1),
    );
    if (!(sd > 0)) return out;
    for (let i = 0; i < series.length; i++)
      out[i] = Math.min(6, Math.max(0, (series[i] - mean) / sd));
    return out;
  }
  for (let i = 0; i < series.length; i++)
    out[i] = Math.min(6, Math.max(0, (series[i] - mid) / spread));
  return out;
}

/**
 * Sinyalleri birleştirir. Eksik sinyalin ağırlığı kalanlara dağıtılır; böylece puanlar
 * sohbeti olan ve olmayan videolar arasında aynı ölçekte kalır.
 * @param {{replay?: Float64Array|null, chat?: Float64Array|null, audio?: Float64Array|null}} signals saniyelik diziler
 */
export function combine(signals, size = BUCKET_SECONDS) {
  const used = Object.keys(WEIGHTS).filter((name) => signals[name]);
  if (used.length === 0)
    throw new Error(
      'Hiç sinyal yok: ısı haritası, sohbet tekrarı ya da ses gerekli.',
    );
  const total = used.reduce((sum, name) => sum + WEIGHTS[name], 0);
  const scaled = Object.fromEntries(
    used.map((name) => [name, robustScale(bucketize(signals[name], size))]),
  );
  const length = Math.max(...used.map((name) => scaled[name].length));
  const score = new Float64Array(length);
  for (const name of used)
    for (let i = 0; i < scaled[name].length; i++)
      score[i] += (WEIGHTS[name] / total) * scaled[name][i];
  return { score, scaled, used };
}

/**
 * En yüksek kovalardan başlayıp birbirine `length` saniyeden yakın olmayan zirveleri seçer.
 * Klip aralığı zirvenin önüne ağırlık verir: kurulum (olayın öncesi) olmadan tepki anlaşılmaz.
 */
export function pickMoments(
  { score, scaled, used },
  { top = 10, length = 40, duration, size = BUCKET_SECONDS, skipStart = 0 },
) {
  const order = Array.from(score.keys()).sort((a, b) => score[b] - score[a]);
  const picked = [];
  for (const bucket of order) {
    if (picked.length >= top || !(score[bucket] > 0)) break;
    const peak = bucket * size + size / 2;
    if (peak < skipStart) continue;
    if (picked.some((m) => Math.abs(m.peak - peak) < length)) continue;
    let start = Math.max(0, Math.round(peak - length * 0.65));
    let end = start + length;
    if (duration != null && end > duration) {
      end = Math.floor(duration);
      start = Math.max(0, end - length);
    }
    const signals = Object.fromEntries(
      used.map((name) => [
        name,
        Math.round((scaled[name][bucket] ?? 0) * 10) / 10,
      ]),
    );
    picked.push({
      peak,
      start,
      end,
      score: Math.round(score[bucket] * 100) / 100,
      signals,
      // En güçlü sinyal: seçerken "neden burası" sorusunun kısa cevabı
      why: used.reduce((a, b) => (signals[b] > signals[a] ? b : a)),
    });
  }
  return picked.sort((a, b) => b.score - a.score);
}

/** Aralıktaki altyazı satırlarını tek metinde toplar (uzunsa kırpar). */
export function transcriptFor(cues, start, end, limit = 280) {
  const text = cues
    .filter((cue) => cue.end > start && cue.start < end)
    .map((cue) => cue.text)
    .join(' ');
  return text.length > limit ? text.slice(0, limit - 1) + '…' : text;
}
