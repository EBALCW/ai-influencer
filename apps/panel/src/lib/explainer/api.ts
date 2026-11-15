import 'server-only';
import { revalidatePath } from 'next/cache';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { mapExplainerError, type DbError } from './errors';

/**
 * Veritabanı hatasını HTTP yanıtına çevirir. Gövde: `{ error, code? }`; `code` istemcinin özel
 * davranış gösterdiği durumlardır (`version_conflict`, `fact_gaps`). Ham SQL mesajı gitmez.
 */
export function explainerDbError(error: DbError) {
  const mapped = mapExplainerError(error);
  if (mapped.status >= 500)
    console.error('[explainers]', error.code ?? 'bilinmeyen hata kodu');
  return NextResponse.json(
    { error: mapped.message, ...(mapped.code ? { code: mapped.code } : {}) },
    { status: mapped.status },
  );
}

const idSchema = z.uuid();

/** Yol parametresindeki kimlik; uuid değilse `null` (çağıran 404 döner). */
export function parseId(value: string): string | null {
  const parsed = idSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

export function refreshExplainers() {
  revalidatePath('/explainers', 'layout');
  revalidatePath('/');
}
