import { z } from 'zod';
import type { Row, Update } from '@ai-influencer/shared';

/** Bildirim eşikleri ve kanal seçimi. Sınırlar migration'daki CHECK kısıtlarıyla aynı. */
export const notificationSettingsSchema = z.object({
  viralMultiplier: z
    .number()
    .min(1.5)
    .max(100)
    .refine((value) => Math.round(value * 100) === value * 100, {
      message: 'En fazla iki ondalık',
    }),
  followerMilestones: z
    .array(z.number().int().positive().max(2_000_000_000))
    .min(1)
    .max(20)
    .transform((values) => [...new Set(values)].sort((a, b) => a - b)),
  tokenExpiryDays: z.number().int().min(1).max(60),
  channels: z.object({
    ntfy: z.boolean(),
    telegram: z.boolean(),
    email: z.boolean(),
  }),
});

export type NotificationSettings = z.output<typeof notificationSettingsSchema>;

export const defaultNotificationSettings: NotificationSettings = {
  viralMultiplier: 3,
  followerMilestones: [
    1000, 5000, 10000, 25000, 50000, 100000, 250000, 500000, 1000000,
  ],
  tokenExpiryDays: 7,
  channels: { ntfy: false, telegram: false, email: false },
};

export function settingsFromRow(
  row: Row<'notification_settings'> | null,
): NotificationSettings {
  if (!row) return defaultNotificationSettings;
  return {
    viralMultiplier: Number(row.viral_multiplier),
    followerMilestones: row.follower_milestones,
    tokenExpiryDays: row.token_expiry_days,
    channels: {
      ntfy: row.push_ntfy,
      telegram: row.push_telegram,
      email: row.push_email,
    },
  };
}

/** Sadece ayar kolonları yazılır; sahiplik/audit alanları istemciden alınmaz. */
export function settingsToRow(
  settings: NotificationSettings,
): Update<'notification_settings'> {
  return {
    viral_multiplier: settings.viralMultiplier,
    follower_milestones: settings.followerMilestones,
    token_expiry_days: settings.tokenExpiryDays,
    push_ntfy: settings.channels.ntfy,
    push_telegram: settings.channels.telegram,
    push_email: settings.channels.email,
  };
}

/** "1000, 5.000 10000" gibi girdiyi sayı listesine çevirir; geçersiz parça varsa null. */
export function parseMilestones(text: string): number[] | null {
  const parts = text
    .split(/[\s,;]+/)
    .map((part) => part.replace(/\./g, ''))
    .filter(Boolean);
  if (parts.length === 0) return null;
  const values = parts.map((part) => (/^\d+$/.test(part) ? Number(part) : NaN));
  return values.every(Number.isSafeInteger) ? values : null;
}
