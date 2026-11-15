import { PARKED_MODULES, type ModuleId } from '@ai-influencer/shared';

/**
 * Panel gezinmesi (#200, docs/adr/0004-moduler-panel.md → Karar 7). Modüller üst düzey
 * bölümdür; ortak sayfalar (yayın, üretim, yönetim) bütün modüllere hizmet eder. Mevcut
 * adresler değişmez: yalnız gruplar yeniden düzenlenir.
 * Saf veri: ikonlar adla seçilir (bileşen prop'u server → client sınırını geçemez).
 */
export type NavIcon =
  | 'home'
  | 'explainer'
  | 'clip'
  | 'influencer'
  | 'prompts'
  | 'research'
  | 'brands'
  | 'production'
  | 'content'
  | 'calendar'
  | 'inbox'
  | 'analytics'
  | 'costs'
  | 'settings';

export type NavItem = {
  label: string;
  href: string;
  icon: NavIcon;
  /** Modül park edildi: altyapısı durur, erişilebilir kalır (docs/scope-v1.md). */
  parked?: boolean;
  /** Bir modülün alt sayfası (menüde girintili). */
  child?: boolean;
};
export type NavGroup = { label: string; items: NavItem[] };

export const MODULE_LABELS: Record<ModuleId, string> = {
  explainer: 'Anlatım videoları',
  clip: 'Yayıncı klipleri',
  influencer: 'AI influencer',
};

export const MODULE_HREFS: Record<ModuleId, string> = {
  explainer: '/explainers',
  clip: '/clips',
  influencer: '/influencers',
};

export function isParkedModule(module: ModuleId): boolean {
  return PARKED_MODULES.includes(module);
}

export const NAV_GROUPS: readonly NavGroup[] = [
  {
    label: 'PANEL',
    items: [{ label: 'Ana ekran', href: '/', icon: 'home' }],
  },
  {
    label: 'MODÜLLER',
    items: [
      {
        label: MODULE_LABELS.explainer,
        href: '/explainers',
        icon: 'explainer',
      },
      { label: MODULE_LABELS.clip, href: '/clips', icon: 'clip' },
      {
        label: MODULE_LABELS.influencer,
        href: '/influencers',
        icon: 'influencer',
        parked: isParkedModule('influencer'),
      },
      { label: "Prompt'lar", href: '/prompts', icon: 'prompts', child: true },
      { label: 'Araştırma', href: '/research', icon: 'research', child: true },
      { label: 'Markalar', href: '/brands', icon: 'brands', child: true },
    ],
  },
  {
    label: 'ÜRETİM',
    items: [{ label: 'Üretim', href: '/production', icon: 'production' }],
  },
  {
    label: 'YAYIN',
    items: [
      { label: 'İçerik', href: '/content', icon: 'content' },
      { label: 'Takvim', href: '/calendar', icon: 'calendar' },
      { label: 'Gelen kutusu', href: '/inbox', icon: 'inbox' },
      { label: 'Analitik', href: '/analytics', icon: 'analytics' },
    ],
  },
  {
    label: 'YÖNETİM',
    items: [
      { label: 'Maliyetler', href: '/costs', icon: 'costs' },
      { label: 'Ayarlar', href: '/settings', icon: 'settings' },
    ],
  },
];

const ALL_ITEMS = NAV_GROUPS.flatMap((group) => group.items);

/** Adres bu menü öğesinin altında mı? (`/clips` → `/clips/x` evet, `/clipsy` hayır.) */
export function isNavActive(href: string, pathname: string): boolean {
  if (href === '/') return pathname === '/';
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** Geçerli sayfanın menü öğesi; menüde olmayan adreste `null`. */
export function activeNavItem(pathname: string): NavItem | null {
  return ALL_ITEMS.find((item) => isNavActive(item.href, pathname)) ?? null;
}

/** Üst çubuktaki sayfa adı. */
export function pageName(pathname: string): string {
  if (pathname === '/notifications') return 'Bildirimler';
  return activeNavItem(pathname)?.label ?? 'Ana ekran';
}

/**
 * Genel influencer seçici (`?inf=`) karakter isteyen sayfalarda görünür. Ana ekran ve anlatım
 * modülü karakter istemez (docs/scope-v1.md → İlke 2); seçim adreste kalır, menü linkleri korur.
 */
export function showsInfluencerSelector(pathname: string): boolean {
  return !(pathname === '/' || isNavActive('/explainers', pathname));
}
