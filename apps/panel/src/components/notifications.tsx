'use client';

import { useCallback, useEffect, useId, useRef, useState } from 'react';
import Link from 'next/link';
import { Bell } from 'lucide-react';
import {
  formatAlert,
  formatAlertTime,
  type AlertItem,
} from '@/lib/alerts/format';

/** Bildirim listesi değişince (okundu vb.) diğer bileşenler yeniden yükler. */
export const ALERTS_CHANGED_EVENT = 'alerts-changed';
const POLL_MS = 60_000;

type AlertList = { alerts: AlertItem[]; unread: number };

export async function markAlertRead(id?: string) {
  const response = await fetch(
    id ? `/api/alerts/${encodeURIComponent(id)}/read` : '/api/alerts/read-all',
    { method: 'POST' },
  );
  if (!response.ok) throw new Error('Bildirim işaretlenemedi.');
  window.dispatchEvent(new Event(ALERTS_CHANGED_EVENT));
}

export function unreadLabel(unread: number) {
  return unread > 0 ? `Bildirimler, ${unread} okunmamış` : 'Bildirimler';
}

export function NotificationBell({ allHref }: { allHref: string }) {
  const panelId = useId();
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<AlertList | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    try {
      const response = await fetch('/api/alerts?limit=15', {
        cache: 'no-store',
      });
      if (!response.ok) throw new Error('load');
      setData((await response.json()) as AlertList);
      setError('');
    } catch {
      setError('Bildirimler yüklenemedi.');
    }
  }, []);

  useEffect(() => {
    const first = setTimeout(() => void load(), 0);
    const timer = setInterval(() => void load(), POLL_MS);
    const onChange = () => void load();
    window.addEventListener(ALERTS_CHANGED_EVENT, onChange);
    return () => {
      clearTimeout(first);
      clearInterval(timer);
      window.removeEventListener(ALERTS_CHANGED_EVENT, onChange);
    };
  }, [load]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    const onPointer = (event: MouseEvent) => {
      if (!wrapRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onPointer);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onPointer);
    };
  }, [open]);

  async function mark(id?: string) {
    setBusy(true);
    try {
      await markAlertRead(id);
    } catch {
      setError('Bildirim işaretlenemedi.');
    } finally {
      setBusy(false);
    }
  }

  const unread = data?.unread ?? 0;
  const alerts = data?.alerts ?? [];

  return (
    <div className="relative" ref={wrapRef}>
      <button
        aria-controls={panelId}
        aria-expanded={open}
        aria-haspopup="true"
        aria-label={unreadLabel(unread)}
        className="icon-button notification-button"
        onClick={() => {
          setOpen((value) => !value);
          if (!open) void load();
        }}
        ref={buttonRef}
        type="button"
      >
        <Bell aria-hidden="true" size={17} />
        {unread > 0 && <span aria-hidden="true" />}
      </button>
      {/* role="status" değil: sayfadaki tekil durum mesajlarıyla (Toast vb.) çakışmasın */}
      <span
        aria-atomic="true"
        aria-live="polite"
        className="sr-only"
        data-testid="unread-announcer"
      >
        {unread > 0 ? `${unread} okunmamış bildirim` : ''}
      </span>
      {open && (
        <div
          aria-label="Bildirim merkezi"
          className="absolute right-0 top-full z-50 mt-2 w-80 max-w-[calc(100vw-2rem)] rounded-xl border border-line bg-surface p-3 text-text shadow-lg"
          id={panelId}
          role="region"
        >
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold">
              Bildirimler{unread > 0 ? ` (${unread} okunmamış)` : ''}
            </h2>
            {unread > 0 && (
              <button
                className="text-xs text-accent-strong underline disabled:opacity-60"
                disabled={busy}
                onClick={() => void mark()}
                type="button"
              >
                Tümünü okundu işaretle
              </button>
            )}
          </div>
          {error && (
            <p className="mt-2 text-xs text-text" role="alert">
              {error}
            </p>
          )}
          {alerts.length === 0 && !error ? (
            <p className="mt-3 text-sm text-muted">
              {data ? 'Henüz bildirim yok.' : 'Yükleniyor…'}
            </p>
          ) : (
            <ul className="mt-2 max-h-96 space-y-1 overflow-y-auto">
              {alerts.map((alert) => {
                const text = formatAlert(alert);
                return (
                  <li
                    className={`rounded-lg border p-2 ${
                      alert.read
                        ? 'border-transparent'
                        : 'border-line bg-surface-raised'
                    }`}
                    key={alert.id}
                  >
                    <p className="text-sm font-medium">
                      {!alert.read && <span className="sr-only">Yeni: </span>}
                      {text.title}
                    </p>
                    <p className="text-xs text-muted">{text.message}</p>
                    <div className="mt-1 flex items-center justify-between gap-2">
                      <time
                        className="text-xs text-subtle"
                        dateTime={alert.createdAt}
                      >
                        {formatAlertTime(alert.createdAt)}
                      </time>
                      {!alert.read && (
                        <button
                          aria-label={`${text.title} bildirimini okundu işaretle`}
                          className="text-xs text-accent-strong underline disabled:opacity-60"
                          disabled={busy}
                          onClick={() => void mark(alert.id)}
                          type="button"
                        >
                          Okundu
                        </button>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
          <Link
            className="mt-3 block text-center text-xs text-accent-strong underline"
            href={allHref}
            onClick={() => setOpen(false)}
          >
            Tüm bildirimler
          </Link>
        </div>
      )}
    </div>
  );
}
