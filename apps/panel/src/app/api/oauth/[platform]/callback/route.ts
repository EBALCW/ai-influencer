import type { NextRequest } from 'next/server';
import { callbackOAuth } from '@/lib/oauth/routes';
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ platform: string }> },
) {
  return callbackOAuth(request, (await context.params).platform);
}
