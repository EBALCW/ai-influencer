import Link from 'next/link';
import { redirect } from 'next/navigation';
import {
  ArrowUpRight,
  BookOpenText,
  CalendarDays,
  Clapperboard,
  Coins,
  Film,
  Scissors,
  UsersRound,
} from 'lucide-react';
import { MODULES, type ModuleId } from '@ai-influencer/shared';
import { EmptyState } from '@/components/ui';
import { requireTeamMember } from '@/lib/auth';
import { machineLabel } from '@/lib/home/activity';
import { getHomeData, type HomeData } from '@/lib/home/queries';
import { MODULE_HREFS, MODULE_LABELS, isParkedModule } from '@/lib/navigation';

const DASHBOARD_PARAMS = ['range', 'from', 'to', 'platform'];

const dateFormat = new Intl.DateTimeFormat('tr-TR', {
  dateStyle: 'medium',
  timeStyle: 'short',
  timeZone: 'Europe/Istanbul',
});

const moduleIcons: Record<ModuleId, typeof BookOpenText> = {
  explainer: BookOpenText,
  clip: Scissors,
  influencer: UsersRound,
};

const moduleCopy: Record<
  ModuleId,
  { description: string; summary: (counts: HomeData['counts']) => string }
> = {
  explainer: {
    description:
      'Kısa bir istekten ya da konudan seslendirmeli, altyazılı dikey video. Seri ya da tekil; karakter gerekmez.',
    summary: (c) => `${c.series} seri · ${c.episodes} video`,
  },
  clip: {
    description:
      'Yayın videosundan seçilebilir dikey klipler. Kaynak adresi ve hak durumu yeterli.',
    summary: (c) => `${c.clipSources} kaynak · ${c.clips} klip`,
  },
  influencer: {
    description:
      'Karakterli içerik: persona, referans görseller ve ücretli üretici. Altyapısı duruyor, v1 önceliği değil.',
    summary: (c) => `${c.influencers} karakter`,
  },
};

const badge =
  'inline-flex items-center rounded-full border border-line px-2 py-0.5 text-xs font-medium';

/**
 * Ana ekran (#200, ADR 0004 → Karar 7): modüller, modüller arası son üretimler ve makine
 * durumu. Eski influencer dashboard'u `/influencers/overview` adresine taşındı; filtreli eski
 * adresler oraya yönlenir.
 */
