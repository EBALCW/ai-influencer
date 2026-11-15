import { describe, expect, it } from 'vitest';
import { MODULES } from '@ai-influencer/shared';
import {
  MODULE_HREFS,
  MODULE_LABELS,
  NAV_GROUPS,
  activeNavItem,
  isNavActive,
  isParkedModule,
  pageName,
  showsInfluencerSelector,
} from './navigation';

const items = NAV_GROUPS.flatMap((group) => group.items);

describe('panel gezinmesi (#200)', () => {
  it('mevcut adreslerin hepsi menüde kalır', () => {
    const hrefs = items.map((item) => item.href);
    for (const href of [
      '/',
      '/influencers',
      '/prompts',
      '/research',
      '/clips',
      '/content',
      '/calendar',
      '/inbox',
      '/analytics',
      '/production',
      '/costs',
      '/brands',
      '/settings',
    ])
      expect(hrefs).toContain(href);
    expect(new Set(hrefs).size).toBe(hrefs.length);
  });

  it('her modül menüde üst düzey bölümdür ve park edilen işaretlidir', () => {
    for (const moduleId of MODULES) {
      const item = items.find((entry) => entry.href === MODULE_HREFS[moduleId]);
      expect(item?.label).toBe(MODULE_LABELS[moduleId]);
      expect(item?.child).toBeUndefined();
      expect(Boolean(item?.parked)).toBe(isParkedModule(moduleId));
    }
    expect(isParkedModule('influencer')).toBe(true);
    expect(isParkedModule('explainer')).toBe(false);
  });

  it('etkin öğe adres önekine değil yol parçasına bakar', () => {
    expect(isNavActive('/', '/')).toBe(true);
    expect(isNavActive('/', '/clips')).toBe(false);
    expect(isNavActive('/clips', '/clips')).toBe(true);
    expect(isNavActive('/clips', '/clipsy')).toBe(false);
    expect(activeNavItem('/explainers/series/abc')?.href).toBe('/explainers');
    expect(activeNavItem('/influencers/overview')?.href).toBe('/influencers');
    expect(activeNavItem('/bilinmeyen')).toBeNull();
  });

  it('sayfa adı menüden gelir', () => {
    expect(pageName('/')).toBe('Ana ekran');
    expect(pageName('/notifications')).toBe('Bildirimler');
    expect(pageName('/settings/team')).toBe('Ayarlar');
    expect(pageName('/explainers')).toBe('Anlatım videoları');
  });

  it('influencer seçici karakter istemeyen sayfalarda gizlenir', () => {
    expect(showsInfluencerSelector('/')).toBe(false);
    expect(showsInfluencerSelector('/explainers/episodes/x')).toBe(false);
    expect(showsInfluencerSelector('/influencers')).toBe(true);
    expect(showsInfluencerSelector('/content')).toBe(true);
    expect(showsInfluencerSelector('/clips')).toBe(true);
  });
});
