import { apiError, parseJson, requireApiRole } from '@/lib/auth-api';
import { saveContent } from '@/lib/content/api';
import { contentSchema } from '@/lib/content/schemas';

export async function POST(request: Request) {
  const auth = await requireApiRole('editor');
  if (!auth.ok) return auth.response;
  const parsed = await parseJson(request, contentSchema);
  if (!parsed.ok) return parsed.response;
  try {
    return await saveContent(null, parsed.data);
  } catch (error) {
    return apiError(error);
  }
}
