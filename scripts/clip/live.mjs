#!/usr/bin/env node
// Canlı izleme: yayın sürerken kaydet, sohbet patlamalarından klip adayı çıkar.
//   pnpm clip:live <kanal-adresi> (--permission "<izin referansı>" | --open-license "<lisans>" | --own | --analysis-only)
//       [--out <klasör>] [--lang tr] [--translate tr] [--quality best] [--min-gap 60] [--threshold 4] [--ratio 2]
//       [--chat-offset 6] [--length 40] [--max-hours 12] [--max-disk-gb 20] [--segment-minutes 10]
//       Kanal canlıya geçene kadar bekler; kaydı parçalı tutar (kayit/parca-NNNNN.ts), sohbeti
//       hesapsız ve salt okunur izler (chat.jsonl: yalnız zaman + metin, kullanıcı adı yok),
//       patlamada adayın kesitini (adaylar/NN/kaynak.mp4), kalite raporunu, önizleme şeridini ve
//       inceleme dosyasını yazar. KLİP KESMEZ. Aynı klasörle yeniden çalıştırılırsa kaldığı
//       yerden sürer. Ctrl+C düzgün kapatır.
//       --analysis-only: hak seçeneği olmadan yalnız inceleme; o oturumdan klip kesilemez ve
//       kayıt inceleme bitince silinmelidir.
//   pnpm clip:live --replay <oturum-klasörü> [--threshold …] [--min-gap …] [--chat-offset …] [--no-build]
//       Kayıtlı chat.jsonl'u dedektörden hızla geçirir (ayar denemek için); kaydı duran
//       patlamalar için eksik adayları da üretir.
//   pnpm clip:live-cut <oturum-klasörü> [--only 1,4] [--translate tr] [--layout blur|crop]
//       [--keep 2] [--keep-all] [--no-subs] [--permission … | --open-license … | --own]
//       İnsan seçimiyle keser: --only verilmezse yalnız clips/kararlar.json'da "keep" denenler.
//       1080×1920, kare hassasiyetinde yeniden kodlama, altyazı ve üst yazı (clip:cut ile aynı).
//
// Kural (docs/compliance.md → Kaynak içerik): başkasının yayını yalnızca hak sahibinin yazılı
// izniyle kesilir ve yayınlanır. Gereksinim: streamlink, ffmpeg, ffprobe. Yalnız Twitch (v1).
// Ayrıntı: docs/clip-guide.md → Canlı izleme. Saf mantık: live-lib.mjs.
import { spawn, spawnSync } from 'node:child_process';
import {
  closeSync,
  createWriteStream,
  existsSync,
  mkdirSync,
  openSync,
  readFileSync,
  readSync,
  readdirSync,
  renameSync,
  rmSync,
  statSync,
  statfsSync,
  writeFileSync,
} from 'node:fs';
import { homedir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  CLIP_MAX_SECONDS,
  CLIP_MIN_SECONDS,
  assessClip,
  boundaryKind,
  chatWeight,
  coarsen,
  findBreaks,
  parseDecisions,
  reactionEnd,
  refinePeak,
  sanitizeTranscript,
  silenceThreshold,
  snapClip,
  transcriptFor,
} from './moments-lib.mjs';
import {
  clipSrt,
  formatTime,
  parseCli,
  parseSubtitles,
  parseTime,
  validateRange,
} from './clip-lib.mjs';
import {
  cut,
  loadTagger,
  measureLoudness,
  measureVisual,
  ok,
  outsideRepo,
  packetText,
  pad2,
  pickFfmpeg,
  probeDuration,
  rankList,
  requireTool,
  sourceRights,
  stemOf,
  tool,
  transcribeLocally,
  writePreview,
} from './clip.mjs';
import {
  LIVE_DEFAULTS,
  backoffSeconds,
  chatEvent,
  chatSeriesFor,
  createSpikeDetector,
  diskVerdict,
  eventTime,
  excerptPlan,
  ircHandshake,
  parseChannel,
  parseIrcLine,
  planPrune,
  segmentArgs,
  segmentIndex,
  segmentSpans,
  sessionName,
  streamlinkArgs,
} from './live-lib.mjs';

const self = fileURLToPath(import.meta.url);
const CHAT_URL = 'wss://irc-ws.chat.twitch.tv:443';
// Aday kesiti: tahmini andan bu kadar önce ve sonra (kurulum + bağlam / tepki)
const PRE_ROLL = 75;
const POST_ROLL = 35;
// Yayın koptuktan sonra bu kadar süre geri gelmezse oturum kapanır
const END_GRACE_MS = 10 * 60 * 1000;
const RECENT_CHAT_MS = 15 * 60 * 1000;
// Kayıt, sohbete yazan izleyicinin gördüğünden geridedir (streamlink canlı uçtan 3 parça geriden
// başlar). CHAT_LAG_SECONDS (8) tek başına anı erken tahmin eder; ölçüm: docs/clip-guide.md.
const DEFAULT_CHAT_OFFSET = 6;

const warn = (m) => console.log(`  \x1b[33m[UYARI]\x1b[0m ${m}`);
const clock = () => new Date().toLocaleTimeString('tr-TR', { hour12: false });

function writeJson(file, data) {
  const tmp = `${file}.tmp`;
  writeFileSync(tmp, JSON.stringify(data, null, 2) + '\n');
  renameSync(tmp, file);
}

const readJson = (file) => JSON.parse(readFileSync(file, 'utf8'));

function requireStreamlink() {
  if (!tool('streamlink'))
    throw new Error(
      'streamlink bulunamadı. Kurulum:\n' +
        '  macOS:   brew install streamlink\n' +
        '  Windows: winget install streamlink  (ya da: pip install -U streamlink)\n' +
        'Kurduktan sonra yeni bir terminal aç.',
    );
}

/** Süreci ve altındakileri sonlandırır (Windows'ta ağaç olarak). */
function killTree(child, signal = 'SIGTERM') {
  if (!child || child.exitCode != null || child.signalCode != null) return;
  if (process.platform === 'win32')
    spawnSync('taskkill', ['/pid', String(child.pid), '/T', '/F'], {
      stdio: 'ignore',
    });
  else {
    try {
      child.kill(signal);
    } catch {
      // Süreç bu arada bitmiş olabilir
    }
  }
}

function probeAsync(file) {
  return new Promise((fulfill) => {
    const child = spawn(
      'ffprobe',
      [
        '-v',
        'error',
        '-show_entries',
        'format=duration',
        '-of',
        'default=nw=1:nk=1',
        file,
      ],
      { stdio: ['ignore', 'pipe', 'ignore'] },
    );
    let out = '';
    child.stdout.on('data', (chunk) => (out += chunk));
    child.on('error', () => fulfill(null));
    child.on('close', () => {
      const seconds = Number.parseFloat(out);
      fulfill(Number.isFinite(seconds) && seconds > 0 ? seconds : null);
    });
  });
}

