// shortenAddress copied from tranhop26/freelanceguard, lib/utils/format.ts,
// commit 1b7f8df1cc71b124e273f1e8f0a2775106eea234. See THIRD_PARTY_NOTICES.md.
export function shortenAddress(address) {
  if (!address) return '';
  if (address.length <= 10) return address;
  return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
}
// Adapted token display: original formatUsdc converted through Number; this
// harness preserves base units with bigint/string only and exposes all 6 places.
export function formatTokenUnits(amount) {
  if(typeof amount==='number'||!/^[0-9]+$/.test(String(amount)))throw new Error('Use bigint or integer base-unit text');
  const n=BigInt(amount),whole=n/1000000n,fraction=(n%1000000n).toString().padStart(6,'0').replace(/0+$/,'');
  return `${whole}.${fraction.padEnd(2,'0')}`;
}
// Workroom status pattern adapted for G0: approval does not mean release.
export function workroomView(state,swept=false) {
  if(state===null||state===undefined)return {label:'Chưa deploy · NOT RUN',next:'deploy',step:-1};
  const views=[['Chờ freelancer chấp thuận','accept'],['Đã chấp thuận · Chờ nạp','fund'],['Đã ký quỹ · Chờ bàn giao','delivery'],['Đã bàn giao · Chờ duyệt','approve'],['Đã duyệt · Chờ claim','claim'],['Đã claim · Chờ sweep','sweep']];
  if(state===5&&swept)return {label:'Sweep finalized · Đối chiếu số dư',next:'reconcile',step:6};
  if(!Number.isInteger(state)||state<0||state>=views.length)throw new Error('Unknown escrow state');
  return {label:views[state][0],next:views[state][1],step:state};
}

export function guidedStage({hasContract,state,swept=false,unresolved=false}) {
  if (unresolved) return 'recover';
  if (!hasContract) return 'deploy';
  if (state===null || state===undefined) return 'read';
  return workroomView(state,swept).next;
}

export function fundingStep({client,amount,grant,allowance,hasBaseline}) {
  if(BigInt(client)<BigInt(amount))return 'wrap';
  if(!grant)return 'grant';
  if(BigInt(allowance)!==BigInt(amount))return 'allowance';
  return hasBaseline?'fund':'baseline';
}

export function findDevnetWallet(wallets,name) {
  if(name!=='MetaMask'&&name!=='OKX Wallet')return undefined;
  return wallets.find(wallet =>
    wallet.name === name &&
    wallet.chains.includes('solana:devnet') &&
    typeof wallet.features['standard:connect']?.connect === 'function' &&
    typeof wallet.features['solana:signTransaction']?.signTransaction === 'function' &&
    wallet.features['solana:signTransaction'].supportedTransactionVersions?.includes('legacy')
  );
}
