'use client';

import { useActionState } from 'react';
import { Toast } from '@/components/ui';
import { ratePrompt } from '../actions';

export function RatingForm({
  promptId,
  version,
  rating,
}: {
  promptId: string;
  version: number;
  rating: number | null;
}) {
  const [state, action, pending] = useActionState(ratePrompt, null);
  return (
    <form action={action} className="flex flex-wrap items-center gap-2">
      <input name="promptId" type="hidden" value={promptId} />
      <label className="sr-only" htmlFor={`rating-${promptId}`}>
        v{version} puanı
      </label>
      <select
        className="rounded-lg border border-line bg-surface px-2 py-1 text-sm text-text"
        defaultValue={rating ? String(Math.round(rating)) : ''}
        id={`rating-${promptId}`}
        name="rating"
        required
      >
        <option disabled value="">
          Puan
        </option>
        {[1, 2, 3, 4, 5].map((value) => (
          <option key={value} value={value}>
            {value}/5
          </option>
        ))}
      </select>
      <button className="button button-quiet" disabled={pending} type="submit">
        Puanla
      </button>
      {state && (
        <Toast message={state.message} tone={state.ok ? 'success' : 'error'} />
      )}
    </form>
  );
}
