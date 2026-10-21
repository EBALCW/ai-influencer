'use client';

import { Suspense, useState, type ComponentType } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import {
  Activity,
  ArrowDownRight,
  ArrowRight,
  Bell,
  CalendarDays,
  ChartNoAxesCombined,
  ChevronDown,
  CircleDollarSign,
  Clapperboard,
  Command,
  LayoutDashboard,
  Link2,
  Menu,
  Moon,
  Search,
  Settings2,
  Sparkles,
  Sun,
  UsersRound,
  Video,
  X,
} from 'lucide-react';
import { EmptyState, StatCard } from '../components/ui';
import { messages } from '../lib/messages';

const iconMap: Record<
  string,
  ComponentType<{ size?: number; strokeWidth?: number }>
> = {
  overview: LayoutDashboard,
  users: UsersRound,
  content: Clapperboard,
  calendar: CalendarDays,
  analytics: ChartNoAxesCombined,
  production: Video,
  costs: CircleDollarSign,
  brands: Activity,
  settings: Settings2,
  sparkles: Sparkles,
  link: Link2,
};

const demoInfluencers = [
  { slug: 'ornek-moda', label: 'Örnek Moda Profili' },
  { slug: 'ornek-teknoloji', label: 'Örnek Teknoloji Profili' },
];

export default function HomePage() {
  return (
    <Suspense
      fallback={
        <div
          className="min-h-screen bg-canvas"
          aria-label={messages.common.loading}
        />
      }
    >
      <StudioShell />
    </Suspense>
  );
}

