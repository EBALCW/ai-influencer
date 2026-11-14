// Frame-exact sound effects: where each sound's sync point is, a cue mixer that lands every sync point on its frame,
// and checks on the finished video. Needs FFmpeg; no other dependencies.
//
// A cue is { t, sound, gain?, pan?, dur?, bed?, label? }: t is the moment its event first shows on screen. A change at
// time t is drawn on frame ceil(t * fps), so cue times are snapped up to that frame. Each sound is placed so its sync
// point plays on the cue: struck sounds (clicks, pops, dings, shutters, hits) on their first strong attack, swells
// (whooshes, risers, shimmers) on their peak. A bed (typing, ambience) starts on its cue instead.
import crypto from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import { run } from "./process.mjs";
import { SOUND_DEFINITIONS, wavBuffer } from "./sfx.mjs";

export const SAMPLE_RATE = 48_000;
export const SFX_DIR = fileURLToPath(new URL("../assets/sfx/", import.meta.url));
const BIN = 0.002;          // envelope resolution, seconds
const STRUCK_DB = 12;       // a struck sound's level jumps at least this much within 10 ms at its attack

/** Decode any audio or video file to interleaved stereo float32 at 48 kHz. */
export async function decodeStereo(file, { seconds, start } = {}) {
  const args = ["-v", "error", ...(start ? ["-ss", String(start)] : []), ...(seconds ? ["-t", String(seconds)] : []),
    "-i", file, "-vn", "-ac", "2", "-ar", String(SAMPLE_RATE), "-f", "f32le", "-"];
  const bytes = await runCaptureBuffer("ffmpeg", args);
  return new Float32Array(bytes.buffer, bytes.byteOffset, Math.floor(bytes.byteLength / 4));
}

function runCaptureBuffer(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: ["ignore", "pipe", "pipe"] });
    const chunks = [];
    let stderr = "";
    child.stdout.on("data", (chunk) => chunks.push(chunk));
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.once("error", reject);
    child.once("exit", (code) => (code === 0 ? resolve(Buffer.concat(chunks)) : reject(new Error(`${command} exited ${code}: ${stderr.trim()}`))));
  });
}

/** Peak envelope over both channels in 2 ms bins, lightly smoothed. */
export function envelope(stereo, sampleRate = SAMPLE_RATE) {
  const hop = Math.max(1, Math.round(sampleRate * BIN));
  const frames = Math.floor(stereo.length / 2);
  const bins = Math.floor(frames / hop);
  const raw = new Float64Array(Math.max(1, bins));
  for (let b = 0; b < bins; b += 1) {
    let peak = 0;
    for (let i = b * hop; i < (b + 1) * hop; i += 1) peak = Math.max(peak, Math.abs(stereo[2 * i]), Math.abs(stereo[2 * i + 1]));
    raw[b] = peak;
  }
  const smooth = new Float64Array(raw.length);
  for (let b = 0; b < raw.length; b += 1) smooth[b] = ((raw[b - 1] ?? 0) + raw[b] + (raw[b + 1] ?? 0)) / 3;
  return smooth;
}

/** Where to sync one sound: { attack, peak, struck, sync } in seconds from the start of the file. */
export function syncPoint(stereo, sampleRate = SAMPLE_RATE) {
  const env = envelope(stereo, sampleRate);
  let top = 0;
  let peakBin = 0;
  env.forEach((v, b) => { if (v > top) { top = v; peakBin = b; } });
  if (top <= 0) return { attack: 0, peak: 0, struck: true, sync: 0 };
  const attackBin = env.findIndex((v) => v >= 0.5 * top);
  const floor = (b) => Math.max(b < 0 ? 0 : env[b], 0.02 * top);   // ignore the noise floor; before the file is silence
  const step = Math.round(0.01 / BIN);                                // the level jump over 10 ms, around the attack
  let jump = 1;
  for (let b = Math.max(0, attackBin - step); b < Math.min(env.length, attackBin + 3); b += 1) jump = Math.max(jump, floor(b) / floor(b - step));
  const struck = 20 * Math.log10(jump) >= STRUCK_DB;
  const round = (v) => Math.round(v * 1000) / 1000;
  const attack = round(attackBin * BIN);
  const peak = round(peakBin * BIN);
  return { attack, peak, struck, sync: struck ? attack : peak };
}