function number(options, name, fallback, min, max) {
  const value = options[name] === undefined ? fallback : Number(options[name]);
  if (!(value >= min && value <= max))
    throw new Error(`--${name} ${min} ile ${max} arasında bir sayı olmalı.`);
  return value;
}

const sessionFiles = (dir) => ({
  session: join(dir, 'session.json'),
  chat: join(dir, 'chat.jsonl'),
  log: join(dir, 'kayit.log'),
  record: join(dir, 'kayit'),
  candidates: join(dir, 'candidates.json'),
  work: join(dir, 'adaylar'),
  clips: join(dir, 'clips'),
  decisions: join(dir, 'clips', 'kararlar.json'),
});

function loadCandidates(dir) {
  const file = sessionFiles(dir).candidates;
  return existsSync(file) ? (readJson(file).candidates ?? []) : [];
}

/**
 * kararlar.json şablonuna eksik adayları ekler; var olan kararlar korunur. Dosya o anda
 * okunamıyorsa (agent yazıyor olabilir) dokunulmaz; bir sonraki adayda yeniden denenir.
 */
function ensureDecisions(dir, candidates) {
  const file = sessionFiles(dir).decisions;
  let data = {
    note: 'Her aday için: decision "keep" | "drop" | null, shiftStart/shiftEnd saniye (eksi = geri, artı = ileri), caption klibin üstüne gömülecek tek satır bağlam (en çok 60 karakter), title yayın başlığı önerisi. peak alanına dokunma. Kesim: pnpm clip:live-cut <klasör> yalnız "keep" denenleri keser; "keep" aracın "ele" kararını aşmaz (onu yalnız komut satırında --keep <sıra> aşar).',
    candidates: {},
  };
  if (existsSync(file)) {
    try {
      data = readJson(file);
      if (typeof data?.candidates !== 'object' || data.candidates === null)
        return false;
    } catch {
      return false;
    }
  }
  let changed = !existsSync(file);
  for (const m of candidates)
    if (!(String(m.rank) in data.candidates)) {
      data.candidates[m.rank] = {
        peak: m.peak,
        decision: null,
        shiftStart: 0,
        shiftEnd: 0,
        caption: '',
        title: '',
        note: '',
      };
      changed = true;
    }
  if (changed) {
    mkdirSync(dirname(file), { recursive: true });
    writeJson(file, data);
  }
  return true;
}

// ---------------------------------------------------------------------------
// Aday üretimi (ayrı süreçte çalışır: ana döngü kayıt ve sohbeti aksatmadan sürdürür)
// ---------------------------------------------------------------------------

async function buildCandidate(jobFile) {
  const job = readJson(jobFile);
  const files = sessionFiles(job.dir);
  const rank = job.rank;
  const work = join(files.work, pad2(rank));
  const video = join(work, 'kaynak.mp4');
  const ffmpeg = pickFfmpeg(false);

  // 1. Kesit: yeniden kodlamadan MP4'e kopyala (parçalar silinse de aday kalır)
  if (!job.plan.files.every((name) => segmentIndex(name) != null))
    throw new Error('Geçersiz parça adı.');
  const extracted = spawnSync(
    ffmpeg,
    [
      '-hide_banner',
      '-loglevel',
      'error',
      '-nostdin',
      '-y',
      '-ss',
      String(job.plan.seek),
      '-t',
      String(job.plan.seconds),
      '-i',
      job.plan.files.length === 1
        ? job.plan.files[0]
        : `concat:${job.plan.files.join('|')}`,
      '-map',
      '0:v:0',
      '-map',
      '0:a:0?',
      '-c',
      'copy',
      // MP4: anahtar kare dizini var, kesim ve önizleme kare hassasiyetinde arar (TS'te aramaz)
      '-movflags',
      '+faststart',
      video,
    ],
    { cwd: files.record, stdio: 'ignore' },
  );
  const duration =
    extracted.status === 0 && existsSync(video) ? probeDuration(video) : null;
  if (!duration || duration < CLIP_MIN_SECONDS)
    throw new Error('Aday kesiti kayıttan çıkarılamadı.');
  // Kopyalama bir önceki anahtar kareden başlar: kesit istenenden biraz erken açılır
  const lead = Math.min(5, Math.max(0, duration - job.plan.seconds));
  const startWall = job.plan.startWall - lead * 1000;
  const toSession = (t) => (startWall - job.epoch) / 1000 + t;

  const source = {
    videoId: 'kaynak',
    platform: 'twitch',
    live: true,
    channel: job.channel,
    channelUrl: job.channelUrl,
    url: job.channelUrl,
    language: job.language,
    capturedAt: new Date(job.eventWall).toISOString(),
    height: probeHeight(video),
  };
  writeJson(join(work, 'source.json'), source);

  // 2. Ölçümler: mevcut hat (ses, sınırlar, kalite) kesitin üzerinde çalışır
  const fine = await measureLoudness(video, work, { quiet: true });
  const audio = fine ? coarsen(fine) : null;
  const chat = chatSeriesFor(
    job.chat.map(([t, w]) => ({ t, w })),
    startWall,
    duration,
    job.chatOffset,
  );
  const peak = refinePeak((job.eventWall - startWall) / 1000, audio, 10);
  const cues = transcribeLocally({
    dir: work,
    video,
    source,
    windows: [[0, duration]],
  });
  const threshold = silenceThreshold(fine);
  const breaks = findBreaks({ cues, fine, threshold, from: 0, to: duration });
  const range = snapClip({
    peak,
    target: job.length,
    min: CLIP_MIN_SECONDS,
    max: CLIP_MAX_SECONDS,
    duration,
    breaks,
    decay: reactionEnd({
      peak,
      audio,
      chat,
      until: Math.min(duration, peak + CLIP_MAX_SECONDS),
    }),
  });
  const tagger = loadTagger();
  const chatPeak = Math.min(6, Math.round(job.spike.z * 10) / 10);
  const quality = assessClip({
    start: range.start,
    end: range.end,
    peak,
    cues,
    fine,
    threshold,
    chat,
    chatMean: job.chatMean,
    chatPeak,
    visual: measureVisual(ffmpeg, video, range.start, range.end),
    tags: tagger ? tagger(video, range.start, range.end) : null,
    startKind: range.startKind,
    endKind: range.endKind,
  });

  // 3. Çıktılar: oturum zaman ekseninde (oturum başından beri geçen süre)
  const moment = {
    rank,
    start: formatTime(toSession(range.start), { tenths: true }),
    end: formatTime(toSession(range.end), { tenths: true }),
    peak: formatTime(toSession(peak)),
    seconds: quality.metrics.seconds,
    score: job.spike.z,
    why: 'sohbet',
    signals: { chat: chatPeak },
    quality,
    transcript: sanitizeTranscript(
      transcriptFor(cues, range.start, range.end),
      280,
    ),
    at: new Date(startWall + peak * 1000).toISOString(),
    spike: job.spike,
    clip: {
      dir: join('adaylar', pad2(rank)),
      file: 'kaynak.mp4',
      start: range.start,
      end: range.end,
      peak: Math.round(peak * 10) / 10,
      duration: Math.round(duration * 10) / 10,
      breaks,
    },
  };
  const previewDir = join(files.clips, 'onizleme');
  const packetDir = join(files.clips, 'inceleme');
  mkdirSync(previewDir, { recursive: true });
  mkdirSync(packetDir, { recursive: true });
  const preview = join(previewDir, `${stemOf(moment)}.jpg`);
  writePreview(ffmpeg, video, range.start, range.end, preview);
  moment.preview = join('clips', 'onizleme', basename(preview));
  moment.packet = join('clips', 'inceleme', `${pad2(rank)}.md`);
  writeFileSync(
    join(job.dir, moment.packet),
    packetText(
      moment,
      cues.map((cue) => ({
        ...cue,
        start: toSession(cue.start),
        end: toSession(cue.end),
        ...(cue.spokenEnd == null
          ? {}
          : { spokenEnd: toSession(cue.spokenEnd) }),
      })),
      existsSync(preview) ? preview : null,
      job.chatLines,
    ),
  );
  writeJson(join(work, 'sonuc.json'), moment);
}

