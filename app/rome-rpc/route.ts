import { proxy } from '@/lib/rome/proxy';
export const runtime = 'nodejs';
export async function POST(request: Request) { return proxy(request, 'evm'); }
