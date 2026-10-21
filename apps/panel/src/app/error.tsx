'use client';

import { messages } from '../lib/messages';

export default function Error({
  retry,
}: {
  error: unknown;
  retry: () => void;
}) {
  return (
    <main className="grid min-h-screen place-items-center bg-canvas px-6 text-center text-white">
      <div className="max-w-md">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-violet-200">
          {messages.brand}
        </p>
        <h1 className="mt-4 text-2xl font-semibold">{messages.common.error}</h1>
        <button
          className="mt-6 rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-slate-950 hover:bg-slate-200"
          onClick={retry}
        >
          {messages.common.retry}
        </button>
      </div>
    </main>
  );
}