function probeHeight(file) {
  const r = spawnSync(
    'ffprobe',
    [
      '-v',
      'error',
      '-select_streams',
      'v:0',
      '-show_entries',
      'stream=height',
      '-of',
      'default=nw=1:nk=1',
      file,
    ],
    { encoding: 'utf8' },
  );
  const height = Number.parseInt(r.stdout, 10);
  return Number.isFinite(height) ? height : null;
}

/** Patlama için iş dosyasını yazar, üretici süreci çalıştırır, sonucu aday listesine ekler. */
function createBuilder({ dir, session, settings, logFd }) {
  const files = sessionFiles(dir);
  const candidates = loadCandidates(dir);
  let active = null;

  const save = () => {
    writeJson(files.candidates, {
      source: {
        platform: 'twitch',
        channel: session.channel,
        channelUrl: session.channelUrl,
        live: true,
      },
      analysisOnly: Boolean(session.analysisOnly),
      candidates,
    });
    ensureDecisions(dir, candidates);
  };

  return {
    candidates,
    busy: () => active != null,
    near: (eventWall, gapSeconds) =>
      candidates.some(
        (m) => Math.abs(Date.parse(m.at) - eventWall) < gapSeconds * 1000,
      ),
    kill: () => killTree(active),
    /** @returns {Promise<object|null>} üretilen aday ya da null */
    build({ spike, eventWall, plan, messages, chatMean, live = false }) {
      const rank = candidates.reduce((max, m) => Math.max(max, m.rank), 0) + 1;
      const work = join(files.work, pad2(rank));
      rmSync(work, { recursive: true, force: true });
      mkdirSync(work, { recursive: true });
      // Sohbet örneği: tepe kovasındaki mesajlardan birkaç tane (inceleme dosyasında veri olarak)
      const around = messages.filter(
        (m) => Math.abs(m.t - spike.peakAt) <= 5000,
      );
      const step = Math.max(1, Math.floor(around.length / 8));
      const jobFile = join(work, 'is.json');
      writeJson(jobFile, {
        dir,
        rank,
        epoch: session.epoch,
        channel: session.channel,
        channelUrl: session.channelUrl,
        language: settings.language,
        length: settings.length,
        chatOffset: settings.chatOffset,
        spike,
        eventWall,
        plan,
        chatMean,
        chat: messages
          .filter(
            (m) =>
              m.t >= plan.startWall - 20_000 && m.t <= plan.endWall + 30_000,
          )
          .map((m) => [m.t, m.w]),
        chatLines: around
          .filter((_, i) => i % step === 0)
          .slice(0, 8)
          .map((m) => m.m),
      });
      return new Promise((fulfill) => {
        // Kendi süreç grubunda: Ctrl+C yarım aday bırakmasın, ana süreç bitmesini bekler
        active = spawn(process.execPath, [self, 'build', jobFile], {
          stdio: ['ignore', logFd ?? 'ignore', logFd ?? 'ignore'],
          detached: process.platform !== 'win32',
          windowsHide: true,
        });
        const done = () => {
          active = null;
          rmSync(jobFile, { force: true });
          const resultFile = join(work, 'sonuc.json');
          if (!existsSync(resultFile)) {
            rmSync(work, { recursive: true, force: true });
            return fulfill(null);
          }
          const moment = readJson(resultFile);
          rmSync(resultFile, { force: true });
          // Olaydan adaya geçen süre yalnız canlıda anlamlıdır (replay sonradan üretir)
          moment.timing = {
            eventAt: new Date(eventWall).toISOString(),
            readyAt: new Date().toISOString(),
            secondsFromEvent: live
              ? Math.round((Date.now() - eventWall) / 1000)
              : null,
          };
          candidates.push(moment);
          save();
          fulfill(moment);
        };
        active.on('error', done);
        active.on('close', done);
      });
    },
  };
}

function candidateLine(m, live) {
  const ratio = m.spike.ratio ? `sohbet ×${m.spike.ratio}` : 'sohbet patlaması';
  return (
    `  \x1b[36m[ADAY ${pad2(m.rank)}]\x1b[0m ${m.start}-${m.end} (${m.seconds} sn) · ${ratio} · ` +
    `kalite ${m.quality.score} ${m.quality.verdict}` +
    (live ? ` · olaydan ${m.timing.secondsFromEvent} sn sonra hazır` : '') +
    ` → ${m.packet}`
  );
}

// ---------------------------------------------------------------------------
// clip:live
// ---------------------------------------------------------------------------

function detectorSettings(options, saved = {}) {
  return {
    threshold: number(
      options,
      'threshold',
      saved.threshold ?? LIVE_DEFAULTS.threshold,
      1,
      20,
    ),
    ratio: number(
      options,
      'ratio',
      saved.ratio ?? LIVE_DEFAULTS.ratio,
      1.2,
      20,
    ),
    minGapSeconds: number(
      options,
      'min-gap',
      saved.minGapSeconds ?? LIVE_DEFAULTS.minGapSeconds,
      20,
      3600,
    ),
    chatOffset: number(
      options,
      'chat-offset',
      saved.chatOffset ?? DEFAULT_CHAT_OFFSET,
      -60,
      60,
    ),
    length: number(options, 'length', saved.length ?? 40, 10, 180),
  };
}

