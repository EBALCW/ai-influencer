// Uyarı türleri (#56). Aynı liste en son migration'daki `alerts_type_known` CHECK
// kısıtında (şu an `20261022220000_weekly_reports.sql`); panel testi iki tarafın
// ayrışmadığını denetler.
export const ALERT_TYPES = [
  'viral_post',
  'follower_milestone',
  'token_expiring',
  'sync_failed',
  'budget_warning',
  'budget_exceeded',
  'content_not_ready',
  'generation_failed',
  'weekly_report_ready',
] as const;

export type AlertType = (typeof ALERT_TYPES)[number];

export function isAlertType(value: string): value is AlertType {
  return (ALERT_TYPES as readonly string[]).includes(value);
}
