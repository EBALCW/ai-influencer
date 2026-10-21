import { requireOwner } from '@/lib/auth';
import Link from 'next/link';
import { LogoutButton } from '@/app/logout-button';
import { TeamManager } from './team-manager';

export const dynamic = 'force-dynamic';

export default async function TeamSettingsPage() {
  const { user } = await requireOwner();

  return (
    <main className="min-h-screen bg-canvas px-5 py-8 text-white sm:px-10">
      <div className="mx-auto max-w-5xl">
        <header className="flex items-center justify-between border-b border-white/10 pb-6">
          <div>
            <Link href="/" className="text-xs text-mint hover:underline">
              ← Panele dön
            </Link>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight">
              Ekip ayarları
            </h1>
            <p className="mt-2 text-sm text-slate-400">
              Üyeleri davet et ve erişim rollerini yönet.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden text-xs text-slate-400 sm:inline">
              {user.email}
            </span>
            <LogoutButton />
          </div>
        </header>
        <section className="mt-8 rounded-3xl border border-white/10 bg-surface/80 p-5 sm:p-7">
          <TeamManager currentUserId={user.id} />
        </section>
      </div>
    </main>
  );
}
