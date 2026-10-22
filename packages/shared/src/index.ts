export function getPanelGreeting(): string {
  return 'Ekip çalışma alanı';
}

export type * from './database.js';
export { Constants } from './database';
export type { AlertType } from './alerts.js';
export { ALERT_TYPES, isAlertType } from './alerts';
