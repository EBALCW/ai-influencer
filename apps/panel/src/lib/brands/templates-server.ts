import 'server-only';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { parseReplyTemplates, type ReplyTemplate } from './templates';

/** Repo kökünü (pnpm-workspace.yaml) çalışma dizininden yukarı doğru bulur. */
function repositoryRoot(): string | null {
  let dir = process.cwd();
  while (!existsSync(join(dir, 'pnpm-workspace.yaml'))) {
    const parent = dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
  return dir;
}

/** Dosya yoksa boş liste döner (panel çalışmaya devam eder, bölüm boş durum gösterir). */
export async function loadReplyTemplates(): Promise<ReplyTemplate[]> {
  const root = repositoryRoot();
  if (!root) return [];
  const file = join(root, 'templates', 'brand-replies.md');
  if (!existsSync(file)) return [];
  return parseReplyTemplates(await readFile(file, 'utf8'));
}
