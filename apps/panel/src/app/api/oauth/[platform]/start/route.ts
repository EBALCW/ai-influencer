import type { NextRequest } from 'next/server';
import { startOAuth } from '@/lib/oauth/routes';
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ platform: string }> },
) {
  return startOAuth(request, (await context.params).platform);
}
