import type { NextRequest } from 'next/server';
import { disconnectOAuth } from '@/lib/oauth/disconnect';
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  return disconnectOAuth(request, (await context.params).id);
}
