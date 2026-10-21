import Link from 'next/link';
import { ShieldX } from 'lucide-react';
import { authMessages } from '@/lib/auth-messages';

export default function AccessDeniedPage() {
  return (
    <main className="grid min-h-screen place-items-center bg-canvas px-5 text-text">
      <section className="w-full max-w-md rounded-3xl border border-line-soft bg-surface p-8 text-center shadow-2xl shadow-black/30">
        <span className="mx-auto grid size-12 place-items-center rounded-2xl border border-accent/20 bg-accent/10 text-accent">
          <ShieldX size={22} />
        </span>
        <h1 className="mt-5 text-xl font-semibold text-text">
          {authMessages.accessDeniedTitle}
        </h1>
        <p className="mt-3 text-sm leading-6 text-muted">
          {authMessages.accessDeniedBody}
        </p>
        <Link
          href="/login"
          className="mt-6 inline-flex rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-canvas hover:bg-accent-strong"
        >
          {authMessages.loginTitle}
        </Link>
      </section>
    </main>
  );
}
