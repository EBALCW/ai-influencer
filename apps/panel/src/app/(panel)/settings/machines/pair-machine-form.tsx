'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import {
  isPairingRequestFresh,
  pairingPhrase,
  parsePairingRequest,
  type PairingRequest,
} from '@ai-influencer/shared';

const platformLabels: Record<string, string> = {
  darwin: 'macOS',
  win32: 'Windows',
  linux: 'Linux',
};

type Checked = { text: string; request: PairingRequest; phrase: string };

/**
 * Eşleme metni → makinenin adı ve kontrol kodu gösterilir → onay. Metin tarayıcıda çözülür;
 * sunucuya yalnız onayda gider. Yetki ve sınırlar sunucuda denetlenir.
 */
export function PairMachineForm() {
  const router = useRouter();
  const [text, setText] = useState('');
  const [checked, setChecked] = useState<Checked | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  async function check(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage('');
    setChecked(null);
    const request = parsePairingRequest(text);
    if (!request) {
      setMessage(
        'Eşleme metni geçersiz. Makinedeki metnin tamamını kopyalayıp yapıştır.',
      );
      return;
    }
    if (!isPairingRequestFresh(request, Date.now() / 1000)) {
      setMessage(
        'Eşleme metninin süresi dolmuş. Makinede pnpm worker:login komutunu yeniden çalıştır.',
      );
      return;
    }
    setChecked({ text, request, phrase: await pairingPhrase(request) });
  }

  async function confirm() {
    if (!checked) return;
    setBusy(true);
    setMessage('');
    try {
      const response = await fetch('/api/workers/pairings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pairing: checked.text }),
      });
      const data = (await response.json().catch(() => ({}))) as {
        error?: string;
      };
      if (!response.ok) {
        setMessage(data.error ?? 'Makine eşlenemedi.');
        return;
      }
      setMessage(
        `"${checked.request.name}" eşlendi. Makinedeki komut birkaç saniye içinde tamamlanır.`,
      );
      setChecked(null);
      setText('');
      router.refresh();
    } catch {
      setMessage('Makine eşlenemedi.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-3 space-y-3">
      <form onSubmit={check} className="space-y-3">
        <label className="block text-sm">
          Eşleme metni
          <textarea
            className="mt-1 block w-full rounded-lg border border-line bg-surface px-3 py-2 font-mono text-xs"
            value={text}
            onChange={(event) => {
              setText(event.target.value);
              setChecked(null);
            }}
            placeholder="aiw1.…"
            autoComplete="off"
            spellCheck={false}
            rows={3}
            maxLength={2000}
            required
          />
        </label>
        <button type="submit" className="button" disabled={busy}>
          Metni kontrol et
        </button>
      </form>
      {checked && (
        <div className="rounded-lg border border-line p-3 text-sm">
          <p>
            <strong>{checked.request.name}</strong> (
            {platformLabels[checked.request.platform] ??
              checked.request.platform}
            ) adlı makine senin hesabınla eşlenecek. Bu makine senin adına iş
            alıp çıktı yükleyebilecek.
          </p>
          <p className="mt-2">
            Kontrol kodu:{' '}
            <strong className="font-mono tracking-widest">
              {checked.phrase}
            </strong>
          </p>
          <p className="mt-1 text-muted">
            Makinenin ekranındaki kontrol kodu bununla aynı olmalı. Farklıysa ya
            da bu metni sana başkası gönderdiyse onaylama.
          </p>
          <div className="mt-3 flex flex-wrap gap-3">
            <button
              type="button"
              className="button"
              onClick={() => void confirm()}
              disabled={busy}
            >
              {busy ? 'Eşleniyor…' : 'Kodlar aynı, bu makineyi eşle'}
            </button>
            <button
              type="button"
              className="button"
              onClick={() => setChecked(null)}
              disabled={busy}
            >
              Vazgeç
            </button>
          </div>
        </div>
      )}
      <p className="text-sm text-muted" role="status" aria-live="polite">
        {message}
      </p>
    </div>
  );
}
