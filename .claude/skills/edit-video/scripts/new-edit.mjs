#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { parseArgs } from "../lib/args.mjs";
import { writeJson } from "../lib/files.mjs";
import { createRunId, resolveWorkspace, studioPath } from "../lib/paths.mjs";

const args = parseArgs(process.argv.slice(2));
if (args.help) {
  console.log("Usage: node <skill>/scripts/new-edit.mjs [--workspace <path>] --slug <name>");
  process.exit(0);
}
const workspace = resolveWorkspace(typeof args.workspace === "string" ? args.workspace : process.cwd());
const edits = path.join(studioPath(workspace), "edits");
await fs.mkdir(edits, { recursive: true });

const slug = typeof args.slug === "string" ? args.slug : "untitled-edit";
let edit;
let runId;
for (let attempt = 0; attempt < 5; attempt += 1) {
  runId = createRunId(slug);
  const candidate = path.join(edits, runId);
  try {
    await fs.mkdir(candidate);
    edit = candidate;
    break;
  } catch (error) {
    if (error.code !== "EEXIST") throw error;
  }
}
if (!edit) throw new Error("Could not allocate a unique edit run ID");
for (const directory of ["input", "references", "analysis", "assets", "work", "previews", "exports", "reports"]) {
  await fs.mkdir(path.join(edit, directory));
}
await writeJson(path.join(edit, "edit.json"), {
  schemaVersion: 1,
  runId,
  createdAt: new Date().toISOString(),
  status: "editing",
  selectedExport: null,
}, { exclusive: true });
await writeJson(path.join(edit, "asset-ledger.json"), {
  schemaVersion: 1,
  runId,
  assets: [],
}, { exclusive: true });
console.log(edit);
