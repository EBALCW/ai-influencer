'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMemo, useState, useTransition } from 'react';
import type { Row } from '@ai-influencer/shared';
import { EmptyState, Toast } from '@/components/ui';
import type { ContentWorkspace } from '@/lib/content/queries';
import {
  localInput,
  localToIso,
  shiftDay,
  type calendarRange,
} from '@/lib/content/schedule-rules';
import { stages } from '@/lib/content/stage-rules';
import {
  ContentPagination,
  contentHref,
  contentRequest,
  fieldClass,
  labelClass,
} from '../content/workspace';

const weekdays = [
  'Pazar',
  'Pazartesi',
  'Salı',
  'Çarşamba',
  'Perşembe',
  'Cuma',
  'Cumartesi',
];
export function CalendarView({
  workspace,
  day,
  view,
  timezone,
  range,
}: {
  workspace: ContentWorkspace;
  day: string;
  view: 'week' | 'month';
  timezone: string;
  range: ReturnType<typeof calendarRange>;
}) {
  const router = useRouter();
  const [message, setMessage] = useState<{
    text: string;
    error: boolean;
  } | null>(null);
  const [saving, setSaving] = useState(false);
  const [refreshing, startTransition] = useTransition();
  const [editing, setEditing] = useState<Row<'posting_slots'> | null>(null);
  const canEdit = workspace.role !== 'viewer',
    pending = saving || refreshing;
  const params = { date: day, view, tz: timezone };
  const slots = useMemo(() => {
    const entries: Array<{
      day: string;
      id: string;
      account: string;
      time: string;
      warning: boolean;
    }> = [];
    const sourceDays = [
      shiftDay(range.days[0]!, -1),
      ...range.days,
      shiftDay(range.days.at(-1)!, 1),
    ];
    for (const slot of workspace.slots)
      for (const date of sourceDays) {
        if (new Date(`${date}T12:00:00Z`).getUTCDay() !== slot.weekday)
          continue;
        try {
          const at = localToIso(
            `${date}T${slot.local_time.slice(0, 5)}`,
            slot.timezone,
          );
          const displayed = localInput(at, timezone),
            localDay = displayed.slice(0, 10);
          if (range.days.includes(localDay))
            entries.push({
              day: localDay,
              id: slot.id,
              account: slot.account_id,
              time: displayed.slice(11),
              warning: false,
            });
        } catch {
          if (range.days.includes(date))
            entries.push({
              day: date,
              id: slot.id,
              account: slot.account_id,
              time: `${slot.local_time.slice(0, 5)} ${slot.timezone} — bu yerel saat mevcut değil`,
              warning: true,
            });
        }
      }
    return entries;
  }, [workspace.slots, range.days, timezone]);
  async function mutate(url: string, method: string, values?: unknown) {
    setSaving(true);
    setMessage(null);
    try {
      await contentRequest(url, method, values);
      setEditing(null);
      setMessage({ text: 'Yayın slotları güncellendi.', error: false });
      startTransition(() => router.refresh());
    } catch (error) {
      setMessage({
        text: error instanceof Error ? error.message : 'İşlem tamamlanamadı.',
        error: true,
      });
    } finally {
      setSaving(false);
    }
  }
  return (
    <div className="page-stack">
      <header className="page-heading">
        <div>
          <p className="eyebrow">YAYIN OPERASYONU</p>
          <h1>Yayın takvimi</h1>
          <p>
            Yayın zamanları {timezone} saat diliminde gösterilir. 5 saat ve
            günlük 4 paylaşım uyarıları hedef hesap bazındadır.
          </p>
        </div>
        <Link className="button" href={contentHref('/content', workspace.slug)}>
          İçerik akışı
        </Link>
      </header>
      {message && (
        <Toast
          message={message.text}
          tone={message.error ? 'error' : 'success'}
          onDismiss={() => setMessage(null)}
        />
      )}
      <form
        className="section-card grid items-end gap-3 sm:grid-cols-4"
        action="/calendar"
      >
        {workspace.slug && (
          <input type="hidden" name="inf" value={workspace.slug} />
        )}
        <label className={labelClass}>
          Tarih
          <input
            className={fieldClass}
            type="date"
            name="date"
            defaultValue={day}
            required
          />
        </label>
        <label className={labelClass}>
          Görünüm
          <select
            aria-label="Görünüm"
            className={fieldClass}
            name="view"
            defaultValue={view}
          >
            <option value="week">Hafta</option>
            <option value="month">Ay</option>
          </select>
        </label>
        <label className={labelClass}>
          Takvim saat dilimi
          <input
            className={fieldClass}
            name="tz"
            defaultValue={timezone}
            required
          />
        </label>
        <button className="button button-primary" type="submit">
          Takvimi göster
        </button>
      </form>
      <nav
        aria-label="Takvim tarihleri"
        className="flex items-center justify-between gap-3"
      >
        <Link
          className="button"
          href={contentHref('/calendar', workspace.slug, {
            ...params,
            date: range.previous,
          })}
        >
          Önceki {view === 'week' ? 'hafta' : 'ay'}
        </Link>
        <h2 className="text-sm font-semibold">{day.slice(0, 7)}</h2>
        <Link
          className="button"
          href={contentHref('/calendar', workspace.slug, {
            ...params,
            date: range.next,
          })}
        >
          Sonraki {view === 'week' ? 'hafta' : 'ay'}
        </Link>
      </nav>
      {workspace.count === 0 && (
        <EmptyState
          title="Bu aralıkta yayın planı yok"
          description="İçerik akışında hedef hesap ve yayın zamanı seçerek plan oluşturun."
        />
      )}
      <div className="overflow-x-auto">
        <div
          className="grid min-w-[1050px] grid-cols-7 gap-2"
          aria-label="Yayın günleri"
        >
          {range.days.map((date) => (
            <section
              key={date}
              aria-label={`${date} yayınları`}
              className="min-h-48 rounded-xl border border-line bg-surface p-3"
            >
              <h3 className="mb-3 text-sm font-semibold">
                <time dateTime={date}>
                  {date.slice(5)} ·{' '}
                  {weekdays[new Date(`${date}T12:00:00Z`).getUTCDay()]}
                </time>
              </h3>
              <div className="space-y-2">
                {slots
                  .filter((s) => s.day === date)
                  .map((s) => (
                    <p
                      key={`${s.id}-${date}`}
                      className="rounded-lg border border-dashed border-line p-2 text-xs text-muted"
                    >
                      {s.warning ? 'Slot uyarısı' : 'Yayın slotu'} · {s.time} ·{' '}
                      {
                        workspace.accounts.find((a) => a.id === s.account)
                          ?.handle
                      }
                    </p>
                  ))}
                {workspace.items
                  .filter(
                    (item) =>
                      item.scheduled_at &&
                      localInput(item.scheduled_at, timezone).startsWith(date),
                  )
                  .map((item) => (
                    <article
                      key={item.id}
                      className="rounded-lg border border-line bg-surface-raised p-2 text-xs"
                    >
                      <Link
                        className="font-semibold text-text underline"
                        href={contentHref('/content', workspace.slug)}
                      >
                        {item.title}
                      </Link>
                      <p className="mt-1">
                        {localInput(item.scheduled_at!, timezone).slice(11)} ·{' '}
                        {stages.find(([key]) => key === item.stage)?.[1]}
                      </p>
                      <p className="mt-1 text-muted">
                        {workspace.accounts.find(
                          (a) => a.id === item.target_account_id,
                        )?.handle ?? 'Hedef hesap yok'}
                      </p>
                      {item.details.warnings.map((w) => (
                        <p key={w} className="mt-2 text-muted">
                          {w}
                        </p>
                      ))}
                    </article>
                  ))}
              </div>
            </section>
          ))}
        </div>
      </div>
      <ContentPagination
        workspace={workspace}
        path="/calendar"
        params={params}
      />
      <section className="section-card space-y-4">
        <h2 className="text-lg font-semibold">Yayın slotları</h2>
        <p className="text-sm text-muted">
          Slotlar hesabın yerel gün ve saatini tanımlar; yaz/kış saati
          dönüşümleri takvimde uygulanır.
        </p>
        {canEdit && workspace.accounts.length > 0 && (
          <form
            key={editing?.id ?? 'new'}
            aria-label="Yayın slotu formu"
            onSubmit={(event) => {
              event.preventDefault();
              const fd = new FormData(event.currentTarget);
              void mutate(
                editing
                  ? `/api/posting-slots/${editing.id}`
                  : '/api/posting-slots',
                editing ? 'PATCH' : 'POST',
                {
                  account_id: fd.get('account_id'),
                  weekday: Number(fd.get('weekday')),
                  local_time: fd.get('local_time'),
                  timezone: fd.get('timezone'),
                },
              );
            }}
          >
            <fieldset
              disabled={pending}
              className="grid items-end gap-3 sm:grid-cols-2 lg:grid-cols-5"
            >
              <label className={labelClass}>
                Slot hesabı
                <select
                  aria-label="Slot hesabı"
                  className={fieldClass}
                  name="account_id"
                  defaultValue={
                    editing?.account_id ?? workspace.accounts[0]?.id
                  }
                >
                  {workspace.accounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.platform} · {a.handle}
                    </option>
                  ))}
                </select>
              </label>
              <label className={labelClass}>
                Haftanın günü
                <select
                  aria-label="Haftanın günü"
                  className={fieldClass}
                  name="weekday"
                  defaultValue={editing?.weekday ?? 1}
                >
                  {weekdays.map((label, index) => (
                    <option key={label} value={index}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              <label className={labelClass}>
                Yerel saat
                <input
                  className={fieldClass}
                  type="time"
                  name="local_time"
                  required
                  defaultValue={editing?.local_time.slice(0, 5) ?? '12:00'}
                />
              </label>
              <label className={labelClass}>
                Slot saat dilimi
                <input
                  className={fieldClass}
                  name="timezone"
                  required
                  defaultValue={editing?.timezone ?? timezone}
                />
              </label>
              <button className="button button-primary" type="submit">
                {editing ? 'Slotu güncelle' : 'Slot ekle'}
              </button>
            </fieldset>
            {editing && (
              <button
                className="button mt-2"
                onClick={() => setEditing(null)}
                type="button"
              >
                Düzenlemeyi bırak
              </button>
            )}
          </form>
        )}
        {!workspace.accounts.length && (
          <p className="text-sm text-muted">
            Slot tanımlamak için önce bir sosyal hesap gerekir.
          </p>
        )}
        <ul className="space-y-2">
          {workspace.slots.map((slot) => (
            <li
              key={slot.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-line p-3 text-sm"
            >
              <span>
                {
                  workspace.accounts.find((a) => a.id === slot.account_id)
                    ?.handle
                }{' '}
                · {weekdays[slot.weekday]} · {slot.local_time.slice(0, 5)} ·{' '}
                {slot.timezone}
              </span>
              {canEdit && (
                <div className="flex gap-2">
                  <button
                    className="button"
                    disabled={pending}
                    onClick={() => setEditing(slot)}
                    type="button"
                  >
                    Düzenle
                  </button>
                  <button
                    className="button"
                    disabled={pending}
                    onClick={() =>
                      void mutate(`/api/posting-slots/${slot.id}`, 'DELETE')
                    }
                    type="button"
                  >
                    Slotu sil
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
