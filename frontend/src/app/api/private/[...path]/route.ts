import { NextRequest } from 'next/server';
import { sessionGateway } from '@/lib/sessionGateway';

export const dynamic = 'force-dynamic';
async function handle(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  return sessionGateway(request, (await context.params).path.join('/'));
}
export { handle as GET, handle as POST, handle as PATCH, handle as PUT, handle as DELETE };
