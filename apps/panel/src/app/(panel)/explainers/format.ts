// Sunucu ve istemci bileşenlerinin ortak kullandığı düz yardımcılar. Bu dosya `'use client'`
// DEĞİLDİR: istemci modülünden dışa aktarılan fonksiyon ya da sabit sunucu bileşeninde çağrılamaz.

export const field =
  'mt-1 w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-text';
export const label = 'block text-xs font-medium text-muted';
export const hint = 'mt-1 block text-xs font-normal text-muted';
export const card = 'rounded-xl border border-line bg-surface-raised p-4';

const dateFormat = new Intl.DateTimeFormat('tr-TR', {
  dateStyle: 'medium',
  timeStyle: 'short',
  timeZone: 'Europe/Istanbul',
});
export function formatDate(value: string) {
  return dateFormat.format(new Date(value));
}
