import { NextResponse } from 'next/server';
import hadrian from './hadrian.json';

const allowedEvm = new Set([
  'eth_chainId', 'eth_blockNumber', 'eth_getBalance', 'eth_getCode',
  'eth_getTransactionCount', 'eth_call', 'eth_estimateGas', 'eth_gasPrice',
  'eth_maxPriorityFeePerGas', 'eth_feeHistory', 'eth_getBlockByNumber',
  'eth_getTransactionByHash', 'eth_getTransactionReceipt', 'eth_getLogs',
  'rome_buildInfo', 'rome_isCompatible', 'rome_solanaTxForEvmTx',
  'rome_emulateCallAccounts', 'rome_emulateTx', 'rome_composeUnsignedAtomicV1',
]);
const allowedSolana = new Set([
  'getGenesisHash', 'getAccountInfo', 'getMultipleAccounts', 'getTokenAccountBalance',
  'getBalance', 'getLatestBlockhash', 'getBlockHeight', 'getSignatureStatuses', 'isBlockhashValid',
  'getTransaction', 'getMinimumBalanceForRentExemption', 'getFeeForMessage',
  'getSlot', 'sendTransaction', 'simulateTransaction',
]);

function rpcError(status: number, code: number, message: string, id: unknown = null) {
  return NextResponse.json({ jsonrpc: '2.0', id, error: { code, message } }, { status });
}

export async function proxy(request: Request, lane: 'evm' | 'solana') {
  const origin = request.headers.get('origin');
  const url = new URL(request.url);
  const host = request.headers.get('host') ?? '';
  // Next normalizes the request URL to localhost even when the browser used 127.0.0.1.
  if (!/^(127\.0\.0\.1|localhost)(:\d{1,5})?$/.test(host)) return rpcError(403, -32600, 'Only loopback hosts are allowed');
  if (origin && origin !== `${url.protocol}//${host}`) return rpcError(403, -32600, 'Foreign origin refused');
  const text = await request.text();
  if (text.length > 96_000) return rpcError(413, -32600, 'Request too large');
  let payload;
  try { payload = JSON.parse(text); }
  catch { return rpcError(400, -32700, 'Invalid JSON'); }

  const calls = Array.isArray(payload) ? payload : [payload];
  const allowed = lane === 'evm' ? allowedEvm : allowedSolana;
  if (!calls.length || calls.length > 20 || calls.some(call =>
    !call || call.jsonrpc !== '2.0' || !allowed.has(call.method) || !Array.isArray(call.params ?? []))) {
    return rpcError(400, -32601, 'Method not allowed in Hadrian G0 proxy', payload?.id);
  }

  try {
    const response = await fetch(lane === 'evm' ? hadrian.rpc : hadrian.solanaRpc, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: text, signal: AbortSignal.timeout(25_000), cache: 'no-store',
    });
    return new Response(await response.text(), {
      status: response.status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
    });
  } catch {
    return rpcError(504, -32000, 'Upstream unavailable. Reconcile any signed payload before retrying.', payload?.id);
  }
}
