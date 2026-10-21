import Link from 'next/link';
import { ShieldX } from 'lucide-react';
import { authMessages } from '@/lib/auth-messages';

export default function AccessDeniedPage() {
  return (
    <main className="grid min-h-screen place-items-center bg-canvas px-5 text-slate-100">
      <section className="w-full max-w-md rounded-3xl border border-white/10 bg-surface p-8 text-center shadow-2xl shadow-black/30">
        <span className="mx-auto grid size-12 place-items-center rounded-2xl border border-rose-300/15 bg-rose-300/10 text-rose-200">
          <ShieldX size={22} />
        </span>
        <h1 className="mt-5 text-xl font-semibold text-white">
          {authMessages.accessDeniedTitle}
        </h1>
        <p className="mt-3 text-sm leading-6 text-slate-400">
          {authMessages.accessDeniedBody}
        </p>
        <Link
          href="/login"
          className="mt-6 inline-flex rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-slate-950 hover:bg-slate-200"
        >
          {authMessages.loginTitle}
        </Link>
      </section>
    </main>
  );
}
