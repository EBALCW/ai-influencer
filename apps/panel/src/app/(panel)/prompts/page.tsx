import Link from 'next/link';
import { Plus } from 'lucide-react';
import { requireTeamMember } from '@/lib/auth';
import { EmptyState } from '@/components/ui';
import { categoryLabels, promptCategories } from '@/lib/prompt-schemas';
import { listPromptLineages, resolveInfluencerSlug } from '@/lib/prompts';
import { formatRate, formatCredits } from './format';

export default async function PromptsPage({
  searchParams,
}: {
  searchParams: Promise<{ inf?: string; kategori?: string; error?: string }>;
}) {
  const { inf = '', kategori = '', error } = await searchParams;
  const [{ role }, influencer] = await Promise.all([
    requireTeamMember(),
    resolveInfluencerSlug(inf),
  ]);
  const prompts = await listPromptLineages({ influencerId: influencer?.id });
  const category = (promptCategories as readonly string[]).includes(kategori)
    ? kategori
    : '';
  const visible = category
    ? prompts.filter((item) => item.category === category)
    : prompts;
  const canEdit = role !== 'viewer';
  const query = (params: Record<string, string>) => {
    const search = new URLSearchParams(
      Object.entries({ inf, ...params }).filter(([, value]) => value),
    ).toString();
    return search ? `?${search}` : '';
  };

  return (
    <div className="page-stack">
      <header className="page-heading">
        <div>
          <p className="eyebrow">STÜDYO</p>
          <h1>Prompt kütüphanesi</h1>
          <p>
            {influencer
              ? `Global prompt'lar ve ${influencer.name} için özel olanlar.`
              : "Global ve influencer'a özel prompt şablonları."}
          </p>
        </div>
        {canEdit && (
          <Link
            className="button button-primary"
            href={`/prompts/new${query({})}`}
          >
            <Plus size={16} /> Yeni prompt
          </Link>
        )}
      </header>

      {error === 'editor_required' && (
        <p className="section-card text-sm" role="alert">
          Prompt oluşturmak için düzenleme yetkisi gerekir.
        </p>
      )}

      <section className="section-card">
        <nav aria-label="Kategoriler" className="flex flex-wrap gap-2">
          <Link
            aria-current={!category ? 'page' : undefined}
            className="soft-badge"
            href={`/prompts${query({})}`}
          >
            Tümü
          </Link>
          {promptCategories.map((item) => (
            <Link
              aria-current={category === item ? 'page' : undefined}
              className="soft-badge"
              href={`/prompts${query({ kategori: item })}`}
              key={item}
            >
              {categoryLabels[item]}
            </Link>
          ))}
        </nav>

        {visible.length ? (
          <div className="data-table-wrap mt-5">
            <div className="table-scroll">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Prompt</th>
                    <th>Kategori</th>
                    <th>Kapsam</th>
                    <th>Versiyon</th>
                    <th>Puan</th>
                    <th>Başarı oranı</th>
                    <th>Ort. kredi</th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map((item) => (
                    <tr key={item.id}>
                      <td>
                        <Link
                          className="font-semibold text-text hover:underline"
                          href={`/prompts/${item.id}${query({})}`}
                        >
                          {item.title}
                        </Link>
                      </td>
                      <td>
                        {item.category ? categoryLabels[item.category] : '—'}
                      </td>
                      <td>{item.influencer?.name ?? 'Global'}</td>
                      <td>
                        v{item.version}
                        {(item.version_count ?? 1) > 1 && (
                          <span className="text-xs text-muted">
                            {' '}
                            · {item.version_count} versiyon
                          </span>
                        )}
                      </td>
                      <td>{item.rating ? `${item.rating}/5` : '—'}</td>
                      <td>{formatRate(item.stats)}</td>
                      <td>{formatCredits(item.stats?.avg_credits)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="table-footer">
              <span>{visible.length} prompt</span>
            </div>
          </div>
        ) : (
          <EmptyState
            title={
              prompts.length ? 'Bu kategoride prompt yok' : 'Henüz prompt yok'
            }
            description={
              canEdit
                ? 'Yeni prompt ile ilk şablonu oluşturun.'
                : 'Düzenleme yetkisi olan bir ekip üyesi prompt eklediğinde burada görünür.'
            }
          />
        )}
      </section>
    </div>
  );
}
