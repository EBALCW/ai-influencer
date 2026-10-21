'use client';

import { Suspense, useEffect, useState, useSyncExternalStore } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import {
  Activity,
  Bell,
  CalendarDays,
  ChevronDown,
  Clapperboard,
  Coins,
  Command,
  Film,
  LayoutDashboard,
  Menu,
  Moon,
  Settings2,
  Sparkles,
  Sun,
  UsersRound,
  X,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Toast } from '@/components/ui';

const navigation: Array<{
  label: string;
  href: string;
  icon: LucideIcon;
  group: string;
}> = [
  { label: 'Genel Bakış', href: '/', icon: LayoutDashboard, group: 'STÜDYO' },
  {
    label: 'Influencer’lar',
    href: '/influencers',
    icon: UsersRound,
    group: 'STÜDYO',
  },
  { label: 'İçerik', href: '/content', icon: Clapperboard, group: 'YAYIN' },
  { label: 'Takvim', href: '/calendar', icon: CalendarDays, group: 'YAYIN' },
  { label: 'Analitik', href: '/analytics', icon: Activity, group: 'BÜYÜME' },
  { label: 'Üretim', href: '/production', icon: Film, group: 'BÜYÜME' },
  { label: 'Maliyetler', href: '/costs', icon: Coins, group: 'YÖNETİM' },
  { label: 'Markalar', href: '/brands', icon: Sparkles, group: 'YÖNETİM' },
  { label: 'Ayarlar', href: '/settings', icon: Settings2, group: 'YÖNETİM' },
];

// Geçici: #42 (influencer listesi) gelene kadar seçici bu sabit listeden beslenir.
// Slug'lar supabase/seed.sql ile aynı olmalı.
const influencerOptions = [{ slug: 'demo-creator', name: 'Demo Creator' }];

function withInfluencer(href: string, slug: string) {
  return slug ? `${href}?inf=${encodeURIComponent(slug)}` : href;
}

function getStoredTheme(): 'dark' | 'light' {
  return window.localStorage.getItem('studio-theme') === 'light'
    ? 'light'
    : 'dark';
}

function subscribeToTheme(callback: () => void) {
  window.addEventListener('studio-theme-change', callback);
  return () => window.removeEventListener('studio-theme-change', callback);
}

