'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Upload } from 'lucide-react';
import { FileDropzone, Toast } from '@/components/ui';
import type { PromptImportResult } from '@/lib/prompt-bundle';

/** Panelden indirilmiş prompt paketini (.json) yükler; her prompt yeni versiyon olur. */
export function PromptImport() {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [pending, setPending] = useState(false);
  const [state, setState] = useState<{ ok: boolean; message: string } | null>(
    null,
  );

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!file) return;
    setPending(true);
    setState(null);
    try {
      const body = new FormData();
      body.set('file', file);
      const response = await fetch('/api/prompts/import', {
        method: 'POST',
        body,
      });
      const data = (await response.json().catch(() => null)) as
        (PromptImportResult & { error?: string; errors?: string[] }) | null;
      if (!response.ok && !data?.created) {
        const details = data?.errors?.length
          ? data.errors.join(' · ')
          : (data?.error ?? 'İçe aktarma başarısız.');
        setState({ ok: false, message: details });
        return;
      }
      const parts = [
        `${data?.created ?? 0} yeni versiyon oluşturuldu`,
        data?.unchanged ? `${data.unchanged} prompt zaten günceldi` : '',
        data?.failed.length
          ? `${data.failed.length} prompt kaydedilemedi (${data.failed.map((item) => item.title).join(', ')})`
          : '',
      ].filter(Boolean);
      setState({ ok: !data?.failed.length, message: `${parts.join(', ')}.` });
      router.refresh();
    } catch {
      setState({ ok: false, message: 'İçe aktarma isteği gönderilemedi.' });
    } finally {
      setPending(false);
    }
  }

  return (
    <form
      aria-label="Prompt içe aktar"
      className="flex flex-col gap-3"
      onSubmit={submit}
    >
      <FileDropzone
        accept="application/json,.json"
        label="Prompt paketi seçin (.json)"
        onFiles={(files) => setFile(files.item(0))}
      />
      <div className="flex flex-wrap items-center gap-3">
        <button
          className="button button-primary"
          disabled={!file || pending}
          type="submit"
        >
          <Upload size={16} /> {pending ? 'Yükleniyor…' : 'İçe aktar'}
        </button>
        <p className="text-xs text-muted">
          Her prompt yeni versiyon olarak eklenir; eski versiyonlar değişmez.
        </p>
      </div>
      {state && (
        <Toast message={state.message} tone={state.ok ? 'success' : 'error'} />
      )}
    </form>
  );
}
