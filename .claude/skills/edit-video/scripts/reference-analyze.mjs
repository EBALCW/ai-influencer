#!/usr/bin/env node
import fs from "node:fs/promises";
import { constants } from "node:fs";
import path from "node:path";
import process from "node:process";
import { parseArgs, optionalNumber, requireString } from "../lib/args.mjs";
import { listFilesRecursively, pathExists, readJson, sha256File, writeJson } from "../lib/files.mjs";
import { ffprobe, summarizeProbe, VIDEO_EXTENSIONS } from "../lib/media.mjs";
import { resolveEditDirectory } from "../lib/paths.mjs";
import { run, runCapture } from "../lib/process.mjs";
import { createRightsRecord, isReusableInOutput, validateRightsStatus } from "../lib/rights.mjs";

const args = parseArgs(process.argv.slice(2));
if (args.help) {
  console.log("Usage: node <skill>/scripts/reference-analyze.mjs --url <url> --edit <run-dir> [--rights-status analysis-only|owned|licensed|public-domain|cc0|cc-by] [--confirm-rights] [--rights-note <text>] [--attribution <text>] [--reuse-audio] [--reuse-video] [--frame-interval 2]");
  process.exit(0);
}

const rawUrl = requireString(args, "url");
// Yalnız http(s) adresi: tireyle başlayan bir değer yt-dlp seçeneği gibi yorumlanmasın.
let url;
try {
  url = new URL(rawUrl);
} catch {
  throw new Error("--url must be an http(s) URL");
}
if (!/^https?:$/.test(url.protocol)) throw new Error("--url must be an http(s) URL");
url = url.href;
const edit = resolveEditDirectory(requireString(args, "edit"));
const rightsStatus = validateRightsStatus(typeof args["rights-status"] === "string" ? args["rights-status"] : "analysis-only");
const reusable = isReusableInOutput(rightsStatus);
const rightsNote = typeof args["rights-note"] === "string" ? args["rights-note"] : null;
const attribution = typeof args.attribution === "string" ? args.attribution : null;
const frameInterval = optionalNumber(args, "frame-interval", 2, { min: 0.25, max: 30 });

if (!(await pathExists(path.join(edit, "edit.json")))) throw new Error("The edit run is missing edit.json");
if (reusable && !args["confirm-rights"]) {
  throw new Error("Reusable rights must be explicitly confirmed by the user with --confirm-rights");
}
if (!reusable && (args["reuse-audio"] || args["reuse-video"])) {
  throw new Error("analysis-only references cannot be copied into output assets");
}

const rights = createRightsRecord(rightsStatus, { rightsNote, attribution });
const references = path.join(edit, "references");
const analysis = path.join(edit, "analysis");
const frames = path.join(analysis, "reference-frames");
await fs.mkdir(references, { recursive: true });
await fs.mkdir(frames, { recursive: true });

const outputTemplate = path.join(references, "source.%(ext)s");
const downloadArgs = [
  "--no-playlist",
  "--no-overwrites",
  "--restrict-filenames",
  "--write-info-json",
  "--write-subs",
  "--write-auto-subs",
  "--sub-langs", "en.*,en",
  "--convert-subs", "srt",
  "--merge-output-format", "mp4",
  "-f", "bestvideo*+bestaudio/best",
  "-o", outputTemplate,
  "--print", "after_move:filepath",
];
if (typeof args["cookies-from-browser"] === "string") {
  downloadArgs.push("--cookies-from-browser", args["cookies-from-browser"]);
}
downloadArgs.push("--", url);

console.log("Downloading a local reference analysis copy with yt-dlp…");
const printed = await runCapture("yt-dlp", downloadArgs, { cwd: edit });
const printedPaths = printed.trim().split(/\r?\n/).filter(Boolean).map((value) => path.resolve(value));
const candidates = (await listFilesRecursively(references)).filter((file) => VIDEO_EXTENSIONS.has(path.extname(file).toLowerCase()));
const media = printedPaths.find((file) => candidates.includes(file)) ?? candidates[0];
if (!media) throw new Error("yt-dlp completed but no downloaded video file was found");

const probe = await ffprobe(media);
const technical = summarizeProbe(probe);
await run("ffmpeg", [
  "-hide_banner", "-loglevel", "error", "-y",
  "-i", media,
  "-vf", `fps=1/${frameInterval},scale=540:-2`,
  "-q:v", "3",
  path.join(frames, "%05d.jpg"),
]);

let analysisAudio = null;
if (technical.audio) {
  analysisAudio = path.join(analysis, "reference-audio-analysis.wav");
  await run("ffmpeg", [
    "-hide_banner", "-loglevel", "error", "-y",
    "-i", media,
    "-vn", "-ac", "1", "-ar", "16000", "-c:a", "pcm_s16le",
    analysisAudio,
  ]);
}

const downloadedHash = await sha256File(media);
const ledgerPath = path.join(edit, "asset-ledger.json");
const ledger = await readJson(ledgerPath);
const referenceId = `reference-${downloadedHash.slice(0, 12)}`;
ledger.assets.push({
  id: referenceId,
  kind: "reference-video",
  path: path.relative(edit, media),
  sourceUrl: url,
  sha256: downloadedHash,
  rights,
  allowedUse: reusable ? "Reference analysis; may be reused only within the recorded rights and platform terms." : "Private analysis only; excluded from all published output.",
});

if (args["reuse-video"]) {
  const reusableVideo = path.join(edit, "assets", `reference-video${path.extname(media).toLowerCase()}`);
  await fs.copyFile(media, reusableVideo, constants.COPYFILE_EXCL);
  ledger.assets.push({
    id: `reusable-video-${downloadedHash.slice(0, 12)}`,
    kind: "video",
    path: path.relative(edit, reusableVideo),
    sourceId: referenceId,
    sha256: downloadedHash,
    rights,
  });
}

if (args["reuse-audio"]) {
  if (!technical.audio) throw new Error("The reference has no audio stream to reuse");
  const reusableAudio = path.join(edit, "assets", "reference-audio.wav");
  await run("ffmpeg", [
    "-hide_banner", "-loglevel", "error", "-y",
    "-i", media,
    "-vn", "-ac", "2", "-ar", "48000", "-c:a", "pcm_s24le",
    reusableAudio,
  ]);
  ledger.assets.push({
    id: `reusable-audio-${(await sha256File(reusableAudio)).slice(0, 12)}`,
    kind: "audio",
    path: path.relative(edit, reusableAudio),
    sourceId: referenceId,
    sha256: await sha256File(reusableAudio),
    rights,
  });
}
await writeJson(ledgerPath, ledger);

const report = {
  schemaVersion: 1,
  analyzedAt: new Date().toISOString(),
  sourceUrl: url,
  downloadedFile: path.relative(edit, media),
  sha256: downloadedHash,
  technical,
  frameIntervalSeconds: frameInterval,
  framesDirectory: path.relative(edit, frames),
  analysisAudio: analysisAudio ? path.relative(edit, analysisAudio) : null,
  rights,
  outputReuse: {
    videoCopied: Boolean(args["reuse-video"]),
    audioCopied: Boolean(args["reuse-audio"]),
  },
  instruction: reusable
    ? "Reuse remains limited to the recorded rights, attribution, platform terms, and the user's instruction."
    : "Learn structure and style only. Do not place downloaded video or extracted audio in an export.",
};
await writeJson(path.join(analysis, "reference-report.json"), report);
console.log(`Reference analysis complete: ${path.join(analysis, "reference-report.json")}`);