function StudioShell() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const activeView = searchParams.get('view') || 'overview';
  const activeInfluencer = searchParams.get('inf') || 'all';
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');

  function updateUrl(key: string, value: string, defaultValue: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value === defaultValue) params.delete(key);
    else params.set(key, value);
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, {
      scroll: false,
    });
  }

  function selectView(view: string) {
    updateUrl('view', view, 'overview');
    setMobileNavOpen(false);
  }

  function selectInfluencer(slug: string) {
    updateUrl('inf', slug, 'all');
  }

  const activeModule = messages.nav.find((item) => item.id === activeView);
  const selectedSlugIsUnknown =
    activeInfluencer !== 'all' &&
    !demoInfluencers.some((item) => item.slug === activeInfluencer);

  return (
    <main
      className={`min-h-screen bg-canvas text-slate-100 ${theme === 'light' ? 'theme-light' : ''}`}
    >
      <div className="fixed inset-0 -z-0 bg-[radial-gradient(ellipse_at_15%_0%,rgba(123,97,255,0.12),transparent_38%),radial-gradient(ellipse_at_95%_90%,rgba(48,177,154,0.08),transparent_32%)]" />
      <div className="relative z-10 flex min-h-screen">
        {mobileNavOpen ? (
          <button
            className="fixed inset-0 z-20 bg-slate-950/70 md:hidden"
            onClick={() => setMobileNavOpen(false)}
            aria-label={messages.common.close}
          />
        ) : null}
        <aside
          className={`fixed inset-y-0 left-0 z-30 flex w-[252px] flex-col border-r border-white/[0.06] bg-[#0c111e]/95 px-4 py-5 backdrop-blur-xl transition-transform md:sticky md:top-0 md:h-screen md:translate-x-0 ${mobileNavOpen ? 'translate-x-0' : '-translate-x-full'}`}
        >
          <div className="flex items-center justify-between px-2">
            <Link
              className="flex items-center gap-3"
              href="/"
              aria-label={messages.brand}
              onClick={() => selectView('overview')}
            >
              <span className="grid size-10 place-items-center rounded-[14px] bg-gradient-to-br from-violet-300 to-indigo-400 text-slate-950 shadow-lg shadow-violet-950/30">
                <Sparkles size={19} strokeWidth={2.2} />
              </span>
              <span>
                <span className="block text-[11px] font-bold tracking-[0.13em] text-white">
                  INFLUENCER
                </span>
                <span className="text-[11px] font-semibold tracking-[0.18em] text-violet-200">
                  STUDIO
                </span>
              </span>
            </Link>
            <button
              className="rounded-lg p-2 text-slate-500 hover:bg-white/5 hover:text-white md:hidden"
              onClick={() => setMobileNavOpen(false)}
              aria-label={messages.common.close}
            >
              <X size={17} />
            </button>
          </div>

          <button className="mt-8 flex items-center gap-3 rounded-xl border border-white/[0.08] bg-white/[0.025] p-3 text-left transition hover:bg-white/[0.05]">
            <span className="grid size-9 place-items-center rounded-xl bg-gradient-to-br from-emerald-300/20 to-cyan-300/10 text-emerald-200">
              <Command size={17} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-xs font-semibold text-white">
                {messages.workspaceName}
              </span>
              <span className="mt-0.5 block text-[10px] text-slate-500">
                {messages.workspace}
              </span>
            </span>
            <ChevronDown size={15} className="text-slate-500" />
          </button>

          <nav className="mt-7 flex-1 space-y-6" aria-label="Ana menü">
            {Array.from(new Set(messages.nav.map((item) => item.group))).map(
              (group) => (
                <div key={group}>
                  <p className="mb-2 px-3 text-[9px] font-bold tracking-[0.16em] text-slate-600">
                    {group}
                  </p>
                  <div className="space-y-1">
                    {messages.nav
                      .filter((item) => item.group === group)
                      .map((item) => {
                        const Icon = iconMap[item.icon] ?? Sparkles;
                        const active = activeView === item.id;
                        return (
                          <button
                            key={item.id}
                            onClick={() => selectView(item.id)}
                            aria-current={active ? 'page' : undefined}
                            className={`group flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-[13px] transition ${active ? 'bg-violet-300/[0.12] font-medium text-violet-100 ring-1 ring-inset ring-violet-300/[0.12]' : 'text-slate-400 hover:bg-white/[0.04] hover:text-slate-100'}`}
                          >
                            <Icon size={16} strokeWidth={active ? 2 : 1.8} />
                            <span className="flex-1">{item.label}</span>
                            {active ? (
                              <span className="size-1.5 rounded-full bg-violet-200" />
                            ) : null}
                          </button>
                        );
                      })}
                  </div>
                </div>
              ),
            )}
          </nav>

          <div className="rounded-2xl border border-violet-300/[0.12] bg-gradient-to-br from-violet-300/[0.08] to-transparent p-4">
            <div className="flex items-center gap-2 text-xs font-semibold text-white">
              <Sparkles size={14} className="text-violet-200" />{' '}
              {messages.sidebarTip}
            </div>
            <p className="mt-2 text-[11px] leading-5 text-slate-400">
              Yeni modüller, proje yol haritasındaki sıraya göre ekleniyor.
            </p>
            <a
              href="https://github.com/EBALCW/ai-influencer/issues"
              target="_blank"
              rel="noreferrer"
              className="mt-3 inline-flex items-center gap-1 text-[11px] font-medium text-violet-200 hover:text-white"
            >
              Yol haritası <ArrowRight size={12} />
            </a>
          </div>
          <div className="mt-4 flex items-center gap-3 border-t border-white/[0.06] px-2 pt-4">
            <span className="grid size-9 place-items-center rounded-full bg-gradient-to-br from-orange-200 to-rose-300 text-xs font-bold text-slate-900">
              ES
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-xs font-medium text-white">
                {messages.profile}
              </span>
              <span className="text-[10px] text-slate-500">
                {messages.role}
              </span>
            </span>
            <button
              className="rounded-lg p-2 text-slate-500 hover:bg-white/5 hover:text-white"
              aria-label="Profil ayarları"
              onClick={() => selectView('settings')}
            >
              <Settings2 size={15} />
            </button>
          </div>
        </aside>

        <div className="min-w-0 flex-1">
          <header className="sticky top-0 z-20 flex h-[72px] items-center justify-between border-b border-white/[0.06] bg-[#0b101c]/80 px-4 backdrop-blur-xl sm:px-7 lg:px-10">
            <div className="flex items-center gap-3">
              <button
                className="rounded-xl border border-white/[0.08] p-2.5 text-slate-300 hover:bg-white/[0.05] md:hidden"
                onClick={() => setMobileNavOpen(true)}
                aria-label={messages.menu}
              >
                <Menu size={18} />
              </button>
              <div className="hidden items-center gap-2 text-xs text-slate-500 sm:flex">
                <span>{messages.workspaceName}</span>
                <span className="text-slate-700">/</span>
                <span className="text-slate-200">
                  {activeModule?.label ?? messages.nav[0].label}
                </span>
              </div>
              <span className="text-sm font-semibold text-white sm:hidden">
                {activeModule?.label ?? messages.nav[0].label}
              </span>
            </div>
            <div className="flex items-center gap-2 sm:gap-3">
              <label className="hidden h-10 w-56 items-center gap-2 rounded-xl border border-white/[0.07] bg-white/[0.025] px-3 text-slate-500 xl:flex">
                <Search size={15} />
                <input
                  className="w-full bg-transparent text-xs text-white outline-none placeholder:text-slate-500"
                  placeholder={messages.search}
                />
                <kbd className="rounded border border-white/10 px-1 py-0.5 text-[9px]">
                  ⌘K
                </kbd>
              </label>
              <button
                className="grid size-10 place-items-center rounded-xl border border-white/[0.07] bg-white/[0.025] text-slate-400 hover:text-white xl:hidden"
                onClick={() => setSearchOpen(!searchOpen)}
                aria-label={messages.search}
              >
                <Search size={16} />
              </button>
              <div className="relative">
                <UsersRound
                  size={14}
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"
                />
                <select
                  className="h-10 max-w-[155px] appearance-none rounded-xl border border-white/[0.07] bg-white/[0.025] pl-9 pr-8 text-xs text-slate-200 outline-none hover:bg-white/[0.05] focus:border-violet-300/40 sm:max-w-[190px]"
                  value={activeInfluencer}
                  onChange={(event) => selectInfluencer(event.target.value)}
                  aria-label="Aktif influencer seç"
                >
                  <option value="all">{messages.allInfluencers}</option>
                  {selectedSlugIsUnknown ? (
                    <option value={activeInfluencer}>{activeInfluencer}</option>
                  ) : null}
                  {demoInfluencers.map((influencer) => (
                    <option key={influencer.slug} value={influencer.slug}>
                      {influencer.label}
                    </option>
                  ))}
                </select>
                <ChevronDown
                  size={13}
                  className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500"
                />
              </div>
              <button
                className="hidden size-10 place-items-center rounded-xl border border-white/[0.07] bg-white/[0.025] text-slate-400 hover:text-white sm:grid"
                onClick={() =>
                  setTheme((current) => (current === 'dark' ? 'light' : 'dark'))
                }
                aria-label={
                  theme === 'dark'
                    ? messages.switchToLight
                    : messages.switchToDark
                }
                title={
                  theme === 'dark'
                    ? messages.switchToLight
                    : messages.switchToDark
                }
              >
                {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
              </button>
              <button
                className="relative grid size-10 place-items-center rounded-xl border border-white/[0.07] bg-white/[0.025] text-slate-400 hover:text-white"
                aria-label={messages.notifications}
              >
                <Bell size={16} />
                <span className="absolute right-2 top-2 size-1.5 rounded-full border border-[#0b101c] bg-rose-300" />
              </button>
              <span className="hidden size-9 place-items-center rounded-full bg-gradient-to-br from-orange-200 to-rose-300 text-xs font-bold text-slate-900 sm:grid">
                ES
              </span>
            </div>
          </header>
          {searchOpen ? (
            <div className="border-b border-white/[0.06] px-4 py-3 xl:hidden">
              <input
                autoFocus
                className="w-full rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-2.5 text-sm outline-none placeholder:text-slate-500 focus:border-violet-300/40"
                placeholder={messages.search}
              />
            </div>
          ) : null}

          <div className="mx-auto max-w-[1500px] px-4 py-7 sm:px-7 sm:py-9 lg:px-10">
            {activeView === 'overview' ? (
              <>
                <div className="mb-7 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
                  <div>
                    <p className="text-[10px] font-bold tracking-[0.16em] text-violet-200/80">
                      {messages.overviewEyebrow}
                    </p>
                    <h1 className="mt-2 text-2xl font-semibold tracking-tight text-white sm:text-[30px]">
                      {messages.overviewTitle}
                      <span className="ml-2">✦</span>
                    </h1>
                    <p className="mt-2 text-sm text-slate-400">
                      {messages.overviewSubtitle}
                    </p>
                  </div>
                  <button
                    onClick={() => selectView('influencers')}
                    className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-violet-200 px-4 text-xs font-semibold text-slate-950 shadow-lg shadow-violet-950/20 transition hover:bg-violet-100"
                  >
                    <Sparkles size={15} />
                    {messages.createInfluencer}
                    <ArrowRight size={14} />
                  </button>
                </div>

                <section className="hero-banner relative overflow-hidden rounded-[22px] border border-violet-200/[0.13] bg-gradient-to-br from-[#211c3e] via-[#17182d] to-[#111b28] p-6 shadow-[0_24px_80px_-48px_rgba(139,112,255,0.5)] sm:p-8 lg:p-9">
                  <div className="pointer-events-none absolute -right-10 -top-24 size-80 rounded-full border border-violet-200/[0.08]" />
                  <div className="pointer-events-none absolute -right-2 -top-16 size-64 rounded-full border border-violet-200/[0.06]" />
                  <div className="pointer-events-none absolute right-12 top-9 hidden size-44 rotate-12 rounded-[34px] border border-white/[0.07] bg-white/[0.025] lg:block" />
                  <div className="relative max-w-2xl">
                    <span className="inline-flex items-center gap-2 rounded-full border border-violet-200/[0.17] bg-violet-200/[0.08] px-3 py-1.5 text-[10px] font-medium tracking-wide text-violet-100">
                      <span className="size-1.5 rounded-full bg-emerald-300" />{' '}
                      {messages.studioReady}
                    </span>
                    <h2 className="mt-5 max-w-xl text-2xl font-semibold leading-tight tracking-tight text-white sm:text-3xl">
                      {messages.welcomeTitle}
                    </h2>
                    <p className="mt-3 max-w-lg text-sm leading-6 text-slate-300/75">
                      {messages.welcomeBody}
                    </p>
                    <div className="mt-6 flex flex-wrap gap-3">
                      <button
                        onClick={() => selectView('influencers')}
                        className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-xs font-semibold text-slate-950 hover:bg-violet-50"
                      >
                        <Sparkles size={14} />
                        {messages.createInfluencer}
                        <ArrowRight size={13} />
                      </button>
                      <a
                        href="https://github.com/EBALCW/ai-influencer/issues"
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-2 rounded-xl border border-white/[0.12] bg-white/[0.035] px-4 py-2.5 text-xs font-medium text-slate-200 hover:bg-white/[0.08]"
                      >
                        {messages.viewRoadmap}
                      </a>
                    </div>
                  </div>
                  <div className="absolute bottom-7 right-8 hidden size-28 rotate-[-8deg] items-center justify-center rounded-[28px] border border-white/10 bg-[#14192a]/70 shadow-2xl lg:flex">
                    <div className="grid size-16 place-items-center rounded-[20px] bg-gradient-to-br from-violet-200/25 to-cyan-200/10 text-violet-100">
                      <Sparkles size={30} strokeWidth={1.4} />
                    </div>
                  </div>
                </section>

                <section className="mt-8">
                  <div className="mb-4 flex items-center justify-between">
                    <div>
                      <h2 className="text-sm font-semibold text-white">
                        {messages.metricsTitle}
                      </h2>
                      <p className="mt-1 text-xs text-slate-500">
                        {messages.allAccounts}
                      </p>
                    </div>
                    <span className="rounded-lg border border-white/[0.07] bg-white/[0.025] px-2.5 py-1.5 text-[10px] text-slate-400">
                      {messages.last30Days}{' '}
                      <ChevronDown size={11} className="ml-1 inline" />
                    </span>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    {messages.metrics.map((metric) => {
                      const Icon = iconMap[metric.icon] ?? Sparkles;
                      return (
                        <StatCard
                          key={metric.label}
                          label={metric.label}
                          value={metric.value}
                          hint={metric.hint}
                          icon={<Icon size={16} />}
                        />
                      );
                    })}
                  </div>
                </section>

                <div className="mt-8 grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
                  <section className="rounded-2xl border border-white/[0.07] bg-panel p-5 sm:p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <h2 className="text-sm font-semibold text-white">
                          {messages.gettingStarted}
                        </h2>
                        <p className="mt-1 text-xs text-slate-500">
                          {messages.gettingStartedHint}
                        </p>
                      </div>
                      <span className="rounded-full bg-white/[0.05] px-2.5 py-1 text-[10px] text-slate-400">
                        0 / 3
                      </span>
                    </div>
                    <div className="mt-5 space-y-2">
                      {messages.steps.map((step, index) => {
                        const Icon = iconMap[step.icon] ?? Sparkles;
                        const target =
                          ['influencers', 'content', 'settings'][index] ??
                          'overview';
                        return (
                          <button
                            key={step.title}
                            onClick={() => selectView(target)}
                            className="flex w-full items-center gap-3 rounded-xl border border-transparent px-3 py-3 text-left transition hover:border-white/[0.06] hover:bg-white/[0.025]"
                          >
                            <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-white/[0.045] text-slate-300">
                              <Icon size={16} />
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="block text-xs font-medium text-slate-200">
                                {step.title}
                              </span>
                              <span className="mt-1 block text-[11px] text-slate-500">
                                {step.description}
                              </span>
                            </span>
                            <span className="grid size-6 place-items-center rounded-full border border-white/[0.09] text-[10px] text-slate-500">
                              {index + 1}
                            </span>
                            <ArrowRight size={14} className="text-slate-600" />
                          </button>
                        );
                      })}
                    </div>
                  </section>
                  <section className="rounded-2xl border border-white/[0.07] bg-panel p-5 sm:p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <h2 className="text-sm font-semibold text-white">
                          {messages.activityTitle}
                        </h2>
                        <p className="mt-1 text-xs text-slate-500">
                          Stüdyodaki son güncellemeler
                        </p>
                      </div>
                      <span className="grid size-8 place-items-center rounded-lg bg-white/[0.04] text-slate-400">
                        <Activity size={15} />
                      </span>
                    </div>
                    <div className="mt-5 flex min-h-36 flex-col items-center justify-center rounded-xl border border-dashed border-white/[0.07] px-5 text-center">
                      <span className="grid size-9 place-items-center rounded-xl bg-white/[0.04] text-slate-500">
                        <ArrowDownRight size={16} />
                      </span>
                      <p className="mt-3 max-w-xs text-xs leading-5 text-slate-500">
                        {messages.activityEmpty}
                      </p>
                    </div>
                  </section>
                </div>
              </>
            ) : (
              <>
                <div className="mb-7">
                  <p className="text-[10px] font-bold tracking-[0.16em] text-violet-200/80">
                    {activeModule?.group ?? 'STÜDYO'}
                  </p>
                  <h1 className="mt-2 text-2xl font-semibold tracking-tight text-white">
                    {activeModule?.label ?? messages.nav[0].label}
                  </h1>
                  <p className="mt-2 text-sm text-slate-400">
                    {messages.overviewSubtitle}
                  </p>
                </div>
                <EmptyState
                  icon={<Sparkles size={21} />}
                  title={messages.emptyTitle}
                  description={messages.emptyBody}
                  action={
                    <div className="flex flex-wrap justify-center gap-3">
                      <button
                        onClick={() => selectView('overview')}
                        className="rounded-xl bg-white px-4 py-2.5 text-xs font-semibold text-slate-950 hover:bg-slate-200"
                      >
                        {messages.backToOverview}
                      </button>
                      <a
                        href="https://github.com/EBALCW/ai-influencer/issues"
                        target="_blank"
                        rel="noreferrer"
                        className="rounded-xl border border-white/10 px-4 py-2.5 text-xs font-medium text-slate-300 hover:bg-white/5"
                      >
                        {messages.viewRoadmap}
                      </a>
                    </div>
                  }
                />
              </>
            )}
            <footer className="mt-10 flex flex-col gap-2 border-t border-white/[0.06] pt-5 text-[10px] text-slate-600 sm:flex-row sm:items-center sm:justify-between">
              <span>
                {messages.footer}{' '}
                <span className="mx-1.5 text-slate-700">·</span>{' '}
                {messages.environment}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="size-1.5 rounded-full bg-emerald-300" />
                {messages.systemsOnline}
              </span>
            </footer>
          </div>
        </div>
      </div>
    </main>
  );
}
