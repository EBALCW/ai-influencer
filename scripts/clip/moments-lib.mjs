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

/** Sondan atlanacak süre için varsayılan: yayının %5'i, en çok 2 dakika. */
export function defaultSkipEnd(durationSeconds) {
  if (!(durationSeconds > 0)) return 0;
  return Math.min(120, Math.round(durationSeconds * 0.05));
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
 * Ham ses (s16le, mono) parçalarından RMS biriktirir. Parça sınırı örneğin ortasına denk
 * gelebilir; artan bayt bir sonraki parçaya taşınır. `series()` saniyelik diziyi (an puanı),
 * `fine()` saniyede `binsPerSecond` dilimlik diziyi (cümle arası sessizlikleri bulmak için) verir.
 */
export function createLoudnessMeter(sampleRate, binsPerSecond = 1) {
  const sums = [];
  const counts = [];
  let index = 0;
  let carry = null;
  const rms = (perBin) => {
    if (sums.length === 0) return null;
    const out = new Float64Array(Math.ceil(sums.length / perBin));
    for (let i = 0; i < out.length; i++) {
      let sum = 0;
      let n = 0;
      for (
        let b = i * perBin;
        b < Math.min(sums.length, (i + 1) * perBin);
        b++
      ) {
        sum += sums[b] ?? 0;
        n += counts[b] ?? 0;
      }
      out[i] = n ? Math.sqrt(sum / n) : 0;
    }
    return out;
  };
  return {
    push(chunk) {
      let buffer = chunk;
      if (carry) {
        buffer = Buffer.concat([carry, chunk]);
        carry = null;
      }
      const usable = buffer.length - (buffer.length % 2);
      for (let i = 0; i < usable; i += 2) {
        const bin = Math.floor((index * binsPerSecond) / sampleRate);
        const sample = buffer.readInt16LE(i) / 32768;
        sums[bin] = (sums[bin] ?? 0) + sample * sample;
        counts[bin] = (counts[bin] ?? 0) + 1;
        index++;
      }
      if (usable < buffer.length) carry = buffer.subarray(usable);
    },
    series: () => rms(binsPerSecond),
    fine: () => rms(1),
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
  {
    top = 10,
    length = 40,
    duration,
    size = BUCKET_SECONDS,
    skipStart = 0,
    skipEnd = 0,
    spacing = length,
  },
) {
  const order = Array.from(score.keys()).sort((a, b) => score[b] - score[a]);
  const picked = [];
  for (const bucket of order) {
    if (picked.length >= top || !(score[bucket] > 0)) break;
    const peak = bucket * size + size / 2;
    if (peak < skipStart) continue;
    // Yayın sonu: jenerik, veda ekranı, 'yayın bitti' kartı sık sık tekrar izlenir ama klip olmaz
    if (duration != null && skipEnd > 0 && peak > duration - skipEnd) continue;
    if (picked.some((m) => Math.abs(m.peak - peak) < spacing)) continue;
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

/**
 * Kova çözünürlüğündeki (5 sn) zirveyi, kovanın içindeki en yüksek sesli saniyeye indirir:
 * sınırlar ve "zirve klibin neresinde" ölçümü bu ana göre hesaplanır.
 */
export function refinePeak(peak, audio, size = BUCKET_SECONDS) {
  if (!audio) return peak;
  const from = Math.max(0, Math.floor(peak - size / 2));
  const to = Math.min(audio.length, Math.ceil(peak + size / 2));
  let best = -1;
  for (let s = from; s < to; s++)
    if (best < 0 || audio[s] > audio[best]) best = s;
  return best < 0 ? peak : best + 0.5;
}

/** Aralıktaki altyazı satırlarını tek metinde toplar (uzunsa kırpar). */
export function transcriptFor(cues, start, end, limit = 280) {
  const text = cues
    .filter((cue) => cue.end > start && cue.start < end)
    .map((cue) => cue.text)
    .join(' ');
  return text.length > limit ? text.slice(0, limit - 1) + '…' : text;
}

// ---------------------------------------------------------------------------
// İçeriğe duyarlı sınırlar ve kalite kontrolü
// ---------------------------------------------------------------------------

export const CLIP_MIN_SECONDS = 15;
export const CLIP_MAX_SECONDS = 60;
// İnce ses dizisinin çözünürlüğü: saniyede 4 dilim (0,25 sn) cümle arası duraklamayı yakalar.
export const FINE_BINS_PER_SECOND = 4;

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const round1 = (value) => Math.round(value * 10) / 10;
const round2 = (value) => Math.round(value * 100) / 100;

function slice(series, from, to, perSecond = 1) {
  if (!series) return [];
  const a = clamp(Math.floor(from * perSecond), 0, series.length);
  const b = clamp(Math.ceil(to * perSecond), 0, series.length);
  return series.subarray(a, b);
}

const mean = (values) =>
  values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;

/**
 * "Sessiz" sayılacak düzey: ortam gürültüsünün (en sessiz %10'luk dilim) iki katı, ama olağan
 * düzeyin (ortanca) %30'undan az, yarısından çok olamaz. Arkada sürekli müzik ya da oyun sesi
 * olan yayında çok az dilim bunun altına iner; o zaman sınırlar altyazıdan bulunur.
 */
export function silenceThreshold(fine) {
  if (!fine) return 0;
  const audible = Float64Array.from(fine.filter((v) => v > 0)).sort();
  if (audible.length === 0) return 0;
  const mid = audible[audible.length >> 1];
  const floor = audible[Math.floor(audible.length * 0.1)];
  return clamp(floor * 2, mid * 0.3, mid * 0.5);
}

/**
 * Klibin başlayıp bitebileceği doğal duraklar: {from, to, strength, kind}. Klip `to` anında
 * başlayabilir (duraklamanın bitişi), `from` anında bitebilir (duraklamanın başı).
 *   cümle          → altyazı satırı nokta/soru/ünlemle bitiyor (elle yazılmış altyazı)
 *   altyazı boşluğu → iki satır arasında konuşmasız aralık
 *   sessizlik      → ses en az yarım saniye eşiğin altında
 * Yalnız [from, to] penceresine bakar: saatlerce süren yayında aday başına küçük bir iş.
 */
export function findBreaks({
  cues = [],
  fine = null,
  from,
  to,
  threshold = silenceThreshold(fine),
  perSecond = FINE_BINS_PER_SECOND,
}) {
  const out = [];
  for (let i = 0; i < cues.length - 1; i++) {
    const prev = cues[i];
    const next = cues[i + 1];
    if (next.start < from) continue;
    if (prev.start > to) break;
    const prevEnd = prev.spokenEnd ?? prev.end;
    const gap = next.start - prevEnd;
    const sentence = /[.!?…]["'”’)\]]*$/.test(prev.text);
    if (sentence || gap >= 0.6)
      out.push({
        from: Math.min(prevEnd, next.start),
        to: next.start,
        strength: sentence ? 1.5 : Math.min(1.5, gap),
        kind: sentence ? 'cümle' : 'altyazı boşluğu',
      });
  }
  if (fine && threshold > 0) {
    const first = clamp(Math.floor(from * perSecond), 0, fine.length);
    const last = clamp(Math.ceil(to * perSecond), 0, fine.length);
    let run = -1;
    for (let i = first; i <= last; i++) {
      const quiet = i < last && fine[i] < threshold;
      if (quiet && run < 0) run = i;
      else if (!quiet && run >= 0) {
        const seconds = (i - run) / perSecond;
        if (seconds >= 0.5)
          out.push({
            from: run / perSecond,
            to: i / perSecond,
            strength: Math.min(2, seconds),
            kind: 'sessizlik',
          });
        run = -1;
      }
    }
  }
  return out.sort((a, b) => a.from - b.from);
}

/**
 * Tepkinin söndüğü an: zirveden sonra ses ve sohbet, çevrenin olağan düzeyine geri düşer.
 * Bilgi taşımayan sinyal (zirvesi çevresinden belirgin yüksek olmayan) yok sayılır; hiçbiri
 * bilgi taşımıyorsa ya da `until` anına kadar sönmediyse null döner.
 * @param {{peak:number, audio?:Float64Array|null, chat?:Float64Array|null, until:number}} input saniyelik diziler
 */
export function reactionEnd({ peak, audio = null, chat = null, until }) {
  const informative = [];
  for (const [series, after] of [
    [audio, 3],
    [chat, 8],
  ]) {
    if (!series) continue;
    const around = slice(series, peak - 45, peak + 45);
    if (around.length === 0) continue;
    const base = median(around);
    const top = Math.max(...slice(series, peak - 3, peak + after));
    if (!(top > base * 1.3) || !(top > 0)) continue;
    informative.push({ series, limit: base + 0.3 * (top - base) });
  }
  if (informative.length === 0) return null;
  for (let t = Math.ceil(peak) + 2; t <= until; t++)
    if (
      informative.every(
        ({ series, limit }) => mean(slice(series, t, t + 2)) <= limit,
      )
    )
      return t;
  return null;
}

/**
 * Zirve çevresinde klip aralığı: başlangıç bir cümlenin/sözün başına, bitiş tepki söndükten
 * sonraki ilk durağa çekilir. `target` hedef süredir; sonuç her zaman [min, max] içinde kalır.
 * Uygun durak yoksa eski sabit pencere kullanılır ve ilgili `…Kind` null döner
 * (kalite raporu bunu "cümle ortası olabilir" diye işaretler).
 */
export function snapClip({
  peak,
  target = 40,
  min = CLIP_MIN_SECONDS,
  max = CLIP_MAX_SECONDS,
  duration = null,
  breaks = [],
  decay = null,
}) {
  const length = clamp(target, min, max);
  const limit = duration ?? Infinity;
  const idealStart = Math.max(0, peak - length * 0.65);
  let start = idealStart;
  let startKind = idealStart === 0 ? 'video başı' : null;
  let best = null;
  for (const b of breaks) {
    // Zirveden önce kurulum kalsın (hedef sürenin %30'u, en az 3 sn); en fazla max'ın %80'i geriye git
    if (b.to > peak - Math.max(3, length * 0.3) || b.to < peak - max * 0.8)
      continue;
    const cost = Math.abs(b.to - idealStart) / (length * 0.25) - b.strength;
    if (!best || cost < best.cost) best = { cost, b };
  }
  if (best) {
    // Sözün ilk hecesi kırpılmasın diye duraklamanın içinden başla
    start = Math.max(0, best.b.to - Math.min(0.15, best.b.to - best.b.from));
    startKind = best.b.kind;
  }

  const earliest = Math.max(start + min, peak + 1.5);
  const latest = Math.min(start + max, limit);
  // Vuruştan sonra tepkiye yer kalsın: viral örneklerde vuruş klibin ortanca %63'ünde
  const idealEnd = clamp(
    decay == null
      ? start + length
      : Math.max(decay + 1.5, peak + length * 0.25),
    Math.min(earliest, latest),
    latest,
  );
  let end = idealEnd;
  let endKind = idealEnd >= limit ? 'video sonu' : null;
  best = null;
  for (const b of breaks) {
    if (b.from < earliest || b.from > latest) continue;
    // Erken bitirmek (vuruşu kesmek) geç bitirmekten pahalıdır
    const off = b.from - idealEnd;
    if (off > 8 || off < -4) continue;
    const cost = (off >= 0 ? off / 6 : -off / 3) - b.strength;
    if (!best || cost < best.cost) best = { cost, b };
  }
  if (best) {
    end = Math.min(
      latest,
      best.b.from + Math.min(0.35, best.b.to - best.b.from),
    );
    endKind = best.b.kind;
  }
  return {
    start: round1(start),
    end: round1(Math.max(end, start + Math.min(min, limit - start))),
    startKind,
    endKind,
  };
}

/** Bir sınırın (başlangıç ya da bitiş) doğal bir durağa denk gelip gelmediği. */
export function boundaryKind(time, side, breaks, duration = null) {
  if (side === 'start' && time <= 0.2) return 'video başı';
  if (side === 'end' && duration != null && time >= duration - 0.5)
    return 'video sonu';
  const hit = breaks.find((b) => time >= b.from - 0.4 && time <= b.to + 0.4);
  return hit ? hit.kind : null;
}

/** Satırın ekranda değil, söylenirken geçen süresi: bir sonraki satır başlayınca biter. */
function spokenCues(cues, start, end) {
  const out = [];
  for (let i = 0; i < cues.length; i++) {
    const cue = cues[i];
    if (cue.start >= end) break;
    const stop = Math.min(
      cue.spokenEnd ?? cue.end,
      cues[i + 1]?.start ?? Infinity,
    );
    if (stop <= start) continue;
    out.push({
      start: cue.start,
      end: Math.max(stop, cue.start + 0.2),
      text: cue.text,
    });
  }
  return out;
}

/**
 * ffmpeg'den gelen küçük gri karelerden (genişlik×yükseklik bayt) görüntü ölçümleri biriktirir:
 *   motion      → ardışık kareler arası ortalama piksel farkı (0-255)
 *   staticRatio → neredeyse hiç değişmeyen kare çiftlerinin payı (donuk görüntü, sabit kart)
 *   flatRatio   → karenin tek bir tona yakın piksellerinin payı, karelerin ortancası
 *                 (düz zemin üstünde yazı: jenerik, "birazdan başlıyoruz", "yayın bitti")
 *   blackRatio  → neredeyse tamamen siyah karelerin payı
 *   scrollRatio → görüntünün sabit hızla dikey kaydığı kare çiftlerinin payı (akan jenerik:
 *                 kare, bir öncekinin birkaç satır kaydırılmış hâliyle neredeyse aynıdır)
 */
export function createFrameMeter(width, height) {
  const size = width * height;
  const maxShift = Math.max(2, Math.round(height / 6));
  let carry = Buffer.alloc(0);
  let previous = null;
  const diffs = [];
  const flats = [];
  let black = 0;
  let up = 0;
  let down = 0;
  // Önceki karenin `shift` satır kaydırılmış hâliyle ortalama fark (sütunlar ikişer atlanır)
  const shifted = (pixels, shift) => {
    let sum = 0;
    let n = 0;
    const from = Math.max(0, shift);
    const to = Math.min(height, height + shift);
    for (let y = from; y < to; y++) {
      const row = y * width;
      const other = (y - shift) * width;
      for (let x = 0; x < width; x += 2) {
        sum += Math.abs(pixels[row + x] - previous[other + x]);
        n++;
      }
    }
    return sum / n;
  };
  const frame = (pixels) => {
    const histogram = new Uint32Array(32);
    let sum = 0;
    let diff = 0;
    for (let i = 0; i < size; i++) {
      const v = pixels[i];
      sum += v;
      histogram[v >> 3]++;
      if (previous) diff += Math.abs(v - previous[i]);
    }
    let mode = 0;
    for (let b = 1; b < 32; b++) if (histogram[b] > histogram[mode]) mode = b;
    const near =
      histogram[mode] + (histogram[mode - 1] ?? 0) + (histogram[mode + 1] ?? 0);
    flats.push(near / size);
    if (sum / size < 20 && near / size > 0.9) black++;
    if (previous) {
      diffs.push(diff / size);
      if (diff / size > 1.5) {
        const still = shifted(pixels, 0);
        let best = 0;
        let bestDiff = still;
        for (let k = -maxShift; k <= maxShift; k++) {
          if (k === 0) continue;
          const d = shifted(pixels, k);
          if (d < bestDiff) {
            bestDiff = d;
            best = k;
          }
        }
        if (bestDiff < still * 0.5) {
          if (best < 0) up++;
          else down++;
        }
      }
    }
    previous = Buffer.from(pixels);
  };
  return {
    push(chunk) {
      const buffer = carry.length ? Buffer.concat([carry, chunk]) : chunk;
      let offset = 0;
      for (; offset + size <= buffer.length; offset += size)
        frame(buffer.subarray(offset, offset + size));
      carry = buffer.subarray(offset);
    },
    result() {
      if (flats.length === 0) return null;
      return {
        frames: flats.length,
        motion: round2(mean(diffs)),
        staticRatio: round2(
          diffs.length ? diffs.filter((d) => d < 0.6).length / diffs.length : 1,
        ),
        flatRatio: round2(median(flats)),
        blackRatio: round2(black / flats.length),
        scrollRatio: round2(
          diffs.length ? Math.max(up, down) / diffs.length : 0,
        ),
      };
    },
  };
}

// Ses etiketleyicinin (AudioSet sınıfları) izlenen grupları: grup olasılığı = sınıfların en yükseği
export const TAG_GROUPS = {
  music: ['Music'],
  speech: ['Speech'],
  laughter: [
    'Laughter',
    'Giggle',
    'Belly laugh',
    'Chuckle, chortle',
    'Snicker',
  ],
  shout: ['Shout', 'Yell', 'Screaming', 'Whoop', 'Bellow'],
  crowd: ['Cheering', 'Applause', 'Crowd'],
};

/**
 * Klibin 4 sn'lik pencerelerinden gelen etiket olasılıklarını ({ad: olasılık}) özetler:
 * müzik ve konuşma için ortalama (klibin geneli), gülme/bağırma/kalabalık için en yüksek (an).
 */
export function summarizeTags(windows) {
  if (!windows || windows.length === 0) return null;
  const group = (probabilities, names) =>
    Math.max(0, ...names.map((name) => probabilities[name] ?? 0));
  const per = windows.map((probabilities) =>
    Object.fromEntries(
      Object.entries(TAG_GROUPS).map(([key, names]) => [
        key,
        group(probabilities, names),
      ]),
    ),
  );
  const out = {};
  for (const key of Object.keys(TAG_GROUPS)) {
    const values = per.map((p) => p[key]);
    out[key] = round2(
      key === 'music' || key === 'speech' ? mean(values) : Math.max(...values),
    );
  }
  return out;
}

export const QUALITY_WEIGHTS = {
  kanca: 0.2,
  konusma: 0.15,
  sinirlar: 0.15,
  vurus: 0.1,
  tepki: 0.2,
  akis: 0.05,
  goruntu: 0.15,
};
export const VERDICTS = ['güçlü', 'orta', 'zayıf', 'ele'];

/**
 * Bir adayın ölçülebilir kalite raporu. Anlamı (komik mi, anlaşılıyor mu) ölçemez; yalnız
 * klibi kesin bozan durumları eler ve agent'ın anlam değerlendirmesine sayı verir.
 * Ölçülemeyen parça (ör. altyazı yoksa konuşma) null kalır ve puana girmez.
 * @param {object} input start/end/peak saniye; cues tüm videonun satırları (boşsa konuşma bilinmiyor);
 *   fine ince ses dizisi; chat saniyelik sohbet dizisi; chatPeak zirvenin ölçekli sohbet değeri (0-6);
 *   visual createFrameMeter().result(); startKind/endKind sınırın oturduğu durak ya da null;
 *   tags summarizeTags() çıktısı (ses etiketleyici kuruluysa).
 */
export function assessClip({
  start,
  end,
  peak,
  cues = [],
  fine = null,
  perSecond = FINE_BINS_PER_SECOND,
  threshold = silenceThreshold(fine),
  chat = null,
  chatMean = null,
  chatPeak = null,
  visual = null,
  tags = null,
  startKind = null,
  endKind = null,
}) {
  const seconds = end - start;
  const hasSpeechData = cues.length > 0;
  const spoken = hasSpeechData ? spokenCues(cues, start, end) : [];
  const metrics = { seconds: round1(seconds) };

  // Konuşma
  if (hasSpeechData) {
    let covered = 0;
    let hookWords = 0;
    for (const cue of spoken) {
      const a = Math.max(cue.start, start);
      const b = Math.min(cue.end, end);
      covered += Math.max(0, b - a);
      const words = cue.text.split(/\s+/).filter(Boolean).length;
      const inHook = Math.min(cue.end, start + 3) - a;
      if (inHook > 0) hookWords += (words * inHook) / (cue.end - cue.start);
    }
    metrics.speechCoverage = round2(clamp(covered / seconds, 0, 1));
    metrics.hookWords = Math.round(hookWords);
    metrics.firstSpeechAt = spoken.length
      ? round1(Math.max(0, spoken[0].start - start))
      : null;
    const cutsInto = (time) =>
      spoken.some((cue) => time > cue.start + 0.5 && time < cue.end - 0.3);
    metrics.startsMidSentence = !startKind && cutsInto(start);
    metrics.endsMidSentence = !endKind && cutsInto(end);
  }
  metrics.startBoundary = startKind;
  metrics.endBoundary = endKind;
  metrics.peakPosition = round2(clamp((peak - start) / seconds, 0, 1));

  // Ses
  if (fine) {
    const inside = slice(fine, start, end, perSecond);
    const level = median(inside.length ? inside : [0]);
    metrics.silenceRatio = round2(
      inside.length && threshold > 0
        ? inside.filter((v) => v < threshold).length / inside.length
        : 0,
    );
    const before = slice(fine, start, Math.max(start + 1, peak - 3), perSecond);
    const base = median(before.length ? before : [0]);
    const top = Math.max(0, ...slice(fine, peak - 2.5, peak + 2.5, perSecond));
    metrics.loudnessJumpDb =
      top > 0
        ? round1(clamp(20 * Math.log10(top / Math.max(base, 1e-5)), -30, 30))
        : null;
    const opening = mean(slice(fine, start, start + 2, perSecond));
    metrics.hookLoudness = level > 0 ? round2(opening / level) : null;
  }

  // Sohbet
  if (chat) {
    const density = mean(slice(chat, start, end));
    metrics.chatDensity = chatMean > 0 ? round1(density / chatMean) : null;
    metrics.chatPeak = chatPeak;
  }
  if (visual) Object.assign(metrics, visual);
  if (tags) metrics.tags = tags;

  // Alt puanlar (0-1)
  const parts = {};
  const loudHook =
    metrics.hookLoudness == null ? null : clamp(metrics.hookLoudness, 0, 1);
  const wordHook = hasSpeechData ? clamp(metrics.hookWords / 8, 0, 1) : null;
  parts.kanca =
    wordHook != null && loudHook != null
      ? 0.6 * wordHook + 0.4 * loudHook
      : (wordHook ?? loudHook);
  parts.konusma = hasSpeechData
    ? clamp(metrics.speechCoverage / 0.6, 0, 1)
    : null;
  parts.sinirlar = hasSpeechData
    ? 1 -
      (metrics.startsMidSentence ? 0.5 : startKind ? 0 : 0.15) -
      (metrics.endsMidSentence ? 0.5 : endKind ? 0 : 0.15)
    : fine
      ? (startKind ? 0.5 : 0.25) + (endKind ? 0.5 : 0.25)
      : null;
  const position = metrics.peakPosition;
  parts.vurus =
    position < 0.45
      ? clamp(0.3 + ((position - 0.15) / 0.3) * 0.7, 0.1, 1)
      : position <= 0.88
        ? 1
        : clamp(1 - ((position - 0.88) / 0.12) * 0.6, 0.4, 1);
  const jump =
    metrics.loudnessJumpDb == null
      ? null
      : clamp(metrics.loudnessJumpDb / 15, 0, 1);
  const crowd = chatPeak == null ? null : clamp(chatPeak / 4, 0, 1);
  parts.tepki =
    jump == null && crowd == null ? null : Math.max(jump ?? 0, crowd ?? 0);
  parts.akis =
    metrics.silenceRatio == null
      ? null
      : 1 - clamp((metrics.silenceRatio - 0.15) / 0.45, 0, 1);
  parts.goruntu = visual
    ? 1 -
      Math.max(
        clamp((visual.flatRatio - 0.5) / 0.4, 0, 1),
        clamp((visual.staticRatio - 0.5) / 0.45, 0, 1),
        clamp(visual.scrollRatio / 0.5, 0, 1),
        visual.blackRatio,
      )
    : null;

  let total = 0;
  let weight = 0;
  for (const [name, value] of Object.entries(parts)) {
    if (value == null) continue;
    parts[name] = round2(value);
    total += QUALITY_WEIGHTS[name] * value;
    weight += QUALITY_WEIGHTS[name];
  }
  const score = weight > 0 ? Math.round((total / weight) * 100) : 0;

  // Gerekçeler: önce eleme sebepleri, sonra zayıf yanlar, sonra güçlü yanlar
  const reject = [];
  const noSpeech = !hasSpeechData || metrics.speechCoverage < 0.3;
  if (visual?.blackRatio >= 0.5)
    reject.push('görüntünün yarısından fazlası siyah');
  if (visual && noSpeech && visual.scrollRatio >= 0.5)
    reject.push(
      'görüntü sabit hızla yukarı/aşağı kayıyor, konuşma yok (akan jenerik)',
    );
  if (visual && noSpeech && visual.flatRatio >= 0.8)
    reject.push(
      'düz zemin üstünde yazı/kart, konuşma yok (jenerik ya da bekleme ekranı görünümü)',
    );
  if (visual && noSpeech && visual.staticRatio >= 0.85)
    reject.push('görüntü neredeyse hiç değişmiyor, konuşma yok (donuk ekran)');
  if (metrics.silenceRatio >= 0.7) reject.push('klibin çoğu sessiz');
  // Müzik baskın, konuşma geri planda: çalan/söylenen şarkı. Telifli müzik klibe girmez
  if (tags && tags.music >= 0.6 && tags.speech < 0.4)
    reject.push(
      'müzik baskın, konuşma yok (çalan şarkı: telif/Content ID riski; müzik kaynağın kendisine aitse "keep" ile geri al)',
    );

  const weak = [];
  const strong = [];
  if (hasSpeechData) {
    if (metrics.startsMidSentence) weak.push('cümle ortasında başlıyor');
    if (metrics.endsMidSentence) weak.push('cümle ortasında bitiyor');
    if (metrics.hookWords === 0)
      weak.push(
        metrics.firstSpeechAt == null
          ? 'klipte konuşma yok'
          : `ilk 3 sn'de söz yok (konuşma ${metrics.firstSpeechAt}. sn'de başlıyor)`,
      );
    else if (metrics.hookWords >= 5) strong.push("ilk 3 sn'de söz var");
    if (metrics.speechCoverage < 0.3 && metrics.firstSpeechAt != null)
      weak.push(`konuşma az (%${Math.round(metrics.speechCoverage * 100)})`);
  } else weak.push('altyazı yok: konuşma ve cümle sınırı ölçülemedi');
  if (position < 0.3) weak.push('zirve çok başta: kurulum eksik olabilir');
  if (position > 0.93) weak.push('zirve en sonda: tepki kesilmiş olabilir');
  if (parts.tepki != null && parts.tepki < 0.25)
    weak.push('zirvede belirgin tepki yok (ses sıçramıyor, sohbet hareketsiz)');
  else if (parts.tepki >= 0.7)
    strong.push(
      crowd != null && crowd >= (jump ?? 0)
        ? 'sohbet zirvede patlıyor'
        : `zirvede ses sıçraması (+${metrics.loudnessJumpDb} dB)`,
    );
  if (metrics.silenceRatio >= 0.4 && metrics.silenceRatio < 0.7)
    weak.push(`sessizlik fazla (%${Math.round(metrics.silenceRatio * 100)})`);
  if (tags) {
    if (tags.music >= 0.35 && !(tags.music >= 0.6 && tags.speech < 0.4))
      weak.push('arkada müzik var (telif riskini kontrol et)');
    if (tags.laughter >= 0.15) strong.push('gülme sesi var');
    if (tags.shout >= 0.15) strong.push('bağırma/çığlık var');
    if (tags.crowd >= 0.4)
      strong.push('kalabalık tepkisi var (alkış/tezahürat)');
  }
  if (visual && reject.length === 0) {
    if (visual.staticRatio >= 0.7) weak.push('görüntü durağan');
    if (visual.flatRatio >= 0.75) weak.push('görüntü düz zeminli (slayt/kart)');
  }

  const verdict =
    reject.length > 0
      ? 'ele'
      : score >= 80
        ? 'güçlü'
        : score >= 60
          ? 'orta'
          : 'zayıf';
  return {
    score,
    verdict,
    reasons: [...reject, ...weak, ...strong],
    parts,
    metrics,
  };
}

/** Aday için okunacak transkript: klip satırları ve `context` saniyelik öncesi/sonrası. */
export function contextTranscript(cues, start, end, context = 10) {
  return cues
    .filter((cue) => cue.end > start - context && cue.start < end + context)
    .map((cue) => ({
      at: cue.start,
      inside: cue.start >= start - 0.3 && cue.start < end,
      text: cue.text,
    }));
}

export const DECISIONS = ['keep', 'drop'];

/**
 * Agent'ın/kullanıcının aday başına kararları (clips/kararlar.json) doğrulanır.
 * Biçim: { "candidates": { "2": { "peak": "12:50", "decision": "keep"|"drop"|null,
 *   "shiftStart": -4, "shiftEnd": 3, "caption": "üst yazı", "title": "başlık", "note": "…" } } }
 * `peak` aday listesinin değişmediğini doğrular: sıra numarası başka bir ana kaymışsa hata.
 */
export function parseDecisions(data, moments) {
  const out = new Map();
  const entries = data?.candidates;
  if (entries == null) return out;
  if (typeof entries !== 'object' || Array.isArray(entries))
    throw new Error('kararlar.json: "candidates" bir nesne olmalı.');
  for (const [key, value] of Object.entries(entries)) {
    const rank = Number(key);
    const moment = moments.find((m) => m.rank === rank);
    if (!moment) throw new Error(`kararlar.json: ${key} numaralı aday yok.`);
    if (value?.peak != null && value.peak !== moment.peak)
      throw new Error(
        `kararlar.json: ${key}. adayın zirvesi değişmiş (${value.peak} → ${moment.peak}). Aday listesi farklı seçeneklerle yeniden üretilmiş; kararları yeni listeye göre güncelle ya da dosyayı sil.`,
      );
    const shift = (name) => {
      const n = value?.[name] ?? 0;
      if (typeof n !== 'number' || !(Math.abs(n) <= 60))
        throw new Error(
          `kararlar.json: ${key}. aday için ${name} -60 ile 60 arasında saniye olmalı.`,
        );
      return n;
    };
    const decision = value?.decision ?? null;
    if (decision !== null && !DECISIONS.includes(decision))
      throw new Error(
        `kararlar.json: ${key}. aday için decision "keep", "drop" ya da null olmalı.`,
      );
    const text = (name, max) => {
      const t = String(value?.[name] ?? '').trim();
      if (t.length > max)
        throw new Error(
          `kararlar.json: ${key}. aday için ${name} en çok ${max} karakter olabilir.`,
        );
      return t;
    };
    out.set(rank, {
      decision,
      shiftStart: shift('shiftStart'),
      shiftEnd: shift('shiftEnd'),
      caption: text('caption', 60),
      title: text('title', 100),
      note: text('note', 300),
    });
  }
  return out;
}

/** İnce ses dizisinden (saniyede `perSecond` dilim) saniyelik RMS dizisi. */
export function coarsen(fine, perSecond = FINE_BINS_PER_SECOND) {
  const out = new Float64Array(Math.ceil(fine.length / perSecond));
  for (let i = 0; i < out.length; i++) {
    let sum = 0;
    let n = 0;
    for (
      let b = i * perSecond;
      b < Math.min(fine.length, (i + 1) * perSecond);
      b++
    ) {
      sum += fine[b] * fine[b];
      n++;
    }
    out[i] = n ? Math.sqrt(sum / n) : 0;
  }
  return out;
}
