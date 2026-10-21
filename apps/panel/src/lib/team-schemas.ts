import { z } from 'zod';

export const teamRoleSchema = z.enum(['owner', 'editor', 'viewer']);

export const inviteSchema = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email()),
  role: teamRoleSchema,
});

export const roleUpdateSchema = z.object({ role: teamRoleSchema });

export const userIdSchema = z.uuid();
