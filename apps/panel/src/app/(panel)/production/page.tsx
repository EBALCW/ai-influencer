import Link from 'next/link';
import { requireTeamMember } from '@/lib/auth';
import { getWorkerStatus, listQueue } from '@/lib/generation-queries';
import { isActiveStatus, workerNotice } from '@/lib/generation-queue';
import { resolveInfluencerSlug } from '@/lib/prompts';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { QueueList } from './queue-list';

/** Üretim kuyruğu (#47): durum, ilerleme, iptal ve yeniden deneme. */
export default async function ProductionPage({
  searchParams,
}: {
  searchParams: Promise<{ inf?: string }>;
}) {
  const [{ role }, { inf = '' }] = await Promise.all([
    requireTeamMember(),
    searchParams,
  ]);
  const selected = await resolveInfluencerSlug(inf);
  const db = await createSupabaseServerClient();
  const [items, worker] = await Promise.all([
    listQueue(db, selected?.id ?? null),
    getWorkerStatus(db),
  ]);
  const notice = workerNotice(
    worker,
    items.some((item) => isActiveStatus(item.status)),
  );
  const infQuery = inf ? `?inf=${encodeURIComponent(inf)}` : '';

  return (
    <div className="page-stack">
      <header className="page-heading">
        <div>
          <p className="eyebrow">ÇALIŞMA ALANI</p>
          <h1>Üretim</h1>
          <p>
            Görsel ve video üretimlerinin kuyruğu
            {selected ? ` · ${selected.name}` : ''}. Yeni üretim prompt
            kütüphanesinden başlatılır; sonuçlar influencer&apos;ın medya
            kütüphanesine düşer.
          </p>
        </div>
        <Link className="button" href={`/prompts${infQuery}`}>
          Prompt kütüphanesi
        </Link>
      </header>
      {notice && (
        <p
          className="rounded-xl border border-line bg-surface-raised p-3 text-sm text-text"
          role="status"
        >
          {notice}
        </p>
      )}
      <QueueList
        canEdit={role !== 'viewer'}
        inf={inf}
        isOwner={role === 'owner'}
        items={items}
      />
    </div>
  );
}
