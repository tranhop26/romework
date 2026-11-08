import { NextResponse } from 'next/server';

export function extensionRequired() {
  return NextResponse.json({
    code: 'ROME_EXTENSION_REQUIRED',
    message: 'Open /rome to use the Hadrian workroom with your wallet.',
    workroom: '/rome',
    chainId: 200010,
    chainSettlement: false,
  }, { status: 410 });
}
