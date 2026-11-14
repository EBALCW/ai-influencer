export function getPanelGreeting(): string {
  return 'Ekip çalışma alanı';
}

export type * from './database.js';
export { Constants } from './database';
export type { AlertType } from './alerts.js';
export { ALERT_TYPES, isAlertType } from './alerts';
export type { WorkerCapability } from './capabilities.js';
export {
  WORKER_CAPABILITIES,
  WORKER_CAPABILITY_LABELS,
  isWorkerCapability,
} from './capabilities';
export type {
  JobAssetRole,
  JobKind,
  JobStageDefinition,
  JobStageStatus,
  JobStatus,
  ModuleId,
  WorkerPlatform,
} from './jobs.js';
export {
  JOB_ASSET_ROLES,
  JOB_KINDS,
  JOB_STAGE_STATUSES,
  JOB_STATUSES,
  JOB_TRANSITIONS,
  MODULES,
  PARKED_MODULES,
  TERMINAL_JOB_STATUSES,
  WORKER_OFFLINE_AFTER_SECONDS,
  WORKER_PLATFORMS,
  canCancelJob,
  canRetryJob,
  canTransitionJob,
  isJobKind,
  isJobStatus,
  isModuleId,
  isTerminalJobStatus,
  jobStageKeys,
} from './jobs';
