import crypto from "node:crypto";
import path from "node:path";

export const STUDIO_DIRECTORY = ".favstash-studio";

export function sanitizeSlug(value, fallback = "untitled-edit") {
  const normalized = String(value ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
  return normalized || fallback;
}

export function compactTimestamp(date = new Date()) {
  const pad = (number) => String(number).padStart(2, "0");
  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate()),
  ].join("-") + `-${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
}

export function createRunId(slug, { date = new Date(), randomBytes = crypto.randomBytes } = {}) {
  const suffix = randomBytes(3).toString("hex");
  return `${compactTimestamp(date)}-${sanitizeSlug(slug)}-${suffix}`;
}

export function resolveWorkspace(value = process.cwd()) {
  return path.resolve(value);
}

export function studioPath(workspace) {
  return path.join(resolveWorkspace(workspace), STUDIO_DIRECTORY);
}

export function assertInside(parent, candidate, label = "path") {
  const root = path.resolve(parent);
  const target = path.resolve(candidate);
  const relative = path.relative(root, target);
  if (relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative))) return target;
  throw new Error(`${label} must stay inside ${root}`);
}

export function resolveEditDirectory(editValue) {
  return path.resolve(editValue);
}
