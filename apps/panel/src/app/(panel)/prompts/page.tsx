import Link from 'next/link';
import { Download, Plus } from 'lucide-react';
import { requireTeamMember } from '@/lib/auth';
import { EmptyState } from '@/components/ui';
import { categoryLabels, promptCategories } from '@/lib/prompt-schemas';
import { listPromptLineages, resolveInfluencerSlug } from '@/lib/prompts';
import { ExportSelection } from './export-selection';
import { formatRate, formatCredits } from './format';
import { PromptImport } from './prompt-import';

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
        <div className="flex flex-wrap gap-2">
          {visible.length > 0 && (
            <a
              className="button button-quiet"
              download
              href={`/api/prompts/export${query({ kategori: category })}`}
            >
              <Download size={16} /> Tümünü dışa aktar
            </a>
          )}
          {canEdit && (
            <Link
              className="button button-primary"
              href={`/prompts/new${query({})}`}
            >
              <Plus size={16} /> Yeni prompt
            </Link>
          )}
        </div>
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
            <ExportSelection
              footer={<span>{visible.length} prompt</span>}
              inf={inf}
            >
              <div className="table-scroll">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>
                        <span className="sr-only">Seç</span>
                      </th>
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
                          <input
                            aria-label={`${item.title} dışa aktarılsın`}
                            name="id"
                            type="checkbox"
                            value={item.id ?? ''}
                          />
                        </td>
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
            </ExportSelection>
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

      {canEdit && (
        <section className="section-card">
          <div className="section-heading">
            <div>
              <p className="eyebrow">DOSYA</p>
              <h2>İçe aktar</h2>
              <p className="text-sm text-muted">
                Panelden indirilen prompt paketini yükleyin. Prompt dosyaları
                repoya commit&apos;lenmez (repo public).
              </p>
            </div>
          </div>
          <PromptImport />
        </section>
      )}
    </div>
  );
}