export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  if (DASHBOARD_PARAMS.some((name) => params[name] !== undefined)) {
    const query = new URLSearchParams();
    for (const [name, value] of Object.entries(params)) {
      const first = Array.isArray(value) ? value[0] : value;
      if (first !== undefined) query.set(name, first);
    }
    redirect(`/influencers/overview?${query}`);
  }
  const [{ role }, data] = await Promise.all([
    requireTeamMember(),
    getHomeData(),
  ]);
  const canWrite = role !== 'viewer';
  const inf = Array.isArray(params.inf) ? params.inf[0] : params.inf;
  const withInf = (href: string) =>
    inf ? `${href}?inf=${encodeURIComponent(inf)}` : href;

  return (
    <div className="page-stack">
      <header className="page-heading">
        <div>
          <p className="eyebrow">PANEL</p>
          <h1>Ana ekran</h1>
          <p>
            Bir modül seçin ya da kaldığınız üretime dönün.
            {!canWrite &&
              ' İzleyici rolündesiniz: her şeyi görür, değiştiremezsiniz.'}
          </p>
        </div>
        <Link className="soft-badge" href={withInf('/production')}>
          <Film aria-hidden="true" size={14} /> {machineLabel(data.machines)}
        </Link>
      </header>

      <section aria-labelledby="home-modules" className="section-card">
        <div className="section-heading">
          <div>
            <p className="eyebrow">MODÜLLER</p>
            <h2 id="home-modules">Ne üretmek istiyorsunuz?</h2>
          </div>
        </div>
        <ul className="mt-4 grid list-none gap-3 p-0 lg:grid-cols-3">
          {MODULES.toSorted(
            (a, b) => Number(isParkedModule(a)) - Number(isParkedModule(b)),
          ).map((moduleId) => {
            const Icon = moduleIcons[moduleId];
            const parked = isParkedModule(moduleId);
            const copy = moduleCopy[moduleId];
            return (
              <li key={moduleId}>
                <Link
                  aria-label={`${MODULE_LABELS[moduleId]}${parked ? ' (park edildi)' : ''}: ${copy.summary(data.counts)}`}
                  className={`flex h-full flex-col gap-3 rounded-xl border border-line bg-surface-raised p-4 transition-colors hover:border-accent ${
                    parked ? 'border-dashed' : ''
                  }`}
                  href={withInf(MODULE_HREFS[moduleId])}
                >
                  <span className="flex items-center gap-3">
                    <span className="quick-link-icon">
                      <Icon aria-hidden="true" size={18} />
                    </span>
                    <strong className="text-sm text-text">
                      {MODULE_LABELS[moduleId]}
                    </strong>
                    {parked && (
                      <span className={`${badge} ml-auto text-muted`}>
                        Park edildi
                      </span>
                    )}
                  </span>
                  <span className="text-sm leading-relaxed text-muted">
                    {copy.description}
                  </span>
                  <span className="mt-auto flex items-center justify-between text-xs text-text">
                    {copy.summary(data.counts)}
                    <ArrowUpRight aria-hidden="true" size={15} />
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </section>

      <section aria-labelledby="home-activity" className="section-card">
        <div className="section-heading">
          <div>
            <p className="eyebrow">BÜTÜN MODÜLLER</p>
            <h2 id="home-activity">Son üretimler</h2>
          </div>
          <Link className="button button-quiet" href={withInf('/production')}>
            Üretim işleri
          </Link>
        </div>
        {data.activity.length === 0 ? (
          <EmptyState
            title="Henüz üretim yok"
            description={
              canWrite
                ? 'İlk adım: bir anlatım videosu başlatın ya da klip çıkarmak için bir yayın kaynağı ekleyin. Ürettikleriniz burada listelenir.'
                : 'Ekip bir üretim başlattığında burada listelenir.'
            }
            action={
              canWrite ? (
                <span className="flex flex-wrap justify-center gap-3">
                  <Link className="button button-primary" href="/explainers">
                    Anlatım videosu başlat
                  </Link>
                  <Link className="button button-primary" href="/clips">
                    Yayın kaynağı ekle
                  </Link>
                </span>
              ) : undefined
            }
          />
        ) : (
          <ul className="m-0 list-none divide-y divide-line-soft p-0">
            {data.activity.map((item) => (
              <li
                className="flex flex-wrap items-center gap-x-4 gap-y-1 py-3"
                key={item.id}
              >
                <span className={`${badge} text-muted`}>
                  {MODULE_LABELS[item.module]}
                </span>
                <span className="min-w-0 flex-1">
                  <Link
                    className="block truncate text-sm font-medium text-text hover:text-accent"
                    href={item.href}
                  >
                    {item.title}
                  </Link>
                  <span className="block truncate text-xs text-muted">
                    {item.detail}
                  </span>
                </span>
                <span className={`${badge} text-text`}>{item.status}</span>
                <time className="text-xs text-muted" dateTime={item.at}>
                  {dateFormat.format(new Date(item.at))}
                </time>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="home-shared" className="section-card">
        <div className="section-heading">
          <div>
            <p className="eyebrow">ORTAK SAYFALAR</p>
            <h2 id="home-shared">Yayın ve yönetim</h2>
          </div>
        </div>
        <div className="quick-links mt-4">
          {(
            [
              ['/content', 'İçerik akışı', 'Kartlar ve aşamalar', Clapperboard],
              [
                '/calendar',
                'Yayın takvimi',
                'Planlanan paylaşımlar',
                CalendarDays,
              ],
              ['/costs', 'Maliyetler', 'Harcama ve bütçe', Coins],
            ] as const
          ).map(([href, title, detail, Icon]) => (
            <Link className="quick-link" href={withInf(href)} key={href}>
              <span className="quick-link-icon">
                <Icon aria-hidden="true" size={18} />
              </span>
              <span className="quick-link-copy">
                <strong>{title}</strong>
                <small>{detail}</small>
              </span>
              <ArrowUpRight className="quick-link-arrow" size={16} />
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