function readChat(file, sinceMs = 0) {
  if (!existsSync(file)) return [];
  const out = [];
  // Yalnız dosyanın sonu gerekiyorsa baştan okunmaz
  const size = statSync(file).size;
  const from = sinceMs > 0 ? Math.max(0, size - 4 * 1024 * 1024) : 0;
  const fd = openSync(file, 'r');
  try {
    const buffer = Buffer.alloc(size - from);
    readSync(fd, buffer, 0, buffer.length, from);
    for (const line of buffer.toString('utf8').split('\n')) {
      if (!line.startsWith('{')) continue;
      try {
        const { t, m } = JSON.parse(line);
        if (Number.isFinite(t) && typeof m === 'string' && t >= sinceMs)
          out.push({ t, m, w: chatWeight(m) });
      } catch {
        // Yarım kalmış satır atlanır
      }
    }
  } finally {
    closeSync(fd);
  }
  return out;
}

/** Önceki çalıştırmadan açık kalan parçalar: son yazım anı kapanış anıdır. */
function settleSegments(session, files) {
  for (const segment of session.segments ?? []) {
    const file = join(files.record, segment.file);
    if (segment.pruned || segment.closedAt != null) continue;
    if (!existsSync(file)) segment.pruned = true;
    else {
      segment.closedAt = statSync(file).mtimeMs;
      segment.duration = probeDuration(file);
    }
  }
}

async function replay(dir, options) {
  const files = sessionFiles(dir);
  if (!existsSync(files.session) || !existsSync(files.chat))
    throw new Error('Bu klasörde session.json ve chat.jsonl yok.');
  const session = readJson(files.session);
  const settings = {
    ...detectorSettings(options, session.settings),
    language: session.settings?.language ?? null,
  };
  const messages = readChat(files.chat);
  if (messages.length === 0) throw new Error('chat.jsonl boş.');
  const detector = createSpikeDetector(settings);
  for (const [from, to] of session.chatGaps ?? []) detector.gap(from, to);
  for (const [from, to] of session.raids ?? []) detector.suppress(from, to);
  const spikes = [];
  for (const message of messages) {
    spikes.push(...detector.advance(message.t));
    detector.push(message.t, message.w);
  }
  spikes.push(...detector.advance(messages.at(-1).t + 300_000));
  const seconds = (messages.at(-1).t - messages[0].t) / 1000;
  ok(
    `${messages.length} mesaj, ${formatTime(Math.round(seconds))} sohbet → ${spikes.length} patlama (eşik ${settings.threshold}, en az aralık ${settings.minGapSeconds} sn)`,
  );
  console.log('\n  Oturum zamanı  Ağırlık  Olağan  Kat    Sapma');
  for (const spike of spikes)
    console.log(
      `  ${formatTime(Math.max(0, Math.round((spike.peakAt - session.epoch) / 1000))).padEnd(14)} ${String(spike.value).padEnd(8)} ${String(spike.baseline).padEnd(7)} ${String(spike.ratio ?? '–').padEnd(6)} ${spike.z}`,
    );
  if (options['no-build']) return;
  settleSegments(session, files);
  const spans = segmentSpans(session.segments ?? []).filter((s) =>
    existsSync(join(files.record, s.file)),
  );
  if (spans.length === 0) {
    console.log('\nKayıt parçası yok: aday üretilmedi (yalnız dedektör).');
    return;
  }
  requireTool('ffmpeg', '-version');
  const builder = createBuilder({ dir, session, settings });
  const chatMean =
    seconds > 0 ? messages.reduce((sum, m) => sum + m.w, 0) / seconds : null;
  let built = 0;
  for (const spike of spikes) {
    const eventWall = eventTime(spike, settings.chatOffset);
    if (builder.near(eventWall, settings.minGapSeconds)) continue;
    const plan = excerptPlan(
      spans,
      eventWall - PRE_ROLL * 1000,
      eventWall + POST_ROLL * 1000,
      eventWall,
    );
    if (!plan) continue;
    const moment = await builder.build({
      spike,
      eventWall,
      plan,
      messages,
      chatMean,
    });
    if (moment) {
      built++;
      console.log(candidateLine(moment, false));
    }
  }
  console.log(
    `\n${built} yeni aday üretildi (toplam ${builder.candidates.length}). İnceleme dosyaları: ${join(files.clips, 'inceleme')}`,
  );
}

