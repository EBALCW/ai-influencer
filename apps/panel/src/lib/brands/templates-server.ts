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

/**
 * Dosya yoksa boş liste döner (panel çalışmaya devam eder, bölüm boş durum gösterir).
 * Varsayılan marka yanıtları; yorum gelen kutusu (#61) `comment-replies.md` okur.
 */
export async function loadReplyTemplates(
  name: 'brand-replies.md' | 'comment-replies.md' = 'brand-replies.md',
): Promise<ReplyTemplate[]> {
  const root = repositoryRoot();
  if (!root) return [];
  const file = join(root, 'templates', name);
  if (!existsSync(file)) return [];
  return parseReplyTemplates(await readFile(file, 'utf8'));
}
