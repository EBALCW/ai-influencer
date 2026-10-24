/**
 * Marka yanıt şablonları (#29 / 6.3). Metin koda gömülmez: `templates/brand-replies.md`
 * dosyasından okunur. Her `## Başlık` bir şablondur; ilk `##`'den önceki giriş atlanır.
 */
export type ReplyTemplate = { title: string; body: string };

export function parseReplyTemplates(markdown: string): ReplyTemplate[] {
  const templates: ReplyTemplate[] = [];
  let current: { title: string; lines: string[] } | null = null;
  const flush = () => {
    if (!current) return;
    const body = current.lines.join('\n').trim();
    if (current.title && body) templates.push({ title: current.title, body });
  };
  for (const line of markdown.replace(/\r\n?/g, '\n').split('\n')) {
    const heading = /^##\s+(.+?)\s*#*\s*$/.exec(line);
    if (heading && !line.startsWith('###')) {
      flush();
      current = { title: heading[1]!.trim(), lines: [] };
    } else if (current) {
      current.lines.push(line);
    }
  }
  flush();
  return templates;
}
