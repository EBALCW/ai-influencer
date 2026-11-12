'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Download, Upload } from 'lucide-react';
import { FileDropzone } from '@/components/ui';
import { CSV_BOM, csvLine } from '@/lib/reports/csv';
import { TREND_CSV_HEADERS, type TrendImportResult } from '@/lib/research/csv';

function downloadTemplate() {
  const blob = new Blob([`${CSV_BOM}${csvLine([...TREND_CSV_HEADERS])}\r\n`], {
    type: 'text/csv;charset=utf-8',
  });
  const href = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = href;
  link.download = 'trends-sablon.csv';
  link.click();
  URL.revokeObjectURL(href);
}

/** `research/trends.csv` yükler; satır hatalarını satır numarasıyla listeler. */
export function TrendImport() {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<TrendImportResult | null>(null);
  const [error, setError] = useState('');

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!file) return;
    setPending(true);
    setResult(null);
    setError('');
    try {
      const body = new FormData();
      body.set('file', file);
      const response = await fetch('/api/trends/import', {
        method: 'POST',
        body,
      });
      const data = (await response.json().catch(() => null)) as
        (Partial<TrendImportResult> & { error?: string }) | null;
      if (typeof data?.created === 'number') {
        setResult(data as TrendImportResult);
        if (data.created) router.refresh();
      } else setError(data?.error ?? 'İçe aktarma başarısız.');
    } catch {
      setError('İçe aktarma isteği gönderilemedi.');
    } finally {
      setPending(false);
    }
  }

  return (
    <form
      aria-label="Trend CSV içe aktar"
      className="flex flex-col gap-3"
      onSubmit={submit}
    >
      <FileDropzone
        accept=".csv,text/csv"
        label="trends.csv seçin"
        onFiles={(files) => setFile(files.item(0))}
      />
      <div className="flex flex-wrap items-center gap-3">
        <button
          className="button button-primary"
          disabled={!file || pending}
          type="submit"
        >
          <Upload size={16} /> {pending ? 'Yükleniyor…' : 'CSV içe aktar'}
        </button>
        <button
          className="button button-quiet"
          onClick={downloadTemplate}
          type="button"
        >
          <Download size={16} /> Boş şablon indir
        </button>
      </div>
      <p className="text-xs text-muted">
        Sütunlar: {TREND_CSV_HEADERS.join(', ')}. Virgül veya noktalı virgül
        ayraçlı, UTF-8 (Excel “CSV UTF-8”) dosya. Format: dans, dönüşüm,
        kısa_film, pov, meme, lip_sync, outfit, diğer · durum: yeni, seçildi,
        üretildi, elendi · influencer boşsa global. Aynı link tekrar eklenmez.
      </p>
      {error && (
        <p className="text-sm text-text" role="alert">
          {error}
        </p>
      )}
      {result && (
        <div aria-live="polite" className="text-sm text-text" role="status">
          <p>
            {result.created} trend eklendi
            {result.skipped ? `, ${result.skipped} satır zaten arşivde` : ''}
            {result.errors.length
              ? `, ${result.errors.length} satır hatalı`
              : ''}
            .
          </p>
          {result.ignoredColumns.length > 0 && (
            <p className="text-muted">
              Tanınmayan sütunlar atlandı: {result.ignoredColumns.join(', ')}
            </p>
          )}
          {result.errors.length > 0 && (
            <ul
              aria-label="İçe aktarma hataları"
              className="mt-2 list-disc pl-5"
            >
              {result.errors.map((item) => (
                <li key={`${item.line}-${item.message}`}>
                  Satır {item.line}: {item.message}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </form>
  );
}
