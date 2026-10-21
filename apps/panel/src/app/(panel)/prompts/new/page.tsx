import Link from 'next/link';
import { redirect } from 'next/navigation';
import { requireTeamMember } from '@/lib/auth';
import { listInfluencerChoices, resolveInfluencerSlug } from '@/lib/prompts';
import { PromptForm } from '../prompt-form';

export default async function NewPromptPage({
  searchParams,
}: {
  searchParams: Promise<{ inf?: string }>;
}) {
  const { inf = '' } = await searchParams;
  const { role } = await requireTeamMember();
  // Yetki sunucuda: viewer formu göremez, action da ayrıca reddeder (RLS üçüncü hat)
  if (role === 'viewer') redirect('/prompts?error=editor_required');

  const [selected, influencers] = await Promise.all([
    resolveInfluencerSlug(inf),
    listInfluencerChoices(),
  ]);

  return (
    <div className="page-stack">
      <header className="page-heading">
        <div>
          <p className="eyebrow">PROMPT KÜTÜPHANESİ</p>
          <h1>Yeni prompt</h1>
          <p>
            Kaydettikten sonra içerik değiştirilemez, değişiklikler yeni
            versiyon olur.
          </p>
        </div>
        <Link
          className="button button-quiet"
          href={inf ? `/prompts?inf=${encodeURIComponent(inf)}` : '/prompts'}
        >
          Vazgeç
        </Link>
      </header>
      <section className="section-card">
        <PromptForm
          defaultInfluencerId={selected?.id ?? null}
          inf={inf}
          influencers={influencers}
        />
      </section>
    </div>
  );
}
