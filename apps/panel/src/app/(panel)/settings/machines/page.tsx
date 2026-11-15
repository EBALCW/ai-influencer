import { WORKER_OFFLINE_AFTER_SECONDS } from '@ai-influencer/shared';
import { EmptyState } from '@/components/ui';
import { requireTeamMember } from '@/lib/auth';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { RevokeMachineButton } from './revoke-machine-button';

const dateTime = new Intl.DateTimeFormat('tr-TR', {
  dateStyle: 'short',
  timeStyle: 'short',
  timeZone: 'Europe/Istanbul',
});

const platformLabels: Record<string, string> = {
  darwin: 'macOS',
  win32: 'Windows',
  linux: 'Linux',
};

function machineStatus(
  machine: { revoked_at: string | null; last_seen_at: string },
  now: number,
) {
  if (machine.revoked_at) return 'Yetkisi kaldırıldı';
  const silentFor = (now - Date.parse(machine.last_seen_at)) / 1000;
  return silentFor <= WORKER_OFFLINE_AFTER_SECONDS ? 'Çevrimiçi' : 'Çevrimdışı';
}

export const dynamic = 'force-dynamic';

export default async function MachinesSettingsPage() {
  const { role, user } = await requireTeamMember();
  const db = await createSupabaseServerClient();
  // RLS yalnız üyenin kendi alanındaki makineleri gösterir.
  const { data, error } = await db
    .from('production_workers')
    .select(
      'id, user_id, name, platform, version, capabilities, last_seen_at, revoked_at, created_at',
    )
    .order('revoked_at', { ascending: true, nullsFirst: true })
    .order('created_at', { ascending: false })
    .limit(100);
  if (error) throw new Error(`Makineler okunamadı: ${error.message}`);
  const machines = data ?? [];
  const now = new Date().getTime();

  return (
    <div className="page-stack">
      <header className="page-heading">
        <div>
          <p className="eyebrow">AYARLAR</p>
          <h1>Üretim makineleri</h1>
          <p>
            Render ve ses gibi ağır işler ekip üyelerinin kendi bilgisayarında
            çalışan üretim makinesi programıyla yapılır. Makine panelde yalnız
            okur; iş açamaz, onay veremez ve yayın yapamaz.
          </p>
        </div>
      </header>
      <section className="section-card" aria-label="Makine ekleme">
        <h2 className="text-lg font-semibold">Makine ekleme</h2>
        <p className="mt-1 text-sm text-muted">
          Kendi bilgisayarında <code>pnpm worker:login</code> ile giriş yap,
          sonra <code>pnpm worker:start</code> ile programı başlat. Makine bu
          listede görünür. Kullanmadığın ya da kaybolan bir bilgisayarın
          yetkisini buradan kaldır: oturumu hemen kapanır.
        </p>
      </section>
      <section className="section-card" aria-label="Makineler">
        <h2 className="text-lg font-semibold">Makineler</h2>
        {machines.length === 0 ? (
          <EmptyState
            title="Henüz makine yok"
            description="Giriş yapan üretim makineleri, durumları ve son görülme zamanlarıyla burada listelenir."
          />
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr>
                  <th className="p-2">Makine</th>
                  <th className="p-2">Sistem</th>
                  <th className="p-2">Durum</th>
                  <th className="p-2">Son görülme</th>
                  <th className="p-2">Yetenek</th>
                  <th className="p-2">
                    <span className="sr-only">İşlem</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {machines.map((machine) => {
                  const mine = machine.user_id === user.id;
                  const canRevoke =
                    !machine.revoked_at &&
                    (role === 'owner' || (role === 'editor' && mine));
                  return (
                    <tr key={machine.id} className="border-t border-line">
                      <td className="p-2 font-medium">
                        {machine.name}
                        {mine && (
                          <span className="ml-2 text-xs text-muted">
                            (senin)
                          </span>
                        )}
                      </td>
                      <td className="p-2">
                        {platformLabels[machine.platform] ?? machine.platform}
                        {machine.version ? ` · ${machine.version}` : ''}
                      </td>
                      <td className="p-2">{machineStatus(machine, now)}</td>
                      <td className="p-2">
                        {dateTime.format(new Date(machine.last_seen_at))}
                      </td>
                      <td className="p-2">
                        {machine.capabilities.length > 0
                          ? machine.capabilities.join(', ')
                          : '—'}
                      </td>
                      <td className="p-2 text-right">
                        {canRevoke && (
                          <RevokeMachineButton
                            id={machine.id}
                            name={machine.name}
                          />
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
