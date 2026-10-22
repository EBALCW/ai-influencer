// Uyarı türleri (#56). Aynı liste `supabase/migrations/20261022210000_notifications.sql`
// içindeki `alerts_type_known` CHECK kısıtında; panel testi iki tarafın ayrışmadığını denetler.
export const ALERT_TYPES = [
  'viral_post',
  'follower_milestone',
  'token_expiring',
  'sync_failed',
  'budget_warning',
  'budget_exceeded',
  'content_not_ready',
  'generation_failed',
] as const;

export type AlertType = (typeof ALERT_TYPES)[number];

export function isAlertType(value: string): value is AlertType {
  return (ALERT_TYPES as readonly string[]).includes(value);
}
