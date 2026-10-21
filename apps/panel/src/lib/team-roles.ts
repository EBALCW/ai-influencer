import type { TeamRole } from '@ai-influencer/shared';

export function canWriteData(role: TeamRole): boolean {
  return role === 'owner' || role === 'editor';
}

export function canManageTeam(role: TeamRole): boolean {
  return role === 'owner';
}
