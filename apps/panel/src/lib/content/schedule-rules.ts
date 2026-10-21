export const gapWarning =
  'Aynı hesapta iki paylaşım arasında en az 5 saat olmalı.';
export const dailyWarning = 'Bu hesapta aynı gün 4 paylaşımdan fazla plan var.';
export function validTimezone(timezone: string) {
  try {
    new Intl.DateTimeFormat('en', { timeZone: timezone }).format(0);
    return true;
  } catch {
    return false;
  }
}
export function localInput(iso: string, timezone: string): string {
  const parts = new Intl.DateTimeFormat('sv-SE', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date(iso));
  const get = (name: string) => parts.find((part) => part.type === name)?.value;
  return `${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}`;
}
/** Tarayıcı saatinden bağımsız IANA dönüşümü. DST boşluklarını reddeder; çift saatlerde ilkini seçer. */
export function localToIso(value: string, timezone: string): string {
  if (
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value) ||
    !validTimezone(timezone)
  )
    throw new Error('Tarih veya saat dilimi geçersiz.');
  const target = Date.parse(`${value}:00Z`);
  if (!Number.isFinite(target)) throw new Error('Tarih geçersiz.');
  let candidate = target;
  for (let i = 0; i < 4; i++) {
    candidate +=
      target -
      Date.parse(
        `${localInput(new Date(candidate).toISOString(), timezone)}:00Z`,
      );
  }
  // Geçişin iki yanındaki gerçek offset'leri kullanır; yarım saatlik DST
  // değişimleri de (ör. Lord Howe) bir saat varsayımına takılmaz.
  const matches = [-86400000, 0, 86400000]
    .map((delta) => {
      const probe = candidate + delta;
      const offset =
        Date.parse(
          `${localInput(new Date(probe).toISOString(), timezone)}:00Z`,
        ) - probe;
      return target - offset;
    })
    .filter(
      (time) => localInput(new Date(time).toISOString(), timezone) === value,
    );
  if (!matches.length)
    throw new Error(
      'Bu yerel saat, saat dilimi değişimi nedeniyle mevcut değil.',
    );
  return new Date(Math.min(...matches)).toISOString();
}
export function scheduleWarnings(
  current: { id: string; accountId: string; at: string; timezone: string },
  others: Array<{ id: string; accountId: string; at: string }>,
) {
  const rows = others.filter(
    (row) => row.id !== current.id && row.accountId === current.accountId,
  );
  const time = Date.parse(current.at);
  const day = localInput(current.at, current.timezone).slice(0, 10);
  const result: string[] = [];
  if (rows.some((row) => Math.abs(Date.parse(row.at) - time) < 5 * 3600000))
    result.push(gapWarning);
  if (
    rows.filter((row) => localInput(row.at, current.timezone).startsWith(day))
      .length >= 4
  )
    result.push(dailyWarning);
  return result;
}
export function shiftDay(day: string, amount: number) {
  const date = new Date(`${day}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + amount);
  return date.toISOString().slice(0, 10);
}
export function calendarRange(
  day: string,
  view: 'week' | 'month',
  timezone: string,
) {
  const date = new Date(`${day}T12:00:00Z`);
  const first = view === 'month' ? `${day.slice(0, 7)}-01` : day;
  const weekday = new Date(`${first}T12:00:00Z`).getUTCDay();
  const start = shiftDay(first, -(weekday + 6) % 7);
  const count = view === 'week' ? 7 : 42;
  const days = Array.from({ length: count }, (_, index) =>
    shiftDay(start, index),
  );
  return {
    days,
    from: localToIso(`${start}T00:00`, timezone),
    to: localToIso(`${shiftDay(start, count)}T00:00`, timezone),
    previous:
      view === 'week'
        ? shiftDay(day, -7)
        : new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() - 1, 1))
            .toISOString()
            .slice(0, 10),
    next:
      view === 'week'
        ? shiftDay(day, 7)
        : new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1))
            .toISOString()
            .slice(0, 10),
  };
}