/** The first frame that shows an event at time t, as a time. Times within 0.5 % of a frame count as on it (rounded input). */
export function snapUp(t, fps) {
  return (Math.ceil(t * fps - 0.005) || 0) / fps;
}

// Synthesized pack sounds don't ship as audio: each is made from its definition in lib/sfx.mjs on first use, checked
// against the manifest's checksum, and kept in a small cache.
export const SYNTH_CACHE = path.join(os.tmpdir(), "favstash-sfx");

/** The audio file for one manifest sound: the shipped recording, or the synthesized sound from the cache. */
export async function packFile(dir, sound) {
  const shipped = path.join(dir, sound.file);
  if (sound.origin === "curated") return shipped;
  try { await fs.access(shipped); return shipped; } catch {}
  const cached = path.join(SYNTH_CACHE, `${sound.id}-${sound.sha256.slice(0, 12)}.wav`);
  try { await fs.access(cached); return cached; } catch {}
  const definition = SOUND_DEFINITIONS.find((d) => d.id === sound.id);
  if (!definition) throw new Error(`No definition for the synthesized sound ${sound.id}`);
  const buffer = wavBuffer(definition);
  if (crypto.createHash("sha256").update(buffer).digest("hex") !== sound.sha256) {
    throw new Error(`The synthesized ${sound.id} no longer matches its manifest checksum; run scripts/generate-sfx.mjs`);
  }
  await fs.mkdir(SYNTH_CACHE, { recursive: true });
  const partial = `${cached}.${process.pid}.part`;
  await fs.writeFile(partial, buffer);
  await fs.rename(partial, cached);
  return cached;
}

/** Read the pack manifest: id/file -> { file, gainDb }. */
export async function loadPack(dir = SFX_DIR) {
  const manifest = JSON.parse(await fs.readFile(path.join(dir, "manifest.json"), "utf8"));
  const byKey = new Map();
  for (const sound of manifest.sounds) {
    const entry = { id: sound.id, file: await packFile(dir, sound), gainDb: sound.suggestedGainDb ?? -12 };
    byKey.set(sound.id, entry);
    byKey.set(sound.file, entry);
    byKey.set(`curated/${sound.id}.wav`, entry);   // the names these sounds had when they shipped as recordings
  }
  return byKey;
}