function ShellContent({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const selectedInfluencer = searchParams.get('inf') ?? '';
  const selectedInfluencerName =
    influencerOptions.find((item) => item.slug === selectedInfluencer)?.name ??
    'Tüm influencer’lar';
  const theme = useSyncExternalStore(
    subscribeToTheme,
    getStoredTheme,
    () => 'dark',
  );
  const [mobileOpen, setMobileOpen] = useState(false);
  const [toast, setToast] = useState('');

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  function toggleTheme() {
    const nextTheme = theme === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = nextTheme;
    window.localStorage.setItem('studio-theme', nextTheme);
    window.dispatchEvent(new Event('studio-theme-change'));
    setToast(
      nextTheme === 'light'
        ? 'Açık tema etkinleştirildi'
        : 'Koyu tema etkinleştirildi',
    );
  }

  function selectInfluencer(value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set('inf', value);
    else params.delete('inf');
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, {
      scroll: false,
    });
  }

  const groups = [...new Set(navigation.map((item) => item.group))];
  const pageName =
    navigation.find((item) => item.href === pathname)?.label ?? 'Genel Bakış';

  return (
    <div className="studio-shell">
      {mobileOpen && (
        <button
          aria-label="Menüyü kapat"
          className="mobile-scrim"
          onClick={() => setMobileOpen(false)}
          type="button"
        />
      )}
      <aside className={`sidebar ${mobileOpen ? 'sidebar-open' : ''}`}>
        <div className="brand-row">
          <Link
            aria-label="AI Influencer Studio ana sayfa"
            className="brand"
            href={withInfluencer('/', selectedInfluencer)}
          >
            <span className="brand-mark">
              <Sparkles size={19} />
            </span>
            <span>
              <strong>INFLUENCER</strong>
              <small>STUDIO</small>
            </span>
          </Link>
          <button
            aria-label="Menüyü kapat"
            className="mobile-close"
            onClick={() => setMobileOpen(false)}
            type="button"
          >
            <X size={18} />
          </button>
        </div>
        <div className="workspace-switcher">
          <span className="workspace-avatar">IS</span>
          <span className="workspace-name">
            <strong>Studio Workspace</strong>
            <small>{selectedInfluencerName}</small>
          </span>
        </div>
        <nav aria-label="Ana menü" className="main-nav">
          {groups.map((group) => (
            <div className="nav-group" key={group}>
              <p className="nav-group-label">{group}</p>
              {navigation
                .filter((item) => item.group === group)
                .map(({ label, href, icon: Icon }) => {
                  const active =
                    href === '/' ? pathname === '/' : pathname.startsWith(href);
                  return (
                    <Link
                      aria-current={active ? 'page' : undefined}
                      className={`nav-link ${active ? 'nav-link-active' : ''}`}
                      href={withInfluencer(href, selectedInfluencer)}
                      key={href}
                      onClick={() => setMobileOpen(false)}
                    >
                      <Icon size={17} strokeWidth={1.8} />
                      <span>{label}</span>
                      {active && <span className="nav-active-mark" />}
                    </Link>
                  );
                })}
            </div>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="help-card">
            <span className="help-orb">
              <Command size={16} />
            </span>
            <strong>Yaratıcı süreç, tek yerde.</strong>
            <small>İçerik yolculuğunuzun her adımını düzenleyin.</small>
            <Link href={withInfluencer('/content', selectedInfluencer)}>
              Çalışma alanına git <span>↗</span>
            </Link>
          </div>
          {/* #39 (auth) gelince oturumdaki kullanıcının adı ve rolü gösterilecek */}
          <div className="profile-row">
            <span className="profile-avatar">?</span>
            <span>
              <strong>Ekip üyesi</strong>
              <small>Giriş yakında</small>
            </span>
          </div>
        </div>
      </aside>

      <div className="main-column">
        <header className="topbar">
          <div className="topbar-left">
            <button
              aria-label="Menüyü aç"
              className="mobile-menu-button"
              onClick={() => setMobileOpen(true)}
              type="button"
            >
              <Menu size={19} />
            </button>
            <div className="breadcrumb">
              <span>Studio</span>
              <span className="breadcrumb-slash">/</span>
              <strong>{pageName}</strong>
            </div>
          </div>
          <div className="topbar-actions">
            <label className="influencer-select-wrap">
              <UsersRound size={16} />
              <select
                aria-label="Aktif influencer"
                onChange={(event) => selectInfluencer(event.target.value)}
                value={selectedInfluencer}
              >
                <option value="">Tüm influencer’lar</option>
                {influencerOptions.map((item) => (
                  <option key={item.slug} value={item.slug}>
                    {item.name}
                  </option>
                ))}
              </select>
              <ChevronDown aria-hidden="true" size={14} />
            </label>
            <button
              aria-label={
                theme === 'dark' ? 'Açık temaya geç' : 'Koyu temaya geç'
              }
              className="icon-button"
              onClick={toggleTheme}
              title="Temayı değiştir"
              type="button"
            >
              {theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}
            </button>
            <button
              aria-label="Bildirimler"
              className="icon-button notification-button"
              onClick={() => setToast('Şu anda yeni bildiriminiz yok')}
              type="button"
            >
              <Bell size={17} />
              <span />
            </button>
            <span className="topbar-divider" />
            <button
              aria-label="Hesap menüsü"
              className="topbar-profile"
              type="button"
            >
              <span className="profile-avatar profile-avatar-small">?</span>
              <ChevronDown size={14} />
            </button>
          </div>
        </header>
        <main className="main-content">{children}</main>
        <footer className="app-footer">
          <span>AI Influencer Studio</span>
          <span>
            Yerel geliştirme alanı <i /> v0.1
          </span>
        </footer>
      </div>
      {toast && <Toast message={toast} onDismiss={() => setToast('')} />}
    </div>
  );
}

export function PanelShell({ children }: { children: React.ReactNode }) {
  return (
    <Suspense
      fallback={
        <div className="shell-fallback" aria-label="Panel yükleniyor" />
      }
    >
      <ShellContent>{children}</ShellContent>
    </Suspense>
  );
}
