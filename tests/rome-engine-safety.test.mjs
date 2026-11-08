import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseAmount, reconcileBalances, assertResumeAllowed, verifyRuntime, assertEnvironment, sanitizeEvidence, settlementStatus } from '../lib/rome/safety.mjs';

test('amount parser rejects floats, precision loss and more than one test USDC', () => {
  assert.equal(parseAmount('0.000001'), 1n); assert.equal(parseAmount('1'), 1000000n);
  for (const value of ['0', '-1', '1.000001', '0.0000001', '1e-6', 'NaN', '0x1', 'Infinity']) assert.throws(() => parseAmount(value));
});
test('reconciliation uses independent baseline deltas and conservation', () => {
  const baseline = { client: '2000000', escrow: '7', synthetic: '20', walletAta: '100', deposited:'0',locked:'0',claimable:'0',paidOut:'0' };
  const final = { client:'1000000',escrow:'7',synthetic:'20',walletAta:'1000100',deposited:'1000000',locked:'0',claimable:'0',paidOut:'1000000' };
  assert.equal(reconcileBalances(baseline, final, 1000000n).pass, true);
  assert.equal(reconcileBalances(baseline,{...final,walletAta:'100'},1000000n).pass,false);
  assert.equal(reconcileBalances(baseline,{...final,claimable:'1'},1000000n).pass,false);
});
test('UNKNOWN or outstanding authorization blocks new writes even after nonce changed', () => {
  assert.throws(() => assertResumeAllowed([{ status: 'UNKNOWN', nonce: '2' }]));
  assert.throws(() => assertResumeAllowed([{ status: 'AUTHORIZED', nonce: '2' }]));
  assert.doesNotThrow(() => assertResumeAllowed([{ status:'REVERTED' },{status:'FINALIZED'}]));
});
test('runtime verification permits only compiler-declared immutable substitutions', () => {
  assert.equal(verifyRuntime('0x600012346001','0x6000abcd6001',{a:[{start:2,length:2}]}),true);
  assert.equal(verifyRuntime('0x600012346001','0x6100abcd6001',{a:[{start:2,length:2}]}),false);
  assert.equal(verifyRuntime('0x60','0x6000',{}),false);
});
test('environment rejects mainnet, unexpected program and mint discrepancies', () => {
  const wanted={chainId:200010,programId:'p',mint:'m',wrapper:'0xA',decimals:6,tokenProgram:'t',genesis:'devnet'};
  assert.doesNotThrow(()=>assertEnvironment(wanted,{...wanted,wrapper:'0xa'}));
  for(const patch of [{chainId:7531},{programId:'wrong'},{mint:'wrong'},{genesis:'mainnet'},{decimals:18}]) assert.throws(()=>assertEnvironment(wanted,{...wanted,...patch}));
});
test('public evidence removes authorization material and secret field names', () => {
  assert.deepEqual(sanitizeEvidence({signature:'public-tx-id',authSig:'sensitive',privateKey:'secret',nested:{seed:'secret',payloadHash:'0x12'}}),{signature:'public-tx-id',nested:{payloadHash:'0x12'}});
});
test('receipt revert or confirmation alone never unlocks a new write before finalized settlement',()=>{
  assert.equal(settlementStatus({status:'0x0'},[{confirmationStatus:'confirmed',err:null}]),'UNKNOWN');
  assert.equal(settlementStatus({status:'0x1'},[]),'UNKNOWN');
  assert.equal(settlementStatus({status:'0x1'},[{confirmationStatus:'finalized',err:null}]),'FINALIZED');
  assert.equal(settlementStatus({status:'0x0'},[{confirmationStatus:'finalized',err:null}]),'REVERTED');
  assert.equal(settlementStatus(null,[{confirmationStatus:'finalized',err:null}]),'UNKNOWN');
  assert.equal(settlementStatus(null,[{confirmationStatus:'finalized',err:null}],true),'FINALIZED');
  assert.equal(settlementStatus(null,[{confirmationStatus:'finalized',err:{InstructionError:1}}]),'REVERTED');
});
