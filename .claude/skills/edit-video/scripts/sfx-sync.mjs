#!/usr/bin/env node
// Frame-exact sound effects. See references/sound-sync.md.
//
//   node <skill>/scripts/sfx-sync.mjs points [sound ...] [--json out.json]
//   node <skill>/scripts/sfx-sync.mjs mix <cues.json> --out <mix.wav> [--voice <voice.wav>] [--duck 6]
//        [--lufs -14] [--true-peak -2.5] [--seconds N] [--video <silent.mp4> --mux <final.mp4>]
//   node <skill>/scripts/sfx-sync.mjs check <video> --mix <mix.wav> [--cues <cues.json> --strips <dir>] [--min-gain -6]
//        [--width 180] [--crop x,y,w,h]
import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { parseArgs, optionalNumber } from "../lib/args.mjs";
import { run } from "../lib/process.mjs";
import {
  SAMPLE_RATE, alignment, decodeStereo, duckUnder, loadPack, loudness, master, planCues, renderCues,
  strips, syncPoint, verifyPlacement, writeWav,
} from "../lib/sync.mjs";

const USAGE = `Usage:
  sfx-sync.mjs points [sound ...] [--json out.json]        sync point of each sound (default: the whole pack)
  sfx-sync.mjs mix <cues.json> --out <mix.wav> [--voice <voice.wav>] [--duck 6] [--lufs -14] [--true-peak -2.5]
               [--seconds N] [--video <silent.mp4> --mux <final.mp4>]
  sfx-sync.mjs check <video> --mix <mix.wav> [--cues <cues.json> --strips <dir>] [--min-gain -6] [--width 180] [--crop x,y,w,h]`;

const args = parseArgs(process.argv.slice(2));
const [command, ...rest] = args._;
if (args.help || !command) {
  console.log(USAGE);
  process.exit(args.help ? 0 : 1);
}

async function readSheet(file) {
  const data = JSON.parse(await fs.readFile(file, "utf8"));
  const sheet = Array.isArray(data) ? { cues: data } : data;
  if (!Array.isArray(sheet.cues)) throw new Error(`${file} needs a "cues" list.`);
  return sheet;
}

async function points() {
  // Pack sounds go through loadPack, which makes the synthesized ones on first use; anything else is a file path.
  const pack = await loadPack();
  const entries = rest.length
    ? rest.map((sound) => pack.get(sound) ?? { id: path.basename(sound), file: path.resolve(sound) })
    : [...new Map([...pack.values()].map((entry) => [entry.id, entry])).values()];
  const rows = [];
  for (const { id, file } of entries) {
    const point = syncPoint(await decodeStereo(file));
    rows.push({ id, file, ...point });
    const kind = point.struck ? "struck: attack" : "swell: peak";
    console.log(`sync ${point.sync.toFixed(3).padStart(6)} s  ${kind.padEnd(14)}  attack ${point.attack.toFixed(3)}  peak ${point.peak.toFixed(3)}  ${id}`);
  }
  if (typeof args.json === "string") await fs.writeFile(args.json, `${JSON.stringify(rows, null, 2)}\n`);
}