async function live(argv) {
  const { positional, options } = parseCli(argv, {
    values: [
      'permission',
      'open-license',
      'out',
      'lang',
      'translate',
      'quality',
      'min-gap',
      'threshold',
      'ratio',
      'chat-offset',
      'length',
      'max-hours',
      'max-disk-gb',
      'segment-minutes',
      'replay',
    ],
    flags: ['own', 'analysis-only', 'no-build'],
  });
  if (options.replay !== undefined) {
    if (positional.length !== 0)
      throw new Error('Kullanım: pnpm clip:live --replay <oturum-klasörü>');
    return replay(resolve(options.replay), options);
  }
  if (positional.length !== 1)
    throw new Error(
      'Kullanım: pnpm clip:live <kanal-adresi> (--permission "<izin referansı>" | --open-license "<lisans>" | --own | --analysis-only) [--out <klasör>] [--lang tr] [--translate tr] [--quality best] [--min-gap 60] [--max-hours 12] [--max-disk-gb 20]',
    );
  const { channel, url } = parseChannel(positional[0]);

  // Hak durumu en başta: kayıt başlamadan önce
  const analysisOnly = Boolean(options['analysis-only']);
  if (
    analysisOnly &&
    (options.own || options.permission || options['open-license'])
  )
    throw new Error(
      '--analysis-only hak seçeneğiyle birlikte verilmez: izin varsa onu yaz, yoksa yalnız inceleme yap.',
    );
  const rights = analysisOnly ? null : sourceRights(options);
  const target = options.translate;
  if (target !== undefined && !/^[a-z]{2,3}$/.test(target))
    throw new Error('--translate bir dil kodu ister. Örnek: --translate tr');
  const languages = (options.lang ?? '').split(',').filter(Boolean);
  for (const language of languages)
    if (!/^[a-z]{2,3}$/.test(language))
      throw new Error(`Dil kodu "${language}" geçersiz. Örnek: tr, en.`);
  const quality = options.quality ?? 'best';
  const maxHours = number(options, 'max-hours', 12, 0.01, 48);
  const budgetBytes =
    number(options, 'max-disk-gb', 20, 0.05, 2000) * 1024 ** 3;
  const segmentSeconds = number(options, 'segment-minutes', 10, 0.5, 60) * 60;
  streamlinkArgs({ channel, quality }); // kaliteyi şimdi doğrula

  const dir = resolve(
    options.out ??
      join(homedir(), 'ai-influencer-clips', 'live', sessionName(channel)),
  );
  outsideRepo(dir, 'Oturum klasörü');
  requireStreamlink();
  requireTool('ffmpeg', '-version');
  requireTool('ffprobe', '-version');
  if (typeof WebSocket === 'undefined')
    throw new Error(
      'Bu Node sürümünde WebSocket yok; Node 24 kullan (.nvmrc).',
    );

  const files = sessionFiles(dir);
  mkdirSync(files.record, { recursive: true });
  const resumed = existsSync(files.session);
  const session = resumed
    ? readJson(files.session)
    : {
        version: 1,
        channel,
        channelUrl: url,
        createdAt: new Date().toISOString(),
        epoch: Date.now(),
        analysisOnly,
        rights,
        runs: 0,
        segments: [],
        chatGaps: [],
        raids: [],
      };
  if (resumed) {
    if (session.channel !== channel)
      throw new Error(
        `Bu klasör başka bir kanalın oturumu (${session.channel}). --out ile başka klasör ver.`,
      );
    if (Boolean(session.analysisOnly) !== analysisOnly)
      throw new Error(
        session.analysisOnly
          ? 'Bu klasör yalnız inceleme oturumu (--analysis-only): izinli kayıt için yeni bir klasör kullan (--out).'
          : 'Bu klasör izinli bir oturum; --analysis-only için yeni bir klasör kullan (--out).',
      );
    if (!analysisOnly) session.rights = rights;
  }
  const settings = {
    ...detectorSettings(options, session.settings),
    // Tek dil verildiyse döküm o dilde yapılır; yoksa dil kendiliğinden algılanır
    language: languages.length === 1 ? languages[0] : null,
  };
  session.settings = settings;
  session.translate = target ?? session.translate ?? null;
  session.quality = quality;
  session.stoppedAt = null;
  session.stopReason = null;
  const saveSession = () => writeJson(files.session, session);

  settleSegments(session, files);
  saveSession();

  const logFd = openSync(files.log, 'a');
  const chatOut = createWriteStream(files.chat, { flags: 'a' });
  const detector = createSpikeDetector(settings);
  const builder = createBuilder({ dir, session, settings, logFd });
  const startedAt = Date.now();
  const counts = { messages: 0, spikes: 0, skipped: 0, built: 0 };

  // Kaldığı yerden sürme: son dakikaların sohbeti olağan düzeyi kurar, aradaki boşluk işaretlenir
  let recent = resumed ? readChat(files.chat, startedAt - RECENT_CHAT_MS) : [];
  for (const message of recent) detector.push(message.t, message.w);
  if (recent.length > 0) {
    detector.advance(recent.at(-1).t + 4000);
    detector.gap(recent.at(-1).t, startedAt);
    session.chatGaps.push([recent.at(-1).t, startedAt]);
  }
  let weightTotal = 0;

  console.log(
    `\nCanlı izleme: ${url}\nKlasör: ${dir}${resumed ? ' (kaldığı yerden sürüyor)' : ''}`,
  );
  if (analysisOnly)
    warn(
      'Yalnız inceleme oturumu: bu oturumdan klip kesilemez ve kayıt, inceleme bitince silinmelidir.',
    );
  console.log(
    'Durdurmak için Ctrl+C. Adaylar geldikçe clips/inceleme/ altına yazılır; kesim ayrı adımdır (pnpm clip:live-cut).\n',
  );

  // --- Sohbet ---------------------------------------------------------------
  let ws = null;
  let joined = false;
  let chatAttempt = 0;
  let chatTimer = null;
  let lastFrame = Date.now();
  let gapStart = null;
  let stopping = false;
  const connectChat = () => {
    if (stopping) return;
    joined = false;
    lastFrame = Date.now();
    const socket = new WebSocket(CHAT_URL);
    ws = socket;
    socket.addEventListener('open', () => {
      for (const line of ircHandshake(channel)) socket.send(line);
    });
    socket.addEventListener('message', (event) => {
      const now = Date.now();
      lastFrame = now;
      for (const line of String(event.data).split('\r\n')) {
        const parsed = chatEvent(parseIrcLine(line), channel, now);
        if (!parsed) continue;
        if (parsed.type === 'ping') socket.send(`PONG :${parsed.payload}`);
        else if (parsed.type === 'reconnect') socket.close();
        else if (parsed.type === 'joined') {
          if (joined) continue;
          joined = true;
          chatAttempt = 0;
          if (gapStart != null) {
            detector.gap(gapStart, now);
            session.chatGaps.push([gapStart, now]);
            gapStart = null;
          }
          ok(`${clock()} Sohbete bağlanıldı (hesapsız, salt okunur)`);
        } else if (parsed.type === 'raid') {
          detector.suppress(parsed.t, parsed.t + 90_000);
          session.raids.push([parsed.t, parsed.t + 90_000]);
        } else if (parsed.type === 'message') {
          const w = chatWeight(parsed.text);
          detector.push(parsed.t, w);
          recent.push({ t: parsed.t, w, m: parsed.text });
          chatOut.write(JSON.stringify({ t: parsed.t, m: parsed.text }) + '\n');
          counts.messages++;
          weightTotal += w;
        }
      }
    });
    socket.addEventListener('close', () => {
      if (ws !== socket) return;
      ws = null;
      if (stopping) return;
      if (gapStart == null) gapStart = joined ? Date.now() : lastFrame;
      const wait = backoffSeconds(++chatAttempt);
      warn(
        `${clock()} Sohbet bağlantısı koptu; ${wait} sn sonra yeniden bağlanılacak.`,
      );
      chatTimer = setTimeout(connectChat, wait * 1000);
    });
    socket.addEventListener('error', () => {
      // 'close' da gelir; yeniden bağlanma orada
    });
  };

  // --- Kayıt ----------------------------------------------------------------
  let streamlink = null;
  let ffmpeg = null;
  let recordAttempt = 0;
  let recordTimer = null;
  let runStarted = 0;
  let everLive = false;
  let announcedRun = null;
  let lastSegmentAt = null;
  let recorderDone = null;
  let waitingNoted = false;
  const openSegment = () =>
    session.segments.find((s) => s.closedAt == null && !s.pruned);
  const closeSegment = async (segment, at) => {
    segment.closedAt = at;
    const file = join(files.record, segment.file);
    segment.duration = await probeAsync(file);
    segment.size = existsSync(file) ? statSync(file).size : 0;
    saveSession();
  };
  const pollSegments = () => {
    let names;
    try {
      names = readdirSync(files.record);
    } catch {
      return;
    }
    const now = Date.now();
    for (const name of names.sort()) {
      const index = segmentIndex(name);
      if (index == null || session.segments.some((s) => s.file === name))
        continue;
      const previous = openSegment();
      if (previous) void closeSegment(previous, now);
      session.segments.push({
        file: name,
        index,
        run: session.runs,
        openedAt: now,
        closedAt: null,
        duration: null,
      });
      lastSegmentAt = now;
      if (announcedRun !== session.runs) {
        announcedRun = session.runs;
        ok(`${clock()} Yayın canlı: kayıt başladı (${quality})`);
      }
      everLive = true;
      saveSession();
    }
    if (openSegment()) lastSegmentAt = now;
  };
  const startRecorder = () => {
    if (stopping) return;
    session.runs++;
    runStarted = Date.now();
    waitingNoted = false;
    const next =
      session.segments.reduce((max, s) => Math.max(max, s.index), -1) + 1;
    // Kabuk yok, argümanlar dizi, terminal girdisi kapalı; ffmpeg yalnız streamlink'in çıktısını okur
    const sl = spawn('streamlink', streamlinkArgs({ channel, quality }), {
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    });
    const ff = spawn(
      'ffmpeg',
      segmentArgs({ segmentSeconds, startNumber: next }),
      {
        cwd: files.record,
        stdio: [sl.stdout, 'ignore', logFd],
        windowsHide: true,
      },
    );
    streamlink = sl;
    ffmpeg = ff;
    sl.stderr.on('data', (chunk) => {
      const text = String(chunk);
      try {
        writeFileSync(logFd, text);
      } catch {
        // Günlük yazılamasa da kayıt sürer
      }
      if (
        !waitingNoted &&
        /Waiting for streams|No playable streams/.test(text)
      ) {
        waitingNoted = true;
        console.log(
          `  ${clock()} Kanal şu an canlı değil; yayın açılınca kayıt kendiliğinden başlar…`,
        );
      }
      if (!stopping && /Stream ended/.test(text))
        console.log(
          `  ${clock()} Yayın akışı bitti (yayın kapanmış ya da kopmuş olabilir).`,
        );
    });
    let open = 2;
    const closed = async () => {
      if (--open > 0) {
        // Biri bittiyse diğeri de kapanır: yarım boru bırakılmaz
        killTree(sl);
        setTimeout(() => killTree(ff), 3000);
        return;
      }
      streamlink = null;
      ffmpeg = null;
      pollSegments();
      const last = openSegment();
      if (last) await closeSegment(last, Date.now());
      if (stopping) return recorderDone?.();
      if (Date.now() - runStarted > 120_000) recordAttempt = 0;
      const wait = backoffSeconds(++recordAttempt);
      warn(`${clock()} Kayıt durdu; ${wait} sn sonra yeniden denenecek.`);
      recordTimer = setTimeout(startRecorder, wait * 1000);
    };
    sl.on('error', () => {});
    ff.on('error', () => {});
    // Boru artık ffmpeg'de: ana süreçteki kopya kapatılır (yoksa yayın bitişi görülmez)
    sl.stdout.destroy();
    sl.on('exit', closed);
    ff.on('exit', closed);
  };

  // --- Adaylar --------------------------------------------------------------
  const pending = [];
  let building = false;
  const tryBuild = async (force = false) => {
    if (building || pending.length === 0) return;
    const now = Date.now();
    const item = pending[0];
    if (!force && now < item.eventWall + (POST_ROLL + 3) * 1000) return;
    // Yeni kapanan parçanın süresi ölçülürken bekle (bir sonraki saniyede yeniden denenir)
    if (
      !force &&
      session.segments.some(
        (s) => !s.pruned && s.closedAt != null && s.duration == null,
      )
    )
      return;
    building = true;
    pending.shift();
    try {
      const open = openSegment();
      if (open) {
        const duration = await probeAsync(join(files.record, open.file));
        if (duration) Object.assign(open, { probedAt: Date.now(), duration });
      }
      const plan = excerptPlan(
        segmentSpans(session.segments),
        item.eventWall - PRE_ROLL * 1000,
        item.eventWall + POST_ROLL * 1000,
        item.eventWall,
      );
      if (open && open.closedAt == null) open.duration = null;
      if (!plan) {
        counts.skipped++;
        console.log(
          `  ${clock()} Sohbet patlaması görüldü ama o an kayıtta yok (kayıt henüz başlamamış ya da kopmuştu); aday üretilmedi.`,
        );
        return;
      }
      const elapsed = (now - startedAt) / 1000;
      const moment = await builder.build({
        spike: item.spike,
        eventWall: item.eventWall,
        plan,
        messages: recent,
        chatMean: elapsed > 0 ? weightTotal / elapsed : null,
        live: true,
      });
      if (moment) {
        counts.built++;
        console.log(candidateLine(moment, true));
      } else
        warn(
          `${clock()} Bir aday üretilemedi (ayrıntı: ${files.log}); kayıt sürüyor.`,
        );
    } finally {
      building = false;
    }
  };

  // --- Kapanış --------------------------------------------------------------
  let stopPromise = null;
  const stop = (reason) => {
    if (stopPromise) return stopPromise;
    stopping = true;
    console.log(`\n${clock()} Durduruluyor: ${reason}`);
    clearInterval(ticker);
    clearTimeout(chatTimer);
    clearTimeout(recordTimer);
    stopPromise = (async () => {
      try {
        ws?.close();
      } catch {
        // Zaten kapalı
      }
      if (streamlink || ffmpeg) {
        let force;
        let giveUp;
        await new Promise((fulfill) => {
          recorderDone = fulfill;
          // streamlink kapanınca ffmpeg girdinin bittiğini görür ve son parçayı tamamlar
          killTree(streamlink, 'SIGINT');
          force = setTimeout(() => {
            killTree(streamlink);
            killTree(ffmpeg);
          }, 6000);
          giveUp = setTimeout(fulfill, 12_000);
        });
        clearTimeout(force);
        clearTimeout(giveUp);
      }
      // Bekleyen patlamalar: kayıt bitti, eldeki kadarıyla üret
      const late = detector.advance(Date.now() + 120_000);
      counts.spikes += late.length;
      pending.push(
        ...late.map((spike) => ({
          spike,
          eventWall: eventTime(spike, settings.chatOffset),
        })),
      );
      while (pending.length > 0 || building) {
        await tryBuild(true);
        if (building) await new Promise((r) => setTimeout(r, 200));
      }
      await new Promise((fulfill) => chatOut.end(fulfill));
      const recorded = session.segments.reduce(
        (sum, s) => sum + (s.duration ?? 0),
        0,
      );
      const bytes = session.segments
        .filter((s) => !s.pruned)
        .reduce((sum, s) => sum + (s.size ?? 0), 0);
      session.stoppedAt = new Date().toISOString();
      session.stopReason = reason;
      session.summary = {
        recordedSeconds: Math.round(recorded),
        segments: session.segments.length,
        prunedSegments: session.segments.filter((s) => s.pruned).length,
        recordingBytes: bytes,
        chatMessages: (session.summary?.chatMessages ?? 0) + counts.messages,
        spikes: (session.summary?.spikes ?? 0) + counts.spikes,
        candidates: builder.candidates.length,
        skippedSpikes: (session.summary?.skippedSpikes ?? 0) + counts.skipped,
        medianSecondsToCandidate: medianSeconds(builder.candidates),
      };
      saveSession();
      closeSync(logFd);
      console.log(
        `\nOturum özeti: ${formatTime(Math.round(recorded))} kayıt (${(bytes / 1024 ** 3).toFixed(2)} GB), ${counts.messages} mesaj, ${counts.spikes} patlama, ${builder.candidates.length} aday.\n` +
          `Klasör: ${dir}\n` +
          (analysisOnly
            ? 'Yalnız inceleme oturumu: klip kesilemez. İnceleme bitince klasörü sil.'
            : `Sıradaki adım: her adayın clips/inceleme/<sıra>.md dosyasını ve şeridini değerlendir, kararları clips/kararlar.json içine yaz, sonra: pnpm clip:live-cut "${dir}"`),
      );
    })();
    return stopPromise;
  };

  // --- Ana döngü ------------------------------------------------------------
  let tick = 0;
  let lowDiskNoted = false;
  let lastPing = Date.now();
  const ticker = setInterval(() => {
    const now = Date.now();
    tick++;
    pollSegments();
    for (const spike of detector.advance(now)) {
      counts.spikes++;
      pending.push({ spike, eventWall: eventTime(spike, settings.chatOffset) });
    }
    void tryBuild();
    if (recent.length > 0 && recent[0].t < now - RECENT_CHAT_MS - 60_000)
      recent = recent.filter((m) => m.t >= now - RECENT_CHAT_MS);

    // Sohbet canlılık denetimi: sunucu sessizse kendi PING'imizi yolla, yanıt gelmezse yeniden bağlan
    if (ws && joined && now - lastPing > 120_000) {
      lastPing = now;
      try {
        ws.send('PING :canli');
      } catch {
        // Kapanıyor; 'close' yeniden bağlar
      }
    }
    if (ws && now - lastFrame > 300_000) ws.close();

    if (tick % 15 === 0) {
      // Disk: bütçeyi aşan eski parçalar silinir; boş alan azalırsa kayıt düzgünce durur
      for (const segment of session.segments) {
        if (segment.pruned) continue;
        const file = join(files.record, segment.file);
        segment.size = existsSync(file) ? statSync(file).size : 0;
      }
      const doomed = planPrune(
        session.segments.map((s) => ({ ...s, closed: s.closedAt != null })),
        budgetBytes,
      );
      for (const name of doomed) {
        rmSync(join(files.record, name), { force: true });
        session.segments.find((s) => s.file === name).pruned = true;
      }
      if (doomed.length > 0) {
        console.log(
          `  ${clock()} Disk bütçesi (${options['max-disk-gb'] ?? 20} GB) aşıldı: en eski ${doomed.length} parça silindi (adayların kesitleri duruyor).`,
        );
        saveSession();
      }
      let free = NaN;
      try {
        const fsStat = statfsSync(dir);
        free = Number(fsStat.bavail) * Number(fsStat.bsize);
      } catch {
        // Ölçülemiyorsa bütçe sınırı yine korur
      }
      const verdict = diskVerdict(free);
      if (verdict === 'stop')
        void stop(
          `diskte ${(free / 1024 ** 3).toFixed(1)} GB boş alan kaldı; disk dolmasın diye kayıt durduruldu. Yer açıp aynı komutla sürdürebilirsin.`,
        );
      else if (verdict === 'low' && !lowDiskNoted) {
        lowDiskNoted = true;
        warn(
          `Diskte ${(free / 1024 ** 3).toFixed(1)} GB boş alan var; 3 GB altına inerse kayıt durur.`,
        );
      }
    }
    if (tick % 300 === 0) {
      const size = session.segments
        .filter((s) => !s.pruned)
        .reduce((sum, s) => sum + (s.size ?? 0), 0);
      console.log(
        `  ${clock()} ${everLive ? 'kayıt' : 'bekleme'} · ${counts.messages} mesaj · ${counts.spikes} patlama · ${builder.candidates.length} aday · ${(size / 1024 ** 3).toFixed(2)} GB`,
      );
    }
    if (now - startedAt > maxHours * 3600_000)
      void stop(`--max-hours süresi (${maxHours} saat) doldu.`);
    else if (
      everLive &&
      !openSegment() &&
      lastSegmentAt != null &&
      now - lastSegmentAt > END_GRACE_MS
    )
      void stop('yayın bitti (10 dakikadır geri gelmedi).');
  }, 1000);

  let signals = 0;
  for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP'])
    process.on(signal, () => {
      if (++signals > 1) {
        killTree(streamlink);
        killTree(ffmpeg);
        builder.kill();
        process.exit(130);
      }
      void stop('kullanıcı durdurdu.');
    });
  // Beklenmedik çıkışta çocuk süreç bırakma
  process.on('exit', () => {
    killTree(streamlink);
    killTree(ffmpeg);
    builder.kill();
  });

  connectChat();
  startRecorder();
  await new Promise((fulfill) => {
    const wait = setInterval(() => {
      if (stopPromise) {
        clearInterval(wait);
        stopPromise.then(fulfill);
      }
    }, 250);
  });
}

