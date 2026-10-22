'use client';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { z } from 'zod';
import {
  captionOutputSchema,
  personaOutputSchema,
  scriptOutputSchema,
  weeklyOutputSchema,
  type AiTask,
  type SuggestRequest,
} from '@/lib/ai/schemas';
import type { SuggestResult } from '@/lib/ai/suggest';
const resultSchema = z.discriminatedUnion('task', [
  z.object({ task: z.literal('persona'), suggestion: personaOutputSchema }),
  z.object({ task: z.literal('caption'), suggestion: captionOutputSchema }),
  z.object({ task: z.literal('script'), suggestion: scriptOutputSchema }),
  z.object({ task: z.literal('weekly'), suggestion: weeklyOutputSchema }),
]);
const names: Record<AiTask, string> = {
  persona: 'Persona',
  caption: 'Caption ve hashtag',
  script: 'Kısa film senaryosu',
  weekly: 'Haftalık analiz',
};
export function suggestionText(result: SuggestResult): string {
  if (result.task === 'persona')
    return [
      result.suggestion.bio,
      ...result.suggestion.personality,
      ...result.suggestion.sampleCaptions,
    ].join('\n');
  if (result.task === 'caption')
    return [
      result.suggestion.caption,
      result.suggestion.cta,
      result.suggestion.hashtags.join(' '),
    ].join('\n');
  if (result.task === 'script')
    return [
      result.suggestion.hook,
      ...result.suggestion.scenes.map(
        (s) => `${s.seconds} sn · ${s.visual}\n${s.narration}`,
      ),
      result.suggestion.caption,
    ].join('\n\n');
  return [
    result.suggestion.summary,
    'Gözlemler:',
    ...result.suggestion.observations,
    'Öneriler:',
    ...result.suggestion.suggestions,
    'Veri sınırları:',
    ...result.suggestion.limitations,
  ].join('\n');
}
function AiSuggestionState({
  influencerId,
  tasks,
  requestFor,
  onApply,
  disabled = false,
}: {
  influencerId: string;
  tasks: AiTask[];
  requestFor: (task: AiTask) => SuggestRequest;
  onApply: (result: SuggestResult) => void;
  disabled?: boolean;
}) {
  const [enabled, setEnabled] = useState(false),
    [loaded, setLoaded] = useState(false);
  const [task, setTask] = useState<AiTask>(tasks[0] ?? 'caption');
  const [result, setResult] = useState<SuggestResult | null>(null),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  const activeRequest = useRef<AbortController | null>(null);
  const inf = useSearchParams().get('inf');
  useEffect(() => {
    const controller = new AbortController();
    void fetch('/api/ai/settings', { signal: controller.signal })
      .then(async (r) => {
        if (!r.ok) throw Error('AI ayarları alınamadı.');
        const d = await r.json();
        setEnabled(d.enabled === true);
        setLoaded(true);
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setError('AI ayarları alınamadı.');
          setLoaded(true);
        }
      });
    return () => {
      controller.abort();
      activeRequest.current?.abort();
    };
  }, [influencerId]);
  async function generate() {
    const controller = new AbortController();
    activeRequest.current?.abort();
    activeRequest.current = controller;
    setBusy(true);
    setResult(null);
    setError('');
    try {
      const r = await fetch('/api/ai/suggest', {
        method: 'POST',
        signal: controller.signal,
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ influencerId, request: requestFor(task) }),
      });
      const data = await r.json();
      if (!r.ok)
        throw Error(
          typeof data.error === 'string' ? data.error : 'AI önerisi alınamadı.',
        );
      const parsed = resultSchema.safeParse(data);
      if (!parsed.success || parsed.data.task !== task)
        throw Error('AI yanıtı beklenen biçimde değil.');
      if (controller.signal.aborted) return;
      setResult(parsed.data);
    } catch (e) {
      if (controller.signal.aborted) return;
      setError(e instanceof Error ? e.message : 'AI isteği tamamlanamadı.');
    } finally {
      if (activeRequest.current === controller) setBusy(false);
    }
  }
  return (
    <section
      aria-label="AI asistanı"
      className="space-y-3 rounded-xl border border-line p-4"
    >
      <div className="flex flex-wrap items-end gap-3">
        <h3 className="text-base font-semibold">AI asistanı</h3>
        {tasks.length > 1 && (
          <label className="text-sm text-muted">
            Öneri türü
            <select
              aria-label="Öneri türü"
              className="ml-2 rounded-lg border border-line bg-surface p-2 text-text"
              value={task}
              disabled={busy}
              onChange={(e) => {
                setTask(e.target.value as AiTask);
                setResult(null);
              }}
            >
              {tasks.map((t) => (
                <option key={t} value={t}>
                  {names[t]}
                </option>
              ))}
            </select>
          </label>
        )}
        <button
          className="button"
          type="button"
          disabled={disabled || busy || !enabled || !influencerId}
          onClick={() => void generate()}
        >
          {busy ? 'Öneri hazırlanıyor…' : 'AI ile öner'}
        </button>
      </div>
      <p className="text-xs text-muted">
        Öneri ücretli API kullanır. Sonucu inceleyip uygularsanız yalnız form
        değişir; kaydetmek size aittir.
      </p>
      {loaded && !enabled && (
        <p className="text-sm text-muted">
          AI kullanıma hazır değil.{' '}
          <Link
            className="underline"
            href={`/settings/ai${inf ? `?inf=${encodeURIComponent(inf)}` : ''}`}
          >
            AI ayarlarını kontrol edin.
          </Link>
        </p>
      )}
      {error && (
        <p role="alert" className="text-sm text-text">
          {error}
        </p>
      )}
      {result && (
        <div aria-label="AI önerisi" role="region" className="space-y-3">
          <p className="whitespace-pre-wrap text-sm text-text">
            {suggestionText(result)}
          </p>
          <button
            type="button"
            className="button button-primary"
            disabled={disabled}
            onClick={() => {
              try {
                onApply(result);
                setResult(null);
              } catch (e) {
                setError(
                  e instanceof Error ? e.message : 'Öneri uygulanamadı.',
                );
              }
            }}
          >
            Öneriyi forma uygula
          </button>
          <button
            type="button"
            className="button ml-2"
            onClick={() => setResult(null)}
          >
            Öneriyi bırak
          </button>
        </div>
      )}
    </section>
  );
}

export function AiSuggestion(props: Parameters<typeof AiSuggestionState>[0]) {
  return <AiSuggestionState key={props.influencerId} {...props} />;
}
