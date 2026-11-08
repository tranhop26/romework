export function parseAmount(value) {
  if (typeof value !== 'string' || !/^(0|1)(\.\d{1,6})?$/.test(value)) throw new Error('Use decimal text with at most 6 fractional digits');
  const [whole, fraction = ''] = value.split('.');
  const amount = BigInt(whole) * 1000000n + BigInt(fraction.padEnd(6, '0'));
  if (amount < 1n || amount > 1000000n) throw new Error('G0 amount must be 0 < amount <= 1 test USDC');
  return amount;
}
export function reconcileBalances(before, after, amount) {
  const delta = key => BigInt(after[key]) - BigInt(before[key]);
  const checks = {
    client: delta('client') === -amount, escrow: delta('escrow') === 0n,
    synthetic: delta('synthetic') === 0n, walletAta: delta('walletAta') === amount,
    deposited: BigInt(after.deposited) === amount, locked: BigInt(after.locked) === 0n,
    claimable: BigInt(after.claimable) === 0n, paidOut: BigInt(after.paidOut) === amount,
    conservation: BigInt(after.deposited) === BigInt(after.locked) + BigInt(after.claimable) + BigInt(after.paidOut)
  };
  return { pass: Object.values(checks).every(Boolean), checks, deltas: Object.fromEntries(['client','escrow','synthetic','walletAta'].map(key=>[key,delta(key).toString()])) };
}
export function hasUnresolvedIntent(records) {
  return records.some(x => !['FINALIZED','REVERTED','REJECTED_BEFORE_AUTH','PREAUTH_FAILED','WALLET_MESSAGE_REJECTED'].includes(x.status));
}
export function assertResumeAllowed(records) {
  if (hasUnresolvedIntent(records)) throw new Error('Unresolved intent: reconcile receipt, nonce and state first; do not sign another payload');
}
export function verifyRuntime(expected, actual, references) {
  if (!/^0x[0-9a-f]*$/i.test(actual) || expected.length !== actual.length) return false;
  const left = expected.slice(2).toLowerCase().split(''), right = actual.slice(2).toLowerCase().split('');
  for (const slots of Object.values(references)) for (const { start, length } of slots) for (let i=start*2;i<(start+length)*2;i++) { left[i]='0';right[i]='0'; }
  return left.join('') === right.join('');
}
export function assertEnvironment(expected, actual) {
  for (const key of ['chainId','programId','mint','wrapper','decimals','tokenProgram','genesis']) {
    const normalize = x => key === 'wrapper' ? String(x).toLowerCase() : x;
    if (normalize(expected[key]) !== normalize(actual[key])) throw new Error(`Environment mismatch ${key}: expected ${expected[key]}, received ${actual[key]}`);
  }
}
export function sanitizeEvidence(value) {
  if (Array.isArray(value)) return value.map(sanitizeEvidence);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).filter(([k])=> !/private.?key|secret|seed|authSig|signedTransaction|rawTransaction|authorizationSignature/i.test(k)).map(([k,v])=>[k,sanitizeEvidence(v)]));
  return typeof value === 'bigint' ? value.toString() : value;
}
export function settlementStatus(receipt,statuses,nativeOnly=false) {
  if(!statuses.length||statuses.some(x=>x?.confirmationStatus!=='finalized'))return 'UNKNOWN';
  if(statuses.some(x=>x.err))return 'REVERTED';
  if(nativeOnly)return 'FINALIZED';
  if(receipt?.status==='0x1')return 'FINALIZED';
  if(receipt?.status==='0x0')return 'REVERTED';
  return 'UNKNOWN';
}
