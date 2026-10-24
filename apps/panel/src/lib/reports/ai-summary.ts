import type { WeeklySuggestion } from '@/lib/ai/schemas';

/** AI çıktısını rapora kaydedilecek düz metne çevirir (Markdown benzeri başlıklar). */
export function formatAiSummary(suggestion: WeeklySuggestion): string {
  const section = (title: string, items: string[]) =>
    items.length
      ? [`${title}:`, ...items.map((item) => `- ${item.trim()}`)].join('\n')
      : '';
  return [
    suggestion.summary.trim(),
    section('Gözlemler', suggestion.observations),
    section('Öneriler', suggestion.suggestions),
    section('Sınırlamalar', suggestion.limitations),
  ]
    .filter(Boolean)
    .join('\n\n');
}