function medianSeconds(candidates) {
  const values = candidates
    .map((m) => m.timing?.secondsFromEvent)
    .filter((v) => Number.isFinite(v))
    .sort((a, b) => a - b);
  return values.length ? values[values.length >> 1] : null;
}

// ---------------------------------------------------------------------------
// clip:live-cut
// ---------------------------------------------------------------------------

function liveCut(argv) {
  const { positional, options } = parseCli(argv, {
    values: [
      'only',
      'keep',
      'permission',
      'open-license',
      'layout',
      'translate',
    ],
    flags: ['own', 'keep-all', 'no-subs'],
  });
  if (positional.length !== 1)
    throw new Error(
      'Kullanım: pnpm clip:live-cut <oturum-klasörü> [--only 1,4] [--translate tr] [--layout blur|crop] [--keep 2] [--keep-all] [--no-subs] [--permission "<izin referansı>" | --open-license "<lisans>" | --own]',
    );
  const dir = resolve(positional[0]);
  const files = sessionFiles(dir);
  if (!existsSync(files.session))
    throw new Error(
      'Bu klasörde session.json yok: canlı izleme oturumu değil.',
    );
  const session = readJson(files.session);
  if (session.analysisOnly)
    throw new Error(
      'Bu oturum yalnız inceleme için kaydedildi (--analysis-only): klip kesilemez. Kaydı sil; izin gelince yayını izinle yeniden kaydet.',
    );
  // Hak durumu: komut satırında verilmediyse kaydı başlatırken girilen kullanılır
  const stored = session.rights;
  const given = options.own || options.permission || options['open-license'];
  const rightsOptions =
    given || !stored
      ? options
      : stored.sourceType === 'own'
        ? { own: true }
        : stored.sourceType === 'open_license'
          ? { 'open-license': stored.permission }
          : { permission: stored.permission };
  // Tam olarak bir seçenek yoksa burada durur (mevcut kural)
  sourceRights(rightsOptions);
  const rightsArgs = rightsOptions.own
    ? ['--own']
    : rightsOptions.permission
      ? ['--permission', rightsOptions.permission]
      : ['--open-license', rightsOptions['open-license']];
  const target = options.translate ?? session.translate ?? undefined;
  if (target != null && !/^[a-z]{2,3}$/.test(target))
    throw new Error('--translate bir dil kodu ister. Örnek: --translate tr');

  const list = loadCandidates(dir);
  if (list.length === 0) throw new Error('Bu oturumda aday yok.');
  const decisions = existsSync(files.decisions)
    ? parseDecisions(
        readJson(files.decisions),
        list.map((m) => ({ rank: m.rank, peak: m.peak })),
      )
    : new Map();
  const only = new Set(rankList(options.only, 'only'));
  const forced = new Set(rankList(options.keep, 'keep'));
  for (const rank of [...only, ...forced])
    if (!list.some((m) => m.rank === rank))
      throw new Error(`${rank} numaralı aday yok.`);
  // İnsan seçimi: komut satırındaki --only ya da kararlar.json'daki "keep"
  const chosen = list.filter((m) =>
    only.size > 0
      ? only.has(m.rank)
      : decisions.get(m.rank)?.decision === 'keep',
  );
  if (chosen.length === 0)
    throw new Error(
      `Kesilecek aday seçilmemiş. ${list.length} aday var: inceleme dosyalarını değerlendirip ${files.decisions} içinde "decision": "keep" yaz ya da --only 1,4 ile seç.`,
    );

  const subsDir = join(files.clips, 'altyazi');
  const clips = [];
  let waiting = 0;
  let skipped = 0;
  for (const m of chosen) {
    const decision = decisions.get(m.rank);
    if (
      m.quality.verdict === 'ele' &&
      !options['keep-all'] &&
      !forced.has(m.rank)
    ) {
      skipped++;
      console.log(
        `  ${pad2(m.rank)} kalite kontrolünden geçmedi (${m.quality.reasons[0]}); yine de kesmek için --keep ${m.rank}.`,
      );
      continue;
    }
    const work = join(dir, m.clip.dir);
    const video = join(work, m.clip.file);
    if (!existsSync(video)) {
      skipped++;
      warn(`${pad2(m.rank)} adayının kesiti bulunamadı; atlandı.`);
      continue;
    }
    const start = Math.max(0, m.clip.start + (decision?.shiftStart ?? 0));
    const end = Math.min(
      m.clip.duration,
      m.clip.end + (decision?.shiftEnd ?? 0),
    );
    validateRange(start, end, m.clip.duration);
    if (decision && (decision.shiftStart || decision.shiftEnd)) {
      // Kaydırılan sınır cümle ortasına denk geliyorsa haber ver (kalite raporu eski aralığa aittir)
      const breaks = m.clip.breaks ?? [];
      if (
        !boundaryKind(start, 'start', breaks, m.clip.duration) ||
        !boundaryKind(end, 'end', breaks, m.clip.duration)
      )
        console.log(
          `  ${pad2(m.rank)} kaydırılan sınır doğal bir durağa denk gelmiyor; klibi izleyerek kontrol et.`,
        );
    }
    const stem = stemOf(m);
    const name = `${stem}.mp4`;
    const output = join(files.clips, name);
    const base = [
      video,
      '--start',
      String(start),
      '--end',
      String(end),
      '--out',
      output,
      ...rightsArgs,
      ...(options.layout ? ['--layout', options.layout] : []),
      ...(decision?.caption ? ['--caption', decision.caption] : []),
    ];
    const subtitle = options['no-subs']
      ? null
      : (readdirSync(work).find((n) => n.endsWith('.whisper.vtt')) ?? null);
    let subs = subtitle ? join(work, subtitle) : null;
    if (existsSync(output)) {
      ok(`${name} zaten var; atlandı`);
      clips.push({ file: name, rank: m.rank });
      continue;
    }
    if (target && subtitle && !subtitle.includes(`.${target}.`)) {
      mkdirSync(subsDir, { recursive: true });
      const original = join(subsDir, `${stem}.srt`);
      const translated = join(subsDir, `${stem}.${target}.srt`);
      const text = clipSrt(
        parseSubtitles(readFileSync(subs, 'utf8')),
        start,
        end,
        { absolute: true },
      );
      if (!text) subs = null;
      else if (existsSync(translated)) subs = translated;
      else {
        if (!existsSync(original)) writeFileSync(original, text);
        waiting++;
        continue;
      }
    }
    let subtitled = false;
    if (subs) {
      try {
        cut([...base, '--subs', subs]);
        subtitled = true;
      } catch (error) {
        if (!/altyazı satırı yok/.test(error.message)) throw error;
        cut(base);
      }
    } else cut(base);
    clips.push({
      file: name,
      rank: m.rank,
      start: formatTime(parseTime(m.start) + (start - m.clip.start), {
        tenths: true,
      }),
      seconds: Math.round((end - start) * 10) / 10,
      subtitled,
      title: decision?.title || null,
      caption: decision?.caption || null,
      quality: { score: m.quality.score, verdict: m.quality.verdict },
    });
  }
  if (waiting > 0)
    console.log(
      `\n${waiting} klip çeviri bekliyor: ${subsDir}\n` +
        `Her <ad>.srt dosyasını çevirip yanına <ad>.${target}.srt olarak kaydet: satır numaraları ve zamanlar aynı kalır, yalnız metin değişir. ` +
        'Sonra aynı komutu yeniden çalıştır.',
    );
  writeJson(join(files.clips, 'clips.json'), {
    source: {
      platform: 'twitch',
      channel: session.channel,
      channelUrl: session.channelUrl,
      live: true,
    },
    clips,
  });
  if (session.quality && !/best|1080|720/.test(session.quality))
    warn(
      `Oturum "${session.quality}" kalitesinde kaydedilmiş; yayınlanacak klip için en az 720p kayıt gerekir.`,
    );
  console.log(
    `\n${clips.length} klip hazır${skipped ? `, ${skipped} aday atlandı` : ''}: ${files.clips}\n` +
      'Yayından önce hepsini izle; otomatik paylaşım yoktur.',
  );
}

const [mode, ...rest] = process.argv.slice(2);
try {
  if (mode === 'live') {
    await live(rest);
    // Kapanış tamam: geride kalan zamanlayıcılar süreci bekletmesin
    if (rest.length > 0 && !rest.includes('--replay'))
      process.exit(process.exitCode ?? 0);
  } else if (mode === 'live-cut') liveCut(rest);
  else if (mode === 'build') await buildCandidate(rest[0]);
  else
    throw new Error(
      'Kullanım: pnpm clip:live <kanal-adresi> --permission …  |  pnpm clip:live --replay <oturum-klasörü>  |  pnpm clip:live-cut <oturum-klasörü>',
    );
} catch (error) {
  console.error(`\x1b[31m[HATA]\x1b[0m ${error.message}`);
  process.exitCode = 1;
}
