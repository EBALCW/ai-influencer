#!/usr/bin/env node
import path from "node:path";
import process from "node:process";
import { parseArgs } from "../lib/args.mjs";
import { listFilesRecursively, sha256File, writeJson } from "../lib/files.mjs";
import { describeBrollFilename, ffprobe, summarizeProbe, VIDEO_EXTENSIONS } from "../lib/media.mjs";
import { resolveWorkspace, studioPath } from "../lib/paths.mjs";

const args = parseArgs(process.argv.slice(2));
const workspace = resolveWorkspace(typeof args.workspace === "string" ? args.workspace : process.cwd());
const studio = studioPath(workspace);
const broll = path.join(studio, "broll");
const files = (await listFilesRecursively(broll)).filter((file) => VIDEO_EXTENSIONS.has(path.extname(file).toLowerCase()));
const assets = [];

for (const file of files) {
  const relativePath = path.relative(broll, file);
  const sha256 = await sha256File(file);
  let technical = null;
  let probeError = null;
  try {
    technical = summarizeProbe(await ffprobe(file));
  } catch (error) {
    probeError = error.message;
  }
  assets.push({
    id: sha256.slice(0, 16),
    relativePath,
    ...describeBrollFilename(path.basename(file)),
    sha256,
    technical,
    probeError,
  });
  console.log(`Indexed ${relativePath}`);
}

const output = path.join(studio, "broll-index.v1.json");
await writeJson(output, {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  brollDirectory: broll,
  count: assets.length,
  assets,
});
console.log(`Wrote ${output}`);
