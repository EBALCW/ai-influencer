'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { FileDown, Printer, Sparkles } from 'lucide-react';

async function postJson(url: string, body?: unknown) {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const result = (await response.json().catch(() => ({}))) as {
    error?: string;
    id?: string;
  };
  if (!response.ok) throw new Error(result.error ?? 'İşlem tamamlanamadı.');
  return result;
}

function Status({ text }: { text: string }) {
  return (
    <p aria-live="polite" className="text-sm text-muted print:hidden">
      {text}
    </p>
  );
}

/** Tek tıkla haftalık rapor: kaydeder ve rapor sayfasına gider. */
export function GenerateReportButton({
  periodStart,
  influencerId,
  influencerSlug,
  label,
}: {
  periodStart: string;
  influencerId: string | null;
  influencerSlug: string | null;
  label: string;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState('');
  async function generate() {
    setPending(true);
    setMessage('');
    try {
      const { id } = await postJson('/api/reports', {
        periodStart,
        influencerId,
      });
      const query = influencerSlug
        ? `?inf=${encodeURIComponent(influencerSlug)}`
        : '';
      router.push(`/analytics/reports/${id}${query}`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Rapor oluşmadı.');
      setPending(false);
    }
  }
  return (
    <>
      <button
        className="button button-primary"
        disabled={pending}
        onClick={generate}
        type="button"
      >
        {pending ? 'Rapor oluşturuluyor…' : label}
      </button>
      <Status text={message} />
    </>
  );
}

export function PrintButton() {
  return (
    <button
      className="button button-quiet print:hidden"
      onClick={() => window.print()}
      type="button"
    >
      <Printer aria-hidden="true" size={15} /> Yazdır / PDF olarak kaydet
    </button>
  );
}

export function ExportLinks({
  from,
  to,
  influencerSlug,
}: {
  from: string;
  to: string;
  influencerSlug: string | null;
}) {
  const params = new URLSearchParams({ from, to });
  if (influencerSlug) params.set('inf', influencerSlug);
  const datasets = [
    { key: 'posts', label: 'Postlar' },
    { key: 'metrics', label: 'Metrikler' },
    { key: 'costs', label: 'Maliyetler' },
  ];
  return (
    <nav
      aria-label="CSV dışa aktarma"
      className="flex flex-wrap items-center gap-2 print:hidden"
    >
      {datasets.map((item) => (
        <a
          className="button button-quiet"
          download
          href={`/api/exports/${item.key}?${params.toString()}`}
          key={item.key}
        >
          <FileDown aria-hidden="true" size={15} /> {item.label} CSV
        </a>
      ))}
    </nav>
  );
}

export function AiSummaryButton({
  reportId,
  hasSummary,
}: {
  reportId: string;
  hasSummary: boolean;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState('');
  async function run() {
    setPending(true);
    setMessage('');
    try {
      await postJson(`/api/reports/${reportId}/ai-summary`);
      setMessage('AI özeti kaydedildi.');
      router.refresh();
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : 'AI özeti oluşturulamadı.',
      );
    } finally {
      setPending(false);
    }
  }
  return (
    <div className="flex flex-wrap items-center gap-3 print:hidden">
      <button
        className="button button-quiet"
        disabled={pending}
        onClick={run}
        type="button"
      >
        <Sparkles aria-hidden="true" size={15} />{' '}
        {pending
          ? 'Claude özetliyor…'
          : hasSummary
            ? 'AI özetini yenile'
            : 'Claude ile özet ve öneri oluştur'}
      </button>
      <Status text={message} />
    </div>
  );
}
