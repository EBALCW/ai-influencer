import { z } from 'zod';

/** Çalışma alanı adı: veritabanındaki CHECK ile aynı sınır (kırpılmış 1-80 karakter). */
export const workspaceNameSchema = z.string().trim().min(1).max(80);

export const workspaceUpdateSchema = z.object({ name: workspaceNameSchema });
