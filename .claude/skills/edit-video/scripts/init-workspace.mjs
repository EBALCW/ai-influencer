#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { parseArgs } from "../lib/args.mjs";
import { copyIfMissing, pathExists, readJson, writeJson } from "../lib/files.mjs";
import { resolveWorkspace, studioPath } from "../lib/paths.mjs";
import { run } from "../lib/process.mjs";

const HYPERFRAMES_VERSION = "0.8.32";
// Coded compositions load GSAP from a local copy, so renders need no network.
const GSAP_VERSION = "3.14.2";
// The 3D styles copy three.js from here into each reel (pinned, not bundled in the skills).
const THREE_VERSION = "0.168.0";
const skill = fileURLToPath(new URL("..", import.meta.url));
const args = parseArgs(process.argv.slice(2));
if (args.help) {
  console.log("Usage: node <skill>/scripts/init-workspace.mjs [--workspace <path>] [--install]");
  process.exit(0);
}

const workspace = resolveWorkspace(typeof args.workspace === "string" ? args.workspace : process.cwd());
const studio = studioPath(workspace);
for (const directory of ["broll", "runtime"]) {
  await fs.mkdir(path.join(studio, directory), { recursive: true });
}
const preferences = path.join(studio, "preferences.md");
await copyIfMissing(path.join(skill, "assets", "preferences.template.md"), preferences);

const packageTarget = path.join(studio, "runtime", "package.json");
const runtimePackage = await pathExists(packageTarget) ? await readJson(packageTarget) : {
  name: "favstash-studio-runtime",
  version: "0.1.0",
  private: true,
  type: "module",
  engines: { node: ">=22" },
};
runtimePackage.private = true;
runtimePackage.dependencies ||= {};
// Preserve a creator's working renderer and libraries instead of changing them during setup.
for (const [name, version] of [["hyperframes", HYPERFRAMES_VERSION], ["gsap", GSAP_VERSION], ["three", THREE_VERSION]]) {
  if (!runtimePackage.dependencies[name] && !runtimePackage.devDependencies?.[name]) {
    runtimePackage.dependencies[name] = version;
  }
}
await writeJson(packageTarget, runtimePackage);

if (args.install) {
  await run("npm", ["install", "--no-audit", "--no-fund"], { cwd: path.join(studio, "runtime") });
}
console.log(`Runtime: ${path.join(studio, "runtime")}`);
console.log(`Optional preferences: ${preferences}`);
if (!args.install) console.log("Files prepared only. Use --install when this edit needs HyperFrames or the glass scaffold.");
