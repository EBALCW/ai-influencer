'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { EmptyState } from '@/components/ui';
import {
  ALERTS_CHANGED_EVENT,
  markAlertRead,
} from '@/components/notifications';
import {
  formatAlert,
  formatAlertTime,
  type AlertItem,
} from '@/lib/alerts/format';

export function NotificationList({
  alerts,
  unread,
}: {
  alerts: AlertItem[];
  unread: number;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  // Zilden yapılan işaretleme de bu listeyi tazeler
  useEffect(() => {
    const refresh = () => router.refresh();
    window.addEventListener(ALERTS_CHANGED_EVENT, refresh);
    return () => window.removeEventListener(ALERTS_CHANGED_EVENT, refresh);
  }, [router]);

  async function mark(id?: string) {
    setBusy(true);
    setMessage('');
    try {
      await markAlertRead(id);
      setMessage(
        id ? 'Bildirim okundu işaretlendi.' : 'Tüm bildirimler okundu.',
      );
    } catch {
      setMessage('Bildirim işaretlenemedi.');
    } finally {
      setBusy(false);
    }
  }

  if (alerts.length === 0) {
    return (
      <section className="section-card section-empty-card">
        <EmptyState
          title="Henüz bildirim yok"
          description="Eşikler aşıldığında veya bir işlem hata verdiğinde uyarılar burada listelenir."
        />
      </section>
    );
  }

  return (
    <section aria-label="Bildirim listesi" className="section-card space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted">
          {unread > 0
            ? `${unread} okunmamış bildirim`
            : 'Tüm bildirimler okundu.'}
        </p>
        {unread > 0 && (
          <button
            className="button"
            disabled={busy}
            onClick={() => void mark()}
            type="button"
          >
            Tümünü okundu işaretle
          </button>
        )}
      </div>
      {message && (
        <p className="text-sm text-text" role="status">
          {message}
        </p>
      )}
      <ul className="space-y-2">
        {alerts.map((alert) => {
          const text = formatAlert(alert);
          return (
            <li
              className={`rounded-xl border p-3 ${
                alert.read
                  ? 'border-line-soft'
                  : 'border-line bg-surface-raised'
              }`}
              key={alert.id}
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold text-text">
                    {!alert.read && <span className="sr-only">Yeni: </span>}
                    {text.title}
                  </p>
                  <p className="text-sm text-muted">{text.message}</p>
                  <time
                    className="text-xs text-subtle"
                    dateTime={alert.createdAt}
                  >
                    {formatAlertTime(alert.createdAt)}
                  </time>
                </div>
                <div className="flex items-center gap-3">
                  <Link
                    className="text-xs text-accent-strong underline"
                    href={text.href}
                  >
                    İlgili sayfa
                  </Link>
                  {alert.read ? (
                    <span className="text-xs text-subtle">Okundu</span>
                  ) : (
                    <button
                      aria-label={`${text.title} bildirimini okundu işaretle`}
                      className="text-xs text-accent-strong underline disabled:opacity-60"
                      disabled={busy}
                      onClick={() => void mark(alert.id)}
                      type="button"
                    >
                      Okundu işaretle
                    </button>
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
