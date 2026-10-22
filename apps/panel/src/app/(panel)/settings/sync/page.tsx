import { EmptyState } from '@/components/ui';
import { requireTeamMember } from '@/lib/auth';
import {
  formatDuration,
  jobLabel,
  platformLabel,
  statusLabel,
} from '@/lib/sync/format';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { SyncNowButton } from './sync-button';

const dateTime = new Intl.DateTimeFormat('tr-TR', {
  dateStyle: 'short',
  timeStyle: 'short',
  timeZone: 'Europe/Istanbul',
});

export default async function SyncSettingsPage() {
  const { role } = await requireTeamMember();
  const db = await createSupabaseServerClient();
  const { data, error } = await db
    .from('sync_runs')
    .select(
      'id, job, platform, status, started_at, finished_at, processed_count, quota_units, error, social_accounts(handle)',
    )
    .order('started_at', { ascending: false })
    .limit(100);
  if (error)
    throw new Error(`Senkronizasyon günlüğü okunamadı: ${error.message}`);
  const runs = data ?? [];
  const canRun = role !== 'viewer';

  return (
    <div className="page-stack">
      <header className="page-heading">
        <div>
          <p className="eyebrow">AYARLAR</p>
          <h1>Senkronizasyon</h1>
          <p>
            Metrikler yayından 1, 5, 24, 72 ve 168 saat sonra (15 dakikada bir
            kontrol), yeni postlar 30 dakikada bir, hesap istatistikleri günde
            bir kez (03:20 UTC) toplanır.
            {canRun
              ? ' Gerekirse elle başlatabilirsiniz.'
              : ' İzleyiciler günlüğü görür, senkronizasyon başlatamaz.'}
          </p>
        </div>
      </header>
      {canRun && (
        <section className="section-card" aria-label="Manuel senkronizasyon">
          <SyncNowButton />
        </section>
      )}
      <section className="section-card" aria-label="Senkronizasyon günlüğü">
        <h2 className="text-lg font-semibold">Son çalışmalar</h2>
        {runs.length === 0 ? (
          <EmptyState
            title="Henüz senkronizasyon çalışmadı"
            description="Bağlı hesaplar için zamanlanmış işler çalıştıkça son 100 kayıt burada listelenir."
          />
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr>
                  <th className="p-2">Başlangıç</th>
                  <th className="p-2">İş</th>
                  <th className="p-2">Hesap</th>
                  <th className="p-2">Durum</th>
                  <th className="p-2">İşlenen</th>
                  <th className="p-2">Kota</th>
                  <th className="p-2">Süre</th>
                  <th className="p-2">Hata</th>
                </tr>
              </thead>
              <tbody>
                {runs.map((run) => (
                  <tr key={run.id} className="border-t border-line">
                    <td className="p-2 whitespace-nowrap">
                      {dateTime.format(new Date(run.started_at))}
                    </td>
                    <td className="p-2">{jobLabel(run.job)}</td>
                    <td className="p-2">
                      {platformLabel(run.platform)}
                      {run.social_accounts?.handle
                        ? ` · ${run.social_accounts.handle}`
                        : ''}
                    </td>
                    <td className="p-2 font-medium">
                      {statusLabel(run.status)}
                    </td>
                    <td className="p-2">{run.processed_count}</td>
                    <td className="p-2">{run.quota_units ?? '—'}</td>
                    <td className="p-2">
                      {formatDuration(run.started_at, run.finished_at) ?? '—'}
                    </td>
                    <td className="p-2 text-muted">{run.error ?? ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
