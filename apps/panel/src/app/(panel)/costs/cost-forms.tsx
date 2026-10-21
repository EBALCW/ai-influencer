'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import {
  costCategories,
  costCategoryLabels,
  supportedCurrencies,
} from '@/lib/costs/schemas';

const field =
  'mt-1 w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-text';
const label = 'block text-xs font-medium text-muted';

function useSubmit(url: string, method: 'POST' | 'PUT') {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState('');
  async function submit(body: unknown, done: string) {
    setPending(true);
    setMessage('');
    try {
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const result = (await response.json().catch(() => ({}))) as {
        error?: string;
      };
      if (!response.ok) throw new Error(result.error ?? 'Kaydedilemedi.');
      setMessage(done);
      router.refresh();
      return true;
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Kaydedilemedi.');
      return false;
    } finally {
      setPending(false);
    }
  }
  return { pending, message, submit };
}

function Message({ text }: { text: string }) {
  return text ? (
    <p aria-live="polite" className="text-sm text-muted">
      {text}
    </p>
  ) : null;
}

export function CostEntryForm({
  influencers,
  defaultInfluencerId,
  today,
}: {
  influencers: Array<{ id: string; name: string }>;
  defaultInfluencerId?: string;
  today: string;
}) {
  const { pending, message, submit } = useSubmit('/api/costs', 'POST');
  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const ok = await submit(
      {
        influencerId: data.get('influencerId'),
        category: data.get('category'),
        description: data.get('description') ?? '',
        amount: String(data.get('amount') ?? '').replace(',', '.'),
        currency: data.get('currency'),
        incurredOn: data.get('incurredOn'),
      },
      'Maliyet kaydedildi.',
    );
    if (ok) form.reset();
  }
  if (!influencers.length)
    return (
      <p className="text-sm text-muted">
        Maliyet girmek için önce bir influencer oluştur.
      </p>
    );
  return (
    <form
      onSubmit={onSubmit}
      className="grid gap-3 sm:grid-cols-2"
      aria-label="Maliyet ekle"
    >
      <label className={label}>
        Influencer
        <select
          name="influencerId"
          className={field}
          defaultValue={defaultInfluencerId}
        >
          {influencers.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </select>
      </label>
      <label className={label}>
        Kategori
        <select name="category" className={field} defaultValue="subscription">
          {costCategories.map((item) => (
            <option key={item} value={item}>
              {costCategoryLabels[item]}
            </option>
          ))}
        </select>
      </label>
      <label className={label}>
        Tutar
        <input
          name="amount"
          inputMode="decimal"
          required
          className={field}
          placeholder="19.99"
        />
      </label>
      <label className={label}>
        Para birimi
        <select name="currency" className={field} defaultValue="USD">
          {supportedCurrencies.map((item) => (
            <option key={item}>{item}</option>
          ))}
        </select>
      </label>
      <label className={label}>
        Tarih
        <input
          name="incurredOn"
          type="date"
          required
          defaultValue={today}
          className={field}
        />
      </label>
      <label className={label}>
        Açıklama
        <input name="description" maxLength={200} className={field} />
      </label>
      <div className="flex items-center gap-3 sm:col-span-2">
        <button className="button button-primary" disabled={pending}>
          {pending ? 'Kaydediliyor…' : 'Maliyet ekle'}
        </button>
        <Message text={message} />
      </div>
    </form>
  );
}

export function BudgetForm({
  influencers,
  month,
}: {
  influencers: Array<{ id: string; name: string }>;
  month: string;
}) {
  const { pending, message, submit } = useSubmit('/api/budgets', 'PUT');
  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const influencerId = String(data.get('influencerId') ?? '');
    await submit(
      {
        influencerId: influencerId || null,
        month,
        amount: String(data.get('amount') ?? '').replace(',', '.'),
        currency: data.get('currency'),
        warnRatio: String(Number(data.get('warnPercent') ?? 80) / 100),
      },
      'Bütçe kaydedildi.',
    );
  }
  return (
    <form
      onSubmit={onSubmit}
      className="grid gap-3 sm:grid-cols-2"
      aria-label="Bütçe tanımla"
    >
      <label className={label}>
        Kapsam
        <select name="influencerId" className={field} defaultValue="">
          <option value="">Tüm ekip (toplam)</option>
          {influencers.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </select>
      </label>
      <label className={label}>
        Aylık tavan
        <input name="amount" inputMode="decimal" required className={field} />
      </label>
      <label className={label}>
        Para birimi
        <select name="currency" className={field} defaultValue="USD">
          {supportedCurrencies.map((item) => (
            <option key={item}>{item}</option>
          ))}
        </select>
      </label>
      <label className={label}>
        Uyarı eşiği (%)
        <input
          name="warnPercent"
          type="number"
          min={1}
          max={100}
          defaultValue={80}
          className={field}
        />
      </label>
      <div className="flex items-center gap-3 sm:col-span-2">
        <button className="button button-primary" disabled={pending}>
          {pending ? 'Kaydediliyor…' : `${month} bütçesini kaydet`}
        </button>
        <Message text={message} />
      </div>
    </form>
  );
}

export function RateForm({ today }: { today: string }) {
  const [kind, setKind] = useState<'exchange' | 'credit'>('exchange');
  const { pending, message, submit } = useSubmit('/api/rates', 'POST');
  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const rate = String(data.get('rate') ?? '').replace(',', '.');
    const date = data.get('date');
    await submit(
      kind === 'exchange'
        ? {
            kind,
            currency: data.get('currency'),
            baseCurrency: data.get('baseCurrency'),
            rate,
            validOn: date,
          }
        : {
            kind,
            tool: data.get('tool'),
            currency: data.get('currency'),
            rate,
            validFrom: date,
          },
      'Oran kaydedildi.',
    );
  }
  return (
    <form
      onSubmit={onSubmit}
      className="grid gap-3 sm:grid-cols-2"
      aria-label="Oran ekle"
    >
      <label className={label}>
        Oran türü
        <select
          className={field}
          value={kind}
          onChange={(event) =>
            setKind(event.target.value as 'exchange' | 'credit')
          }
        >
          <option value="exchange">Döviz kuru</option>
          <option value="credit">Kredi fiyatı</option>
        </select>
      </label>
      {kind === 'credit' ? (
        <label className={label}>
          Araç
          <input
            name="tool"
            required
            className={field}
            placeholder="higgsfield"
          />
        </label>
      ) : (
        <label className={label}>
          1 birim
          <select name="currency" className={field} defaultValue="USD">
            {supportedCurrencies.map((item) => (
              <option key={item}>{item}</option>
            ))}
          </select>
        </label>
      )}
      <label className={label}>
        {kind === 'exchange' ? '= kaç' : '1 kredi ='}
        <input name="rate" inputMode="decimal" required className={field} />
      </label>
      <label className={label}>
        {kind === 'exchange' ? 'Hedef para birimi' : 'Para birimi'}
        <select
          name={kind === 'exchange' ? 'baseCurrency' : 'currency'}
          className={field}
          defaultValue={kind === 'exchange' ? 'TRY' : 'USD'}
        >
          {supportedCurrencies.map((item) => (
            <option key={item}>{item}</option>
          ))}
        </select>
      </label>
      <label className={label}>
        Geçerlilik başlangıcı
        <input
          name="date"
          type="date"
          required
          defaultValue={today}
          className={field}
        />
      </label>
      <div className="flex items-center gap-3 sm:col-span-2">
        <button className="button button-primary" disabled={pending}>
          {pending ? 'Kaydediliyor…' : 'Oranı ekle'}
        </button>
        <Message text={message} />
      </div>
    </form>
  );
}