/** Resolve a cue's sound: a pack id, a pack-relative file, or a path relative to the cue sheet. */
export function resolveSound(sound, pack, baseDir) {
  const known = pack.get(sound) ?? pack.get(String(sound).replace(/^.*assets\/sfx\//, ""));
  if (known) return known;
  return { id: path.basename(sound), file: path.resolve(baseDir, sound), gainDb: 0 };
}

/**
 * Plan where every cue's file starts. Returns [{ ...cue, file, frameTime, start, sync, struck, gainDb }].
 * frameTime = the cue snapped up to its frame; start = frameTime - sync (beds start on the frame).
 */
export async function planCues(sheet, { fps, baseDir = process.cwd(), pack } = {}) {
  const rate = fps ?? sheet.fps ?? 30;
  const sounds = pack ?? await loadPack();
  const points = new Map();
  const planned = [];
  for (const cue of sheet.cues) {
    if (!Number.isInteger(cue.frame) && !Number.isFinite(cue.t)) throw new Error(`Cue ${JSON.stringify(cue)} needs a frame or a numeric t.`);
    const sound = resolveSound(cue.sound, sounds, baseDir);
    if (!points.has(sound.file)) {
      const stereo = await decodeStereo(sound.file);
      points.set(sound.file, { ...syncPoint(stereo), duration: stereo.length / 2 / SAMPLE_RATE });
    }
    const point = points.get(sound.file);
    const frameTime = Number.isInteger(cue.frame) ? cue.frame / rate : snapUp(cue.t, rate);
    const sync = cue.bed ? 0 : point.sync;
    const duration = cue.dur ? Math.min(cue.dur, point.duration) : point.duration;
    planned.push({ ...cue, file: sound.file, frameTime, start: frameTime - sync, sync, struck: point.struck, duration, gainDb: sound.gainDb + (cue.gain ?? 0) });
  }
  return planned;
}

/**
 * Sum planned cues into a stereo buffer `seconds` long. Returns { buffer, clipped }: clipped counts swells that start
 * before 0 s and lose part of their build (a struck sound only loses the silence before its attack).
 */
export async function renderCues(planned, seconds) {
  const frames = Math.ceil(seconds * SAMPLE_RATE);
  const out = new Float32Array(frames * 2);
  const cache = new Map();
  let clipped = 0;
  for (const cue of planned) {
    if (!cache.has(cue.file)) cache.set(cue.file, await decodeStereo(cue.file));
    const src = cache.get(cue.file);
    const gain = 10 ** (cue.gainDb / 20);
    const pan = Math.max(-1, Math.min(1, cue.pan ?? 0));
    const left = gain * Math.cos((pan + 1) * Math.PI / 4) * Math.SQRT2;
    const right = gain * Math.sin((pan + 1) * Math.PI / 4) * Math.SQRT2;
    const length = Math.floor(src.length / 2);
    const limit = cue.dur ? Math.min(length, Math.round(cue.dur * SAMPLE_RATE)) : length;
    const fade = Math.round(0.01 * SAMPLE_RATE);
    const offset = Math.round(cue.start * SAMPLE_RATE);
    let first = 0;
    if (offset < 0) { first = -offset; if (!cue.struck) clipped += 1; }
    for (let i = first; i < limit; i += 1) {
      const at = offset + i;
      if (at >= frames) break;
      const tail = cue.dur && i > limit - fade ? (limit - i) / fade : 1;
      out[2 * at] += src[2 * i] * left * tail;
      out[2 * at + 1] += src[2 * i + 1] * right * tail;
    }
  }
  return { buffer: out, clipped };
}

/**
 * Lower the effects under the voice: a sidechain duck driven by the voice's level (10 ms attack, 180 ms release).
 * duckDb is the full reduction while the voice speaks at normal level.
 */
export function duckUnder(effects, voice, { duckDb = 6 } = {}) {
  const frames = Math.floor(effects.length / 2);
  const attack = 1 - Math.exp(-1 / (0.01 * SAMPLE_RATE));
  const release = 1 - Math.exp(-1 / (0.18 * SAMPLE_RATE));
  let level = 0;
  for (let i = 0; i < frames; i += 1) {
    const v = i < voice.length / 2 ? Math.max(Math.abs(voice[2 * i]), Math.abs(voice[2 * i + 1])) : 0;
    level += (v - level) * (v > level ? attack : release);
    const db = 20 * Math.log10(level + 1e-9);
    const amount = Math.max(0, Math.min(1, (db + 40) / 15));   // none below -40 dBFS, full from -25 dBFS
    const g = 10 ** (-duckDb * amount / 20);
    effects[2 * i] *= g;
    effects[2 * i + 1] *= g;
  }
  return effects;
}

/** Write interleaved stereo float32 as a 48 kHz WAV (24-bit by default) through FFmpeg. */
export async function writeWav(file, stereo, { codec = "pcm_s24le", filter } = {}) {
  await fs.mkdir(path.dirname(path.resolve(file)), { recursive: true });
  const raw = `${file}.f32`;
  await fs.writeFile(raw, Buffer.from(stereo.buffer, stereo.byteOffset, stereo.byteLength));
  try {
    await run("ffmpeg", ["-v", "error", "-y", "-f", "f32le", "-ar", String(SAMPLE_RATE), "-ac", "2", "-i", raw,
      ...(filter ? ["-af", filter] : []), "-c:a", codec, file], { stdio: "inherit" });
  } finally {
    await fs.rm(raw, { force: true });
  }
}

/** Integrated loudness (LUFS) and true peak (dBTP) of a file. */
export async function loudness(file) {
  const text = await new Promise((resolve, reject) => {
    const child = spawn("ffmpeg", ["-nostats", "-hide_banner", "-i", file, "-vn", "-af", "ebur128=peak=true", "-f", "null", "-"], { stdio: ["ignore", "ignore", "pipe"] });
    let stderr = "";
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.once("error", reject);
    child.once("exit", (code) => (code === 0 ? resolve(stderr) : reject(new Error(`ffmpeg ebur128 failed: ${stderr.slice(-400)}`))));
  });
  const summary = text.slice(text.lastIndexOf("Summary:"));
  const integrated = Number(summary.match(/I:\s+(-?[\d.]+|-inf) LUFS/)?.[1]);
  const truePeak = Number(summary.match(/Peak:\s+(-?[\d.]+|-inf) dBFS/)?.[1]);
  return { integrated, truePeak };
}

/**
 * Bring a WAV to a loudness target with a true-peak ceiling: one gain, then a limiter only if the peak needs it.
 * The renderer turns a whole track down when its encoded true peak passes -1 dBTP; AAC overshoots sharp clicks,
 * so the default ceiling is -2.5 dBTP.
 */
export async function master(input, output, { lufs = -14, truePeak = -2.5 } = {}) {
  const before = await loudness(input);
  if (!Number.isFinite(before.integrated)) throw new Error(`${input} is silent; nothing to master.`);
  // alimiter works on sample peaks: aim 1 dB under the true-peak ceiling and run it 4x oversampled.
  const limit = 10 ** ((truePeak - 1) / 20);
  let gain = lufs - before.integrated;
  let after = null;
  let limited = false;
  // Limiting lowers the loudness a little, so add the shortfall back and limit again (at most three passes).
  for (let pass = 0; pass < 3; pass += 1) {
    limited = before.truePeak + gain > truePeak;
    const filter = `volume=${gain.toFixed(2)}dB${limited ? `,aresample=${SAMPLE_RATE * 4},alimiter=limit=${limit.toFixed(4)}:attack=1:release=60:level=false,aresample=${SAMPLE_RATE}` : ""}`;
    await run("ffmpeg", ["-v", "error", "-y", "-i", input, "-af", filter, "-ar", String(SAMPLE_RATE), "-c:a", "pcm_s24le", output], { stdio: "inherit" });
    after = await loudness(output);
    if (!limited || Math.abs(after.integrated - lufs) <= 0.3) break;
    gain += lufs - after.integrated;
  }
  return { before, after, gainDb: Math.round(gain * 100) / 100, limited };
}

/**
 * Check every struck cue's placement: render it alone around its frame and measure where its attack lands.
 * Returns [{ index, label, errorMs }]; |errorMs| <= 2 is one envelope bin.
 */
export async function verifyPlacement(planned) {
  const results = [];
  const lead = 0.2;
  for (const [index, cue] of planned.entries()) {
    if (!cue.struck || cue.bed || cue.start < 0) continue;
    const shift = cue.frameTime - lead;
    const { buffer } = await renderCues([{ ...cue, start: cue.start - shift }], lead + cue.duration + 0.05);
    results.push({ index, label: cue.label ?? cue.sound, errorMs: Math.round((measureAttack(buffer, lead) - lead) * 10000) / 10 });
  }
  return results;
}

/** Find where a struck sound actually starts near `t` in a stereo buffer: the first bin reaching half its local max. */
export function measureAttack(stereo, t, { window = 0.12 } = {}) {
  const from = Math.max(0, Math.round((t - window / 2) * SAMPLE_RATE));
  const to = Math.min(stereo.length / 2, Math.round((t + window) * SAMPLE_RATE));
  const slice = stereo.subarray(2 * from, 2 * to);
  const point = syncPoint(slice);
  return from / SAMPLE_RATE + point.attack;
}

/** Lag of `track` behind `reference` in samples (positive = track is late), searched within ±maxMs. */
export function alignment(track, reference, { maxMs = 200 } = {}) {
  const mono = (s) => { const m = new Float32Array(s.length / 2); for (let i = 0; i < m.length; i += 1) m[i] = (s[2 * i] + s[2 * i + 1]) / 2; return m; };
  const a = mono(track);
  const b = mono(reference);
  const n = Math.min(a.length, b.length);
  // Coarse: 1 ms energy envelopes; fine: raw samples within ±1.5 ms of the coarse lag.
  const hop = SAMPLE_RATE / 1000;
  const envOf = (x) => { const e = new Float32Array(Math.floor(n / hop)); for (let k = 0; k < e.length; k += 1) { let s = 0; for (let i = k * hop; i < (k + 1) * hop; i += 1) s += x[i] * x[i]; e[k] = Math.sqrt(s / hop); } return e; };
  const ea = envOf(a);
  const eb = envOf(b);
  const score = (x, y, lag, length) => { let s = 0; for (let i = Math.max(0, -lag); i < length && i + lag < x.length; i += 1) s += x[i + lag] * y[i]; return s; };
  let best = 0;
  let bestScore = -Infinity;
  for (let lag = -maxMs; lag <= maxMs; lag += 1) { const s = score(ea, eb, lag, eb.length); if (s > bestScore) { bestScore = s; best = lag; } }
  const centre = best * hop;
  const span = Math.min(n, 10 * SAMPLE_RATE);
  bestScore = -Infinity;
  let fine = centre;
  for (let lag = centre - 72; lag <= centre + 72; lag += 1) { const s = score(a, b, lag, span); if (s > bestScore) { bestScore = s; fine = lag; } }
  return fine;
}

/**
 * Seven frames around each cue as one strip, the frame its sound plays on boxed in red. Writes JPGs; returns their paths.
 * crop = "x,y,w,h" in video pixels zooms every frame to that region, for small UI details.
 */
export async function strips(video, planned, { fps = 30, width = 180, crop, outDir, perSheet = 8 } = {}) {
  if (crop && !/^\d+,\d+,\d+,\d+$/.test(crop)) throw new Error(`--crop must be x,y,w,h in pixels, not "${crop}".`);
  const [cx, cy, cw, ch] = crop ? crop.split(",") : [];
  const cropFilter = crop ? `crop=${cw}:${ch}:${cx}:${cy},` : "";   // FFmpeg's order is w:h:x:y
  await fs.mkdir(outDir, { recursive: true });
  const rows = [];
  for (const [index, cue] of planned.entries()) {
    const frame = Math.round(cue.frameTime * fps);
    const first = Math.max(0, frame - 3);
    const red = frame - first;
    // Seek half a frame early: a seek time rounded up past a frame's timestamp would drop that frame and shift the strip.
    const row = path.join(outDir, `.row-${String(index).padStart(3, "0")}.jpg`);
    await run("ffmpeg", ["-v", "error", "-y", "-ss", (Math.max(0, first - 0.5) / fps).toFixed(4), "-i", video,
      "-vf", `${cropFilter}scale=${width}:-2,pad=iw+6:ih+6:3:3:0x141414,tile=7x1,drawbox=x=${red * (width + 6)}:y=0:w=${width + 6}:h=ih:color=0xff3c3c:t=4`,
      "-frames:v", "1", "-q:v", "4", row], { stdio: "inherit" });
    rows.push({ row, cue, index });
  }
  const sheets = [];
  for (let s = 0; s < rows.length; s += perSheet) {
    const group = rows.slice(s, s + perSheet);
    const sheet = path.join(outDir, `sync-${String(sheets.length + 1).padStart(2, "0")}.jpg`);
    const inputs = group.flatMap((r) => ["-i", r.row]);
    const filter = group.length > 1 ? `vstack=inputs=${group.length}` : "null";
    await run("ffmpeg", ["-v", "error", "-y", ...inputs, "-filter_complex", filter, "-q:v", "4", sheet], { stdio: "inherit" });
    sheets.push({ sheet, cues: group.map((r) => `${r.index}: ${r.cue.label ?? r.cue.sound} @ frame ${Math.round(r.cue.frameTime * fps)}`) });
  }
  await Promise.all(rows.map((r) => fs.rm(r.row, { force: true })));
  return sheets;
}
