import crypto from "node:crypto";
import { constants, createReadStream } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";

export async function pathExists(target) {
  try {
    await fs.access(target);
    return true;
  } catch {
    return false;
  }
}

export async function writeJson(target, value, options = {}) {
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, `${JSON.stringify(value, null, 2)}\n`, {
    encoding: "utf8",
    flag: options.exclusive ? "wx" : "w",
  });
}

export async function readJson(target) {
  return JSON.parse(await fs.readFile(target, "utf8"));
}

export async function copyIfMissing(source, target) {
  if (await pathExists(target)) return false;
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.copyFile(source, target, constants.COPYFILE_EXCL);
  return true;
}

export async function sha256File(target) {
  const hash = crypto.createHash("sha256");
  for await (const chunk of createReadStream(target)) hash.update(chunk);
  return hash.digest("hex");
}

export async function listFilesRecursively(root) {
  const files = [];
  async function walk(directory) {
    for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
      const absolute = path.join(directory, entry.name);
      if (entry.isDirectory()) await walk(absolute);
      if (entry.isFile()) files.push(absolute);
    }
  }
  if (await pathExists(root)) await walk(root);
  return files.sort();
}