async function mix() {
  const cueFile = rest[0];
  if (!cueFile || typeof args.out !== "string") throw new Error(USAGE);
  const sheet = await readSheet(cueFile);
  const fps = optionalNumber(args, "fps", sheet.fps ?? 30, { min: 1 });
  const planned = await planCues(sheet, { fps, baseDir: path.dirname(path.resolve(cueFile)), pack: await loadPack() });
  const voice = typeof args.voice === "string" ? await decodeStereo(args.voice) : null;
  const longestCue = Math.max(0, ...planned.map((cue) => cue.start + 2));
  const seconds = optionalNumber(args, "seconds", sheet.total ?? Math.max(longestCue, voice ? voice.length / 2 / SAMPLE_RATE : 0), { min: 0.1 });

  const { buffer: effects, clipped } = await renderCues(planned, seconds);
  const out = path.resolve(args.out);
  const base = out.replace(/\.wav$/i, "");
  await writeWav(`${base}.sfx.wav`, effects);                        // the effects alone, before ducking: what check measures

  // Verify the plan: every struck cue, rendered alone, should start on its frame (2 ms envelope bins).
  const measured = await verifyPlacement(planned);
  const worst = measured.reduce((max, row) => (max && Math.abs(max.errorMs) >= Math.abs(row.errorMs) ? max : row), null);

  const ducked = voice ? duckUnder(effects, voice, { duckDb: optionalNumber(args, "duck", 6, { min: 0, max: 30 }) }) : effects;
  if (voice) for (let i = 0; i < Math.min(ducked.length, voice.length); i += 1) ducked[i] += voice[i];
  const premix = `${base}.premix.wav`;
  await writeWav(premix, ducked, { codec: "pcm_f32le" });
  const result = await master(premix, out, { lufs: optionalNumber(args, "lufs", -14), truePeak: optionalNumber(args, "true-peak", -2.5) });
  await fs.rm(premix, { force: true });
  await fs.writeFile(`${base}.plan.json`, `${JSON.stringify({ fps, seconds, cues: planned.map(({ file, ...cue }) => ({ ...cue, file: path.relative(path.dirname(out), file) })) }, null, 2)}\n`);

  console.log(`${planned.length} cues on ${seconds.toFixed(2)} s at ${fps} fps${voice ? `, ducked ${args.duck ?? 6} dB under the voice` : ""}`);
  if (clipped) console.log(`warning: ${clipped} swell(s) start before 0 s and lose part of their build; move them later or trim them`);
  if (worst) console.log(`sync: ${measured.length} struck cues placed, worst ${worst.errorMs} ms from its frame (${worst.label})${Math.abs(worst.errorMs) > 4 ? "  <- check this cue" : ""}`);
  console.log(`loudness ${result.after.integrated} LUFS, true peak ${result.after.truePeak} dBTP${result.limited ? " (limited)" : ""} -> ${out}`);

  if (typeof args.video === "string" || typeof args.mux === "string") {
    if (typeof args.video !== "string" || typeof args.mux !== "string") throw new Error("Pass both --video <silent.mp4> and --mux <final.mp4>.");
    await fs.mkdir(path.dirname(path.resolve(args.mux)), { recursive: true });
    await run("ffmpeg", ["-v", "error", "-y", "-i", args.video, "-i", out, "-map", "0:v:0", "-map", "1:a:0", "-c:v", "copy",
      "-c:a", "aac", "-b:a", "256k", "-ar", String(SAMPLE_RATE), "-t", String(seconds), "-movflags", "+faststart", args.mux], { stdio: "inherit" });
    const encoded = await loudness(args.mux);
    console.log(`muxed -> ${args.mux} (encoded true peak ${encoded.truePeak} dBTP${encoded.truePeak > -1 ? "; over -1, lower --true-peak" : ""})`);
  }
}

async function check() {
  const video = rest[0];
  if (!video || typeof args.mix !== "string") throw new Error(USAGE);
  const [track, reference] = await Promise.all([decodeStereo(video, { seconds: 15 }), decodeStereo(args.mix, { seconds: 15 })]);
  if (!track.length) throw new Error(`${video} has no audio track.`);
  const lag = alignment(track, reference);
  console.log(`audio track vs mix: ${lag} samples (${(lag / SAMPLE_RATE * 1000).toFixed(1)} ms)${lag === 0 ? "" : "  <- not aligned"}`);
  const level = await loudness(video);
  console.log(`video audio: ${level.integrated} LUFS, true peak ${level.truePeak} dBTP${level.truePeak > -1 ? "  <- over -1 dBTP" : ""}`);
  if (typeof args.cues === "string" && typeof args.strips === "string") {
    const sheet = await readSheet(args.cues);
    const fps = optionalNumber(args, "fps", sheet.fps ?? 30, { min: 1 });
    const minGain = optionalNumber(args, "min-gain", -6);
    const planned = (await planCues(sheet, { fps, baseDir: path.dirname(path.resolve(args.cues)) })).filter((cue) => (cue.gain ?? 0) >= minGain);
    const sheets = await strips(video, planned, {
      fps, outDir: path.resolve(args.strips), width: optionalNumber(args, "width", 180, { min: 60, max: 1080 }),
      crop: typeof args.crop === "string" ? args.crop : undefined,
    });
    for (const { sheet: file, cues } of sheets) console.log(`${file}\n  ${cues.join("\n  ")}`);
    console.log("Each strip: seven frames, the red box = the frame the sound plays on. It should be the first frame that shows the event.");
  }
  if (lag !== 0) process.exitCode = 1;
}

try {
  if (command === "points") await points();
  else if (command === "mix") await mix();
  else if (command === "check") await check();
  else throw new Error(`Unknown command "${command}".\n${USAGE}`);
} catch (error) {
  console.error(error.message);
  process.exit(1);
}
