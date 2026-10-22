import { describe, expect, it } from 'vitest';
import {
  defaultNotificationSettings,
  notificationSettingsSchema,
  parseMilestones,
  settingsFromRow,
  settingsToRow,
} from './settings-schema';

const valid = {
  viralMultiplier: 3.5,
  followerMilestones: [5000, 1000, 5000],
  tokenExpiryDays: 7,
  channels: { ntfy: true, telegram: false, email: false },
};

describe('notificationSettingsSchema', () => {
  it('kilometre taşlarını sıralar ve tekrarı atar', () => {
    const parsed = notificationSettingsSchema.parse(valid);
    expect(parsed.followerMilestones).toEqual([1000, 5000]);
  });

  it.each([
    ['çarpan çok düşük', { viralMultiplier: 1 }],
    ['çarpan 2 ondalıktan fazla', { viralMultiplier: 3.333 }],
    ['gün 0', { tokenExpiryDays: 0 }],
    ['gün 61', { tokenExpiryDays: 61 }],
    ['boş kilometre taşı', { followerMilestones: [] }],
    ['negatif kilometre taşı', { followerMilestones: [-1] }],
    [
      '21 kilometre taşı',
      { followerMilestones: Array.from({ length: 21 }, (_, i) => i + 1) },
    ],
    ['kanal eksik', { channels: { ntfy: true } }],
  ])('%s reddedilir', (_name, patch) => {
    expect(
      notificationSettingsSchema.safeParse({ ...valid, ...patch }).success,
    ).toBe(false);
  });
});

describe('satır eşlemesi', () => {
  it('yalnız ayar kolonlarını yazar (audit alanı yok)', () => {
    const row = settingsToRow(notificationSettingsSchema.parse(valid));
    expect(Object.keys(row).sort()).toEqual([
      'follower_milestones',
      'push_email',
      'push_ntfy',
      'push_telegram',
      'token_expiry_days',
      'viral_multiplier',
    ]);
  });

  it('satır yoksa varsayılanlar, numeric string sayıya çevrilir', () => {
    expect(settingsFromRow(null)).toEqual(defaultNotificationSettings);
    expect(
      settingsFromRow({
        id: true,
        viral_multiplier: '4.50' as unknown as number,
        follower_milestones: [1000],
        token_expiry_days: 3,
        push_ntfy: false,
        push_telegram: true,
        push_email: false,
        created_at: '',
        updated_at: '',
        created_by: null,
      }),
    ).toEqual({
      viralMultiplier: 4.5,
      followerMilestones: [1000],
      tokenExpiryDays: 3,
      channels: { ntfy: false, telegram: true, email: false },
    });
  });
});

describe('parseMilestones', () => {
  it('virgül, boşluk ve binlik noktayı kabul eder', () => {
    expect(parseMilestones('1.000, 5000 10000')).toEqual([1000, 5000, 10000]);
  });
  it('geçersiz parça veya boş girdi null döner', () => {
    expect(parseMilestones('1000, on bin')).toBeNull();
    expect(parseMilestones('  ')).toBeNull();
  });
});
