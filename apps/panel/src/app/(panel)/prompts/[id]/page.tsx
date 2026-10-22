import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireTeamMember } from '@/lib/auth';
import {
  categoryLabels,
  generationTypeForCategory,
  parseVariableDefinitions,
} from '@/lib/prompt-schemas';
import { listReferenceAssets } from '@/lib/generation-queries';
import { modeForCategory } from '@/lib/generation-queue';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import {
  getPromptLineage,
  listInfluencerChoices,
  resolveInfluencerSlug,
} from '@/lib/prompts';
import { formatCredits, formatRate } from '../format';
import { PromptForm } from '../prompt-form';
import { PreviewPanel } from './preview-panel';
import { RatingForm } from './rating-form';

const dateFormat = new Intl.DateTimeFormat('tr-TR', {
  dateStyle: 'medium',
  timeStyle: 'short',
  timeZone: 'Europe/Istanbul',
});

export default async function PromptDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ inf?: string }>;
}) {
  const [{ id }, { inf = '' }, { role }] = await Promise.all([
    params,
    searchParams,
    requireTeamMember(),
  ]);
  const lineage = await getPromptLineage(id);
  if (!lineage) notFound();

  const { current, versions, influencer } = lineage;
  const latest = versions[0] ?? { ...current, stats: null };
  const canEdit = role !== 'viewer';
  const [choices, selected] = await Promise.all([
    canEdit && !influencer ? listInfluencerChoices() : Promise.resolve([]),
    resolveInfluencerSlug(inf),
  ]);
  const canGenerate =
    canEdit && generationTypeForCategory[current.category] !== null;
  const referenceAssets = canGenerate
    ? await listReferenceAssets(
        await createSupabaseServerClient(),
        influencer ? [influencer.id] : choices.map((item) => item.id),
      )
    : [];
  const definitions = parseVariableDefinitions(current.variables);
  const defaults = Object.fromEntries(
    Object.entries(definitions).map(([name, item]) => [
      name,
      item.default ?? '',
    ]),
  );
  const infQuery = inf ? `?inf=${encodeURIComponent(inf)}` : '';
  const scopeLabel = influencer ? influencer.name : 'Global';

  return (
    <div className="page-stack">
      <header className="page-heading">
        <div>
          <p className="eyebrow">
            PROMPT · {categoryLabels[current.category]} · {scopeLabel}
          </p>
          <h1>{current.title}</h1>
          <p>
            v{current.version}
            {current.version !== latest.version && (
              <>
                {' '}
                (en son:{' '}
                <Link
                  className="underline"
                  href={`/prompts/${latest.id}${infQuery}`}
                >
                  v{latest.version}
                </Link>
                )
              </>
            )}
            {current.change_note && ` · ${current.change_note}`}
          </p>
        </div>
        <Link className="button button-quiet" href={`/prompts${infQuery}`}>
          Kütüphaneye dön
        </Link>
      </header>

      <section
        aria-labelledby="template-title"
        className="section-card space-y-3"
      >
        <h2 className="text-sm font-semibold" id="template-title">
          Şablon
        </h2>
        <pre className="whitespace-pre-wrap rounded-lg border border-line bg-canvas p-3 font-mono text-sm text-text">
          {current.body}
        </pre>
        {current.negative && (
          <p className="text-xs text-muted">
            Negatif: <span className="font-mono">{current.negative}</span>
          </p>
        )}
      </section>

      <section
        aria-labelledby="preview-title"
        className="section-card space-y-3"
      >
        <h2 className="text-sm font-semibold" id="preview-title">
          Doldur ve önizle
        </h2>
        <PreviewPanel
          body={current.body}
          assets={referenceAssets}
          canGenerate={canGenerate}
          defaultInfluencerId={selected?.id ?? null}
          defaults={defaults}
          fixedInfluencer={influencer}
          influencers={choices}
          isOwner={role === 'owner'}
          mode={modeForCategory[current.category]}
          negative={current.negative}
          promptId={current.id}
        />
      </section>

      <section aria-labelledby="versions-title" className="section-card">
        <h2 className="text-sm font-semibold" id="versions-title">
          Versiyonlar
        </h2>
        <div className="data-table-wrap mt-3">
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Versiyon</th>
                  <th>Tarih</th>
                  <th>Not</th>
                  <th>Başarı oranı</th>
                  <th>Ort. kredi</th>
                  <th>Puan</th>
                </tr>
              </thead>
              <tbody>
                {versions.map((version) => (
                  <tr key={version.id}>
                    <td>
                      <Link
                        aria-current={
                          version.id === current.id ? 'page' : undefined
                        }
                        className="font-semibold text-text hover:underline"
                        href={`/prompts/${version.id}${infQuery}`}
                      >
                        v{version.version}
                      </Link>
                    </td>
                    <td>{dateFormat.format(new Date(version.created_at))}</td>
                    <td>{version.change_note || '—'}</td>
                    <td>{formatRate(version.stats)}</td>
                    <td>{formatCredits(version.stats?.avg_credits)}</td>
                    <td>
                      {canEdit ? (
                        <RatingForm
                          promptId={version.id}
                          rating={version.rating}
                          version={version.version}
                        />
                      ) : version.rating ? (
                        `${version.rating}/5`
                      ) : (
                        '—'
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {canEdit && (
        <section
          aria-labelledby="new-version-title"
          className="section-card space-y-3"
        >
          <h2 className="text-sm font-semibold" id="new-version-title">
            Yeni versiyon oluştur
          </h2>
          <p className="text-sm text-muted">
            Mevcut versiyonlar değişmez; geçmiş üretimlerin başarı oranı kendi
            versiyonunda kalır.
          </p>
          <PromptForm
            inf={inf}
            influencers={[]}
            initial={{
              title: latest.title,
              body: latest.body,
              negative: latest.negative,
              defaults: Object.fromEntries(
                Object.entries(parseVariableDefinitions(latest.variables)).map(
                  ([name, item]) => [name, item.default ?? ''],
                ),
              ),
            }}
            lineage={{
              category: current.category,
              key: current.key,
              influencerId: current.influencer_id,
              scopeLabel,
            }}
          />
        </section>
      )}
    </div>
  );
}
