'use client';

import { useState } from 'react';

/**
 * Araç girişi kodu (docs/AUTH.md → "Araç girişi"). Kod yalnız bu bileşenin belleğinde durur:
 * adrese, depolamaya ya da loga yazılmaz; gizlenince ya da sayfa kapanınca kaybolur.
 */
export function ToolLoginCode() {
  const [code, setCode] = useState('');
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  async function generate() {
    setBusy(true);
    setMessage('');
    try {
      const response = await fetch('/api/tool-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
        cache: 'no-store',
      });
      const data = (await response.json().catch(() => ({}))) as {
        code?: string;
        error?: string;
      };
      if (!response.ok || !data.code) {
        setMessage(data.error ?? 'Giriş kodu üretilemedi.');
        return;
      }
      setCode(data.code);
      setVisible(false);
      setMessage('Kod üretildi. Önceki kod artık geçersiz.');
    } catch {
      setMessage('Giriş kodu üretilemedi.');
    } finally {
      setBusy(false);
    }
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(code);
      setMessage('Kod kopyalandı. Terminalde komutun sorduğu yere yapıştır.');
    } catch {
      setVisible(true);
      setMessage('Kopyalanamadı. Kodu elle seçip kopyala.');
    }
  }

  function hide() {
    setCode('');
    setVisible(false);
    setMessage('Kod ekrandan kaldırıldı.');
  }

  return (
    <div className="mt-3 space-y-3">
      <button
        type="button"
        className="button"
        disabled={busy}
        onClick={() => void generate()}
      >
        {busy ? 'Üretiliyor…' : code ? 'Yeni kod üret' : 'Giriş kodu üret'}
      </button>
      <p className="text-sm text-muted" role="status" aria-live="polite">
        {message}
      </p>
      {code && (
        <div className="space-y-2 rounded-lg border border-line p-3">
          <label
            className="block text-sm font-medium"
            htmlFor="tool-login-code"
          >
            Giriş kodu
          </label>
          <div className="flex flex-wrap items-center gap-2">
            <input
              id="tool-login-code"
              className="min-w-0 flex-1 rounded-md border border-line bg-surface px-2 py-1 font-mono text-sm"
              type={visible ? 'text' : 'password'}
              value={code}
              readOnly
              autoComplete="off"
              spellCheck={false}
              onFocus={(event) => event.currentTarget.select()}
            />
            <button
              type="button"
              className="button"
              onClick={() => void copy()}
            >
              Kodu kopyala
            </button>
            <button
              type="button"
              className="button"
              onClick={() => setVisible((value) => !value)}
            >
              {visible ? 'Kodu maskele' : 'Kodu göster'}
            </button>
            <button type="button" className="button" onClick={hide}>
              Ekrandan kaldır
            </button>
          </div>
          <p className="text-sm font-medium">
            Bu kod senin hesabınla giriş yapar; kimseyle paylaşma.
          </p>
          <p className="text-sm text-muted">
            Kod tek kullanımlıktır ve kısa sürede (varsayılan ayarla en geç 1
            saat) geçersiz olur; hemen kullan. Yeni kod üretmek ya da giriş
            e-postası istemek önceki kodu geçersiz kılar. İki araç için iki ayrı
            kod üret.
          </p>
        </div>
      )}
    </div>
  );
}
