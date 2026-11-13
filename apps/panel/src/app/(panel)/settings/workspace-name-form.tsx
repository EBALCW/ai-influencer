'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';

/** Çalışma alanı adı. Owner yeniden adlandırabilir; diğer roller yalnız görür. */
export function WorkspaceNameForm({
  name,
  canEdit,
}: {
  name: string;
  canEdit: boolean;
}) {
  const router = useRouter();
  const [saved, setSaved] = useState(name);
  const [value, setValue] = useState(name);
  const [message, setMessage] = useState('');
  const [pending, setPending] = useState(false);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setMessage('');
    try {
      const response = await fetch('/api/workspace', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: value }),
      });
      const result = await response.json();
      if (!response.ok)
        throw new Error(result.error ?? 'Çalışma alanı adı kaydedilemedi.');
      setSaved(result.name);
      setValue(result.name);
      setMessage('Çalışma alanı adı kaydedildi.');
      router.refresh();
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : 'Çalışma alanı adı kaydedilemedi.',
      );
    } finally {
      setPending(false);
    }
  }

  if (!canEdit) {
    return (
      <div>
        <p className="text-xs font-medium text-slate-300">Çalışma alanı adı</p>
        <p className="mt-2 text-sm text-slate-100" data-testid="workspace-name">
          {saved}
        </p>
      </div>
    );
  }

  return (
    <form
      className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end"
      onSubmit={save}
    >
      <label className="block text-xs font-medium text-slate-300">
        Çalışma alanı adı
        <input
          className="mt-2 w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none focus:border-mint/60"
          name="name"
          value={value}
          maxLength={80}
          required
          onChange={(event) => setValue(event.target.value)}
        />
      </label>
      <button
        className="rounded-xl bg-white px-5 py-3 text-sm font-semibold text-slate-950 disabled:opacity-60"
        type="submit"
        disabled={pending || !value.trim() || value.trim() === saved}
      >
        Adı kaydet
      </button>
      <p className="text-xs text-slate-300 sm:col-span-2" role="status">
        {message}
      </p>
    </form>
  );
}
