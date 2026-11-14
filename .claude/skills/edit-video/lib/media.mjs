import path from "node:path";
import { runCapture } from "./process.mjs";

export const VIDEO_EXTENSIONS = new Set([".mp4", ".mov", ".m4v", ".webm", ".mkv", ".avi"]);

export function describeBrollFilename(filename) {
  const extension = path.extname(filename);
  const stem = path.basename(filename, extension);
  const tokens = stem
    .toLowerCase()
    .split(/[-_\s]+/)
    .filter(Boolean);
  const take = tokens.at(-1)?.match(/^\d+$/) ? Number(tokens.pop()) : null;
  return {
    description: tokens.join(" "),
    keywords: [...new Set(tokens)],
    take,
  };
}

export async function ffprobe(target) {
  const output = await runCapture("ffprobe", [
    "-v", "error",
    "-show_entries", "format=duration,size,format_name,bit_rate:stream=index,codec_type,codec_name,width,height,r_frame_rate,sample_rate,channels",
    "-of", "json",
    target,
  ]);
  return JSON.parse(output);
}

export function summarizeProbe(probe) {
  const video = probe.streams?.find((stream) => stream.codec_type === "video") ?? null;
  const audio = probe.streams?.find((stream) => stream.codec_type === "audio") ?? null;
  return {
    durationSeconds: probe.format?.duration ? Number(probe.format.duration) : null,
    bytes: probe.format?.size ? Number(probe.format.size) : null,
    format: probe.format?.format_name ?? null,
    video: video ? {
      codec: video.codec_name ?? null,
      width: video.width ?? null,
      height: video.height ?? null,
      frameRate: video.r_frame_rate ?? null,
    } : null,
    audio: audio ? {
      codec: audio.codec_name ?? null,
      sampleRate: audio.sample_rate ? Number(audio.sample_rate) : null,
      channels: audio.channels ?? null,
    } : null,
  };
}
