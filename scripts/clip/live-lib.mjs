// Canlı izleme (pnpm clip:live) için saf mantık: kanal doğrulama, Twitch IRC satırı ayrıştırma,
// çevrimiçi sohbet patlaması tespiti, duvar saati ↔ kayıt konumu eşlemesi, disk bütçesi.
// Dosya sistemi, ağ ve süreç çağrısı yok; hepsi live.mjs içinde. Testler: live-lib.test.mjs.
import { CHAT_LAG_SECONDS, chatWeight } from './moments-lib.mjs';

// ---------------------------------------------------------------------------
// Kanal ve komut argümanları
// ---------------------------------------------------------------------------

const TWITCH_HOSTS = new Set(['twitch.tv', 'www.twitch.tv', 'm.twitch.tv']);
const TWITCH_LOGIN = /^[a-z0-9_]{3,25}$/;

/**
 * "twitch.tv/ad", "https://www.twitch.tv/ad" ya da yalın "ad" → { channel, url }.
 * Kanal adı sıkı doğrulanır: kayıt aracına doğrulanmamış girdi geçmez. v1 yalnız Twitch.
 */
export function parseChannel(input) {
  const text = String(input ?? '').trim();
  let name = text;
  if (/[/.:]/.test(text)) {
    let url;
    try {
      url = new URL(/^https?:\/\//i.test(text) ? text : `https://${text}`);
    } catch {
      throw new Error('Geçerli bir Twitch kanal adresi ver.');
    }
    if (/youtube\.com$|youtu\.be$/i.test(url.hostname))
      throw new Error(
        'YouTube canlı yayını v1 kapsamında değil (hesapsız canlı sohbet yok). Yayın bitince pnpm clip:auto kullan.',
      );
    if (url.protocol !== 'https:' || !TWITCH_HOSTS.has(url.hostname))
      throw new Error(
        'Canlı izleme şimdilik yalnız Twitch kanallarını destekler. Örnek: https://www.twitch.tv/kanaladi',
      );
    const parts = url.pathname.split('/').filter(Boolean);
    if (parts.length !== 1)
      throw new Error(
        'Adres bir kanalı göstermeli (video ya da klip adresi olmaz). Örnek: https://www.twitch.tv/kanaladi',
      );
    name = parts[0];
  }
  const channel = name.toLowerCase();
  if (!TWITCH_LOGIN.test(channel))
    throw new Error(
      'Kanal adı 3-25 karakter olmalı ve yalnız harf, rakam, alt çizgi içerebilir.',
    );
  return { channel, url: `https://www.twitch.tv/${channel}` };
}

/** Oturum klasörünün adı: kanal + yerel tarih. */
export function sessionName(channel, date = new Date()) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${channel}-${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/**
 * streamlink argümanları: yayını standart çıktıya yazar (ffmpeg parçalara böler).
 * --retry-streams: kanal canlı değilse bekler. Kodek h264'te tutulur: h265/av1 istenirse Twitch
 * fMP4 verir, büyürken güvenle okunabilen kap ise MPEG-TS'tir.
 */
export function streamlinkArgs({ channel, quality = 'best', retry = 30 }) {
  if (!TWITCH_LOGIN.test(channel)) throw new Error('Kanal adı geçersiz.');
  if (!/^[a-z0-9_]+(,[a-z0-9_]+)*$/.test(quality))
    throw new Error(
      '--quality streamlink kalite adları ister. Örnek: best ya da 720p60,720p,best',
    );
  return [
    '--loglevel',
    'info',
    '--retry-streams',
    String(retry),
    '--retry-open',
    '3',
    '--twitch-supported-codecs',
    'h264',
    '--stdout',
    `https://www.twitch.tv/${channel}`,
    quality,
  ];
}

export const SEGMENT_PREFIX = 'parca-';
export const segmentName = (index) =>
  `${SEGMENT_PREFIX}${String(index).padStart(5, '0')}.ts`;
export const segmentIndex = (name) => {
  const match = /^parca-(\d{5})\.ts$/.exec(name);
  return match ? Number(match[1]) : null;
};

/**
 * ffmpeg argümanları: standart girdiden gelen MPEG-TS'i yeniden kodlamadan sabit süreli
 * parçalara böler. Zaman damgaları sıfırlanmaz: aynı çalıştırmanın ardışık parçaları bayt bayt
 * uç uca eklenebilir (iki parçaya yayılan aday için).
 */
export function segmentArgs({ segmentSeconds = 600, startNumber = 0 }) {
  if (!(segmentSeconds >= 30 && segmentSeconds <= 3600))
    throw new Error('Parça süresi 30 sn ile 60 dk arasında olmalı.');
  return [
    '-hide_banner',
    '-loglevel',
    'warning',
    '-i',
    'pipe:0',
    '-map',
    '0:v:0?',
    '-map',
    '0:a:0?',
    '-c',
    'copy',
    '-f',
    'segment',
    '-segment_time',
    String(segmentSeconds),
    '-segment_format',
    'mpegts',
    '-segment_start_number',
    String(startNumber),
    '-flush_packets',
    '1',
    `${SEGMENT_PREFIX}%05d.ts`,
  ];
}

/** Yeniden deneme beklemesi (sn): 2, 4, 8 … en çok 60. */
export function backoffSeconds(attempt) {
  return Math.min(60, 2 ** Math.min(6, Math.max(1, attempt)));
}

// ---------------------------------------------------------------------------
// Twitch IRC
// ---------------------------------------------------------------------------

export const IRC_MAX_LINE = 16384;
export const CHAT_MAX_CHARS = 500;

/**
 * Tek bir IRC satırı → { tags, prefix, command, params, trailing }. Bozuk, boş ya da aşırı uzun
 * satır null döner (tek satır akışı durdurmamalı). Etiket değerleri ham bırakılır.
 */
export function parseIrcLine(line) {
  if (typeof line !== 'string' || line.length === 0) return null;
  if (line.length > IRC_MAX_LINE) return null;
  let rest = line.replace(/[\r\n]+$/, '');
  const tags = {};
  if (rest.startsWith('@')) {
    const end = rest.indexOf(' ');
    if (end < 0) return null;
    for (const pair of rest.slice(1, end).split(';')) {
      const eq = pair.indexOf('=');
      if (eq > 0) tags[pair.slice(0, eq)] = pair.slice(eq + 1);
    }
    rest = rest.slice(end + 1).trimStart();
  }
  let prefix = null;
  if (rest.startsWith(':')) {
    const end = rest.indexOf(' ');
    if (end < 0) return null;
    prefix = rest.slice(1, end);
    rest = rest.slice(end + 1).trimStart();
  }
  let trailing = null;
  const colon = rest.indexOf(' :');
  if (colon >= 0) {
    trailing = rest.slice(colon + 2);
    rest = rest.slice(0, colon);
  } else if (rest.startsWith(':')) return null;
  const parts = rest.split(' ').filter(Boolean);
  const command = parts.shift();
  if (!command || !/^([A-Z]+|\d{3})$/.test(command)) return null;
  return { tags, prefix, command, params: parts, trailing };
}

/**
 * Ayrıştırılmış satır → izleyicinin ilgilendiği olay ya da null.
 *   message   → { t, text }: t sunucunun mesajı aldığı an (tmi-sent-ts); etiket yoksa ya da alış
 *               anından 10 dakikadan fazla sapıyorsa alış anı. Kullanıcı adı hiç okunmaz.
 *   ping      → PONG ile aynı metin geri gönderilmeli
 *   reconnect → sunucu bağlantıyı kapatacak; yeniden bağlan
 *   raid      → baskın bildirimi (ardından gelen mesaj seli tepki değildir)
 *   joined    → kanala girildi (sohbet akıyor)
 */
export function chatEvent(parsed, channel, now) {
  if (!parsed) return null;
  const { command, params, trailing, tags } = parsed;
  if (command === 'PING') return { type: 'ping', payload: trailing ?? '' };
  if (command === 'RECONNECT') return { type: 'reconnect' };
  const room = params[0] === `#${channel}`;
  if (command === 'ROOMSTATE' && room) return { type: 'joined' };
  if (command === '366' && params.includes(`#${channel}`))
    return { type: 'joined' };
  const stamp = () => {
    const sent = Number(tags['tmi-sent-ts']);
    return Number.isInteger(sent) && Math.abs(sent - now) < 600_000
      ? sent
      : now;
  };
  if (command === 'USERNOTICE' && room && tags['msg-id'] === 'raid')
    return { type: 'raid', t: stamp() };
  if (command !== 'PRIVMSG' || !room || trailing == null) return null;
  // /me mesajı: \x01ACTION metin\x01
  const text = trailing
    .replace(/^\u0001ACTION ?/, '')
    .replace(/\u0001$/, '')
    .slice(0, CHAT_MAX_CHARS);
  if (!text.trim()) return null;
  return { type: 'message', t: stamp(), text };
}

/** Bağlantı açılınca gönderilecek satırlar: yalnız okuma, hesapsız (justinfan). */
export function ircHandshake(channel, random = Math.random()) {
  if (!TWITCH_LOGIN.test(channel)) throw new Error('Kanal adı geçersiz.');
  return [
    'CAP REQ :twitch.tv/tags twitch.tv/commands',
    `NICK justinfan${10000 + Math.floor(random * 80000)}`,
    `JOIN #${channel}`,
  ];
}

// ---------------------------------------------------------------------------
// Çevrimiçi patlama tespiti
// ---------------------------------------------------------------------------

export const LIVE_DEFAULTS = {
  bucketSeconds: 10,
  // Olağan düzey: son 5 dakikanın ortancası (ortalama değil: baskın, reklam dönüşü bozmasın)
  windowSeconds: 300,
  // Bu kadar geçerli veri birikmeden aday çıkmaz
  warmupSeconds: 120,
  // Kova, ortancadan en az bu kadar "sağlam sapma" (MAD) yukarıda olmalı
  threshold: 4,
  // …ve ortancanın en az bu katı olmalı
  ratio: 2,
  // …ve en az bu kadar ağırlıklı mesaj içermeli (sessiz yayında 3-5 mesaj patlama değildir)
  minWeight: 10,
  // İki aday arasındaki en kısa süre
  minGapSeconds: 60,
  // Bu kadar yakın patlama kovaları tek olaydır
  mergeSeconds: 20,
  maxEventSeconds: 60,
  // Kopukluktan sonra bu kadar kova değerlendirilmez (biriken mesajlar bir anda akabilir)
  settleBuckets: 1,
  // Sohbet bu kadar süre tamamen sustuysa (yalnız abone modu, yayın arası) dönüşteki ilk
  // kovalar patlama sayılmaz
  silenceSeconds: 120,
  graceMs: 3000,
};

function medianOf(values) {
  const sorted = Float64Array.from(values).sort();
  const mid = sorted.length >> 1;
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/**
 * Mesajlar geldikçe beslenen patlama dedektörü. Zamanlar epoch ms'tir.
 *   push(t, text)      → mesaj (ağırlık: mevcut tepki sözcükleri 3, diğerleri 1)
 *   gap(from, to)      → sohbet bağlantısı bu aralıkta yoktu: kovalar ne patlama sayılır ne
 *                        olağan düzeye girer; dönüşteki ilk kova da değerlendirilmez
 *   suppress(from, to) → baskın gibi tepki olmayan mesaj seli: aynı muamele
 *   advance(now)       → kapanan kovaları değerlendirir; biten olayları döndürür:
 *                        { peakAt, onsetAt, value, baseline, z, ratio }
 * Olay, son patlama kovasından `mergeSeconds` sonra (ya da `maxEventSeconds` dolunca) kapanır.
 */
export function createSpikeDetector(options = {}) {
  const o = { ...LIVE_DEFAULTS, ...options };
  const size = o.bucketSeconds * 1000;
  const windowBuckets = Math.round(o.windowSeconds / o.bucketSeconds);
  const warmupBuckets = Math.round(o.warmupSeconds / o.bucketSeconds);
  const mergeBuckets = Math.round(o.mergeSeconds / o.bucketSeconds);
  const maxBuckets = Math.round(o.maxEventSeconds / o.bucketSeconds);
  const silenceBuckets = Math.round(o.silenceSeconds / o.bucketSeconds);
  const buckets = new Map();
  const seconds = new Map();
  const invalid = new Set();
  let first = null;
  let next = null; // değerlendirilecek ilk kova
  let current = null;
  let lastPeak = -Infinity;
  let messages = 0;
  let weightTotal = 0;
  const stats = { spikes: 0, merged: 0 };

  const mark = (from, to, extra = 0) => {
    if (!(to >= from)) return;
    const a = Math.floor(from / size);
    const b = Math.floor(to / size) + extra;
    // Çok uzun kopuklukta yalnız pencereyi etkileyen son bölüm işaretlenir
    for (let i = Math.max(a, b - windowBuckets * 4); i <= b; i++)
      invalid.add(i);
  };

  const baseline = (b) => {
    const values = [];
    for (let i = Math.max(first ?? b, b - windowBuckets); i < b; i++)
      if (!invalid.has(i)) values.push(buckets.get(i) ?? 0);
    if (values.length < warmupBuckets) return null;
    const mid = medianOf(values);
    const mad = medianOf(values.map((v) => Math.abs(v - mid))) * 1.4826;
    return { mid, spread: Math.max(mad, mid * 0.25, 1) };
  };

  // Patlamanın başladığı saniye: ilk patlama kovasının hemen öncesinden başlayarak, 3 saniyelik
  // hızın olağanın üç katına (en az 5 ağırlık) çıktığı ilk an. Bulunamazsa ilk kovanın başı.
  const onset = (event, mid) => {
    const perSecond = mid / o.bucketSeconds;
    const need = Math.max(5, perSecond * 3 * 3);
    const from = event.start * o.bucketSeconds - 5;
    const to = (event.peak + 1) * o.bucketSeconds;
    for (let s = from; s < to; s++) {
      let sum = 0;
      for (let k = 0; k < 3; k++) sum += seconds.get(s + k) ?? 0;
      if (sum >= need) return s * 1000;
    }
    return event.start * size;
  };

  const finish = (out) => {
    const event = current;
    current = null;
    const peakAt = event.peak * size + size / 2;
    if (peakAt - lastPeak < o.minGapSeconds * 1000) {
      stats.merged++;
      return;
    }
    lastPeak = peakAt;
    stats.spikes++;
    out.push({
      peakAt,
      onsetAt: onset(event, event.mid),
      value: event.value,
      baseline: Math.round(event.mid * 10) / 10,
      z: Math.round(event.z * 10) / 10,
      ratio:
        event.mid > 0 ? Math.round((event.value / event.mid) * 10) / 10 : null,
    });
  };

  let emptyRun = 0;
  let settle = 0;
  let absorbing = null;
  const evaluate = (b, out) => {
    const value = buckets.get(b) ?? 0;
    let spike = false;
    let base = null;
    if (value === 0) emptyRun++;
    else {
      if (emptyRun >= silenceBuckets) {
        // Sessizlik olağan düzey sayılmaz: dönüşte ısınma yeniden başlar
        for (let i = b - emptyRun; i < b; i++) invalid.add(i);
        settle = o.settleBuckets + 1;
      }
      emptyRun = 0;
    }
    if (settle > 0) settle--;
    else if (!invalid.has(b)) {
      base = baseline(b);
      if (base) {
        const z = (value - base.mid) / base.spread;
        spike =
          z >= o.threshold &&
          value >= o.ratio * base.mid &&
          value >= o.minWeight;
        if (spike && absorbing != null && b - absorbing <= mergeBuckets) {
          // Bildirilmiş uzun olayın devamı: yeni aday değildir
          absorbing = b;
        } else if (spike) {
          absorbing = null;
          if (current && b - current.last <= mergeBuckets) {
            current.last = b;
            if (value > current.value)
              Object.assign(current, { peak: b, value, z });
          } else {
            if (current) finish(out);
            current = {
              start: b,
              last: b,
              peak: b,
              value,
              z,
              mid: base.mid,
            };
          }
        }
      }
    }
    if (current && b - current.start + 1 >= maxBuckets) {
      absorbing = current.last;
      finish(out);
    } else if (current && b - current.last >= mergeBuckets) finish(out);
    // Eski veriyi bırak: bellek saatlerce süren yayında sabit kalsın
    const old = b - windowBuckets * 4;
    buckets.delete(old);
    invalid.delete(old);
    for (let s = old * o.bucketSeconds; s < (old + 1) * o.bucketSeconds; s++)
      seconds.delete(s);
  };

  return {
    push(t, text) {
      if (!Number.isFinite(t)) return;
      const b = Math.floor(t / size);
      if (first == null) first = b;
      // Çoktan değerlendirilmiş kovaya düşen gecikmiş mesaj sayılmaz
      if (next != null && b < next) return;
      const weight = typeof text === 'number' ? text : chatWeight(text);
      buckets.set(b, (buckets.get(b) ?? 0) + weight);
      const s = Math.floor(t / 1000);
      seconds.set(s, (seconds.get(s) ?? 0) + weight);
      messages++;
      weightTotal += weight;
    },
    gap(from, to) {
      mark(from, to, o.settleBuckets);
    },
    suppress(from, to) {
      mark(from, to, 0);
    },
    advance(now) {
      const out = [];
      if (first == null) return out;
      const until = Math.floor((now - o.graceMs) / size); // bu kova hâlâ açık
      if (next == null) next = first;
      // Uzun aradan sonra (uyku, askı) yalnız son pencere değerlendirilir
      if (until - next > windowBuckets * 4) {
        current = null;
        next = until - windowBuckets * 4;
      }
      for (; next < until; next++) evaluate(next, out);
      return out;
    },
    stats: () => ({ ...stats, messages, weight: weightTotal }),
  };
}

/**
 * Patlamanın kayıttaki tahmini anı (epoch ms): sohbet olaydan sonra tepki verir. Mevcut
 * CHAT_LAG_SECONDS (yazma + yayın gecikmesi) uygulanır; `offsetSeconds` (--chat-offset) kaydın
 * izleyiciye göre gecikmesini düzeltir: artı değer anı ileri, eksi değer geri alır.
 */
export function eventTime(spike, offsetSeconds = 0) {
  return spike.onsetAt - CHAT_LAG_SECONDS * 1000 + offsetSeconds * 1000;
}

/**
 * Mesajlardan ({t, w}) [fromWall, fromWall + seconds) aralığı için saniyelik ağırlık dizisi;
 * zaman ekseni kayıt konumudur: mesajlar gecikme kadar geri kaydırılır (clip:moments ile aynı).
 */
export function chatSeriesFor(messages, fromWall, seconds, offsetSeconds = 0) {
  const series = new Float64Array(Math.max(0, Math.ceil(seconds)));
  const shift = (CHAT_LAG_SECONDS - offsetSeconds) * 1000;
  for (const message of messages) {
    const second = Math.floor((message.t - shift - fromWall) / 1000);
    if (second >= 0 && second < series.length) series[second] += message.w;
  }
  return series;
}

// ---------------------------------------------------------------------------
// Duvar saati ↔ kayıt konumu
// ---------------------------------------------------------------------------

/**
 * Parça kayıtlarından zaman aralıkları. Canlı akış gerçek zamanlı geldiği için bir parçanın
 * SONU bilinen andır: kapalı parçada `closedAt` (sıradaki parçanın açıldığı an), yazılmakta
 * olan parçada `probedAt` (süresinin ölçüldüğü an). Başlangıç = son − süre. Böylece yayın
 * açılışındaki toplu indirme (ilk birkaç saniyenin bir anda gelmesi) eşlemeyi kaydırmaz.
 * Silinmiş (pruned) ve süresi bilinmeyen parçalar atlanır.
 */
export function segmentSpans(segments) {
  const out = [];
  for (const segment of segments) {
    const end = segment.closedAt ?? segment.probedAt;
    if (segment.pruned || !(segment.duration > 0) || !Number.isFinite(end))
      continue;
    out.push({
      file: segment.file,
      run: segment.run,
      index: segment.index,
      startWall: end - segment.duration * 1000,
      endWall: end,
      duration: segment.duration,
    });
  }
  return out.sort((a, b) => a.index - b.index);
}

/** Duvar saati → { file, offset } (parça içi saniye) ya da null (o an kayıtta yok). */
export function locate(spans, wall) {
  const span = spans.find((s) => wall >= s.startWall && wall < s.endWall);
  return span
    ? { file: span.file, offset: (wall - span.startWall) / 1000 }
    : null;
}

/**
 * [fromWall, toWall] aralığını kapsayan kesit planı. `centerWall` anını içeren parçadan başlar,
 * yalnız AYNI çalıştırmanın (run) ardışık parçalarına uzanır: kayıt yeniden başladıysa zaman
 * damgaları da sıfırlanır, o sınırın ötesine geçilmez. Dönen `files` uç uca eklenir; `seek`
 * ilk dosyanın başından itibaren saniye, `startWall`/`endWall` kesitin gerçek sınırlarıdır.
 * `centerWall` kayıtta yoksa null.
 */
export function excerptPlan(spans, fromWall, toWall, centerWall) {
  const at = spans.findIndex(
    (s) => centerWall >= s.startWall && centerWall < s.endWall,
  );
  if (at < 0) return null;
  let a = at;
  let b = at;
  const joined = (x, y) =>
    x.run === y.run &&
    y.index === x.index + 1 &&
    // Uç uca eklenecek parçalar arasında duvar saatinde de boşluk olmamalı
    Math.abs(y.startWall - x.endWall) < 5000;
  while (
    a > 0 &&
    spans[a].startWall > fromWall &&
    joined(spans[a - 1], spans[a])
  )
    a--;
  while (
    b < spans.length - 1 &&
    spans[b].endWall < toWall &&
    joined(spans[b], spans[b + 1])
  )
    b++;
  const files = spans.slice(a, b + 1);
  // Zaman ekseni son parçanın sonuna göre kurulur (en güvenilir an)
  const total = files.reduce((sum, s) => sum + s.duration, 0);
  const origin = files.at(-1).endWall - total * 1000;
  const startWall = Math.max(fromWall, origin);
  const endWall = Math.min(toWall, files.at(-1).endWall);
  if (!(endWall - startWall >= 1000)) return null;
  return {
    files: files.map((s) => s.file),
    seek: (startWall - origin) / 1000,
    seconds: (endWall - startWall) / 1000,
    startWall,
    endWall,
  };
}

// ---------------------------------------------------------------------------
// Disk
// ---------------------------------------------------------------------------

/**
 * Disk bütçesi aşılınca silinecek parçalar: en eskiden başlar; yazılmakta olan ve son
 * `keepLast` kapalı parça korunur (bekleyen adayların kesiti onlardan alınır).
 * @param {{file:string,size:number,closed:boolean,pruned?:boolean}[]} segments eski → yeni
 */
export function planPrune(segments, budgetBytes, { keepLast = 2 } = {}) {
  const live = segments.filter((s) => !s.pruned);
  let total = live.reduce((sum, s) => sum + (s.size ?? 0), 0);
  const closed = live.filter((s) => s.closed);
  const removable = closed.slice(0, Math.max(0, closed.length - keepLast));
  const out = [];
  for (const segment of removable) {
    if (total <= budgetBytes) break;
    out.push(segment.file);
    total -= segment.size ?? 0;
  }
  return out;
}

export const MIN_FREE_BYTES = 3 * 1024 ** 3;

/** Boş alan `minFree` altına inerse kayıt durdurulur: disk asla doldurulmaz. */
export function diskVerdict(freeBytes, minFree = MIN_FREE_BYTES) {
  if (!Number.isFinite(freeBytes)) return 'unknown';
  return freeBytes < minFree ? 'stop' : freeBytes < minFree * 2 ? 'low' : 'ok';
}
