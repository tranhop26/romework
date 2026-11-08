import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as workroom from '../lib/rome/workroom.mjs';
const {shortenAddress,formatTokenUnits,guidedStage,workroomView,findDevnetWallet,fundingStep}=workroom;
test('funding exposes the first unmet prerequisite using the verified balances and permissions',()=>{
  const ready={client:'100000',amount:'100000',grant:true,allowance:'100000',hasBaseline:true};
  assert.equal(fundingStep({...ready,client:'99999',grant:false}),'wrap');
  assert.equal(fundingStep({...ready,grant:false}),'grant');
  assert.equal(fundingStep({...ready,allowance:'100001'}),'allowance');
  assert.equal(fundingStep({...ready,hasBaseline:false}),'baseline');
  assert.equal(fundingStep(ready),'fund');
});
test('selects the requested supported brand with a Devnet signer',()=>{
  const features={'standard:connect':{connect(){}},'solana:signTransaction':{signTransaction(){},supportedTransactionVersions:['legacy']}};
  const phantom={name:'Phantom',chains:['solana:devnet'],features};
  const mainnetOkx={name:'OKX Wallet',chains:['solana:mainnet'],features};
  const devnetOkx={...mainnetOkx,chains:['solana:devnet']};
  const devnetMetaMask={...devnetOkx,name:'MetaMask'};
  assert.equal(findDevnetWallet([phantom,mainnetOkx,devnetMetaMask],'OKX Wallet'),undefined);
  assert.equal(findDevnetWallet([phantom,{...devnetOkx,features:{}}],'OKX Wallet'),undefined);
  assert.equal(findDevnetWallet([phantom,devnetMetaMask,mainnetOkx,devnetOkx],'OKX Wallet'),devnetOkx);
  assert.equal(findDevnetWallet([phantom,devnetOkx,devnetMetaMask],'MetaMask'),devnetMetaMask);
  assert.equal(findDevnetWallet([phantom,devnetOkx],'MetaMask'),undefined);
  assert.equal(findDevnetWallet([phantom],'Phantom'),undefined);
});
test('reference address helper preserves short text and shortens display without touching actual address',()=>{
  assert.equal(shortenAddress(null),'');assert.equal(shortenAddress('0x123'),'0x123');assert.equal(shortenAddress('0x1234567890123456789012345678901234567890'),'0x1234...7890');
});
test('the guided flow prioritizes recovery and requires a fresh read before suggesting a contract action',()=>{
  assert.equal(guidedStage({hasContract:false,state:null,unresolved:true}),'recover');
  assert.equal(guidedStage({hasContract:true,state:4,unresolved:true}),'recover');
  assert.equal(guidedStage({hasContract:true,state:null}),'read');
  assert.equal(guidedStage({hasContract:false,state:null}),'deploy');
  assert.equal(guidedStage({hasContract:true,state:0}),'accept');
  assert.equal(guidedStage({hasContract:true,state:5}),'sweep');
  assert.equal(guidedStage({hasContract:true,state:5,swept:true}),'reconcile');
});
test('workroom token display preserves six-decimal base units and integers above Number safe range',()=>{
  assert.equal(formatTokenUnits(1000000n),'1.00');assert.equal(formatTokenUnits(1n),'0.000001');
  assert.equal(formatTokenUnits(900719925474099312345678n),'900719925474099312.345678');
  assert.throws(()=>formatTokenUnits('1.2'));
});
test('approved workroom never says paid or wallet received, claim still requires sweep',()=>{
  assert.deepEqual(workroomView(4,false),{label:'Đã duyệt · Chờ claim',next:'claim',step:4});
  assert.deepEqual(workroomView(5,false),{label:'Đã claim · Chờ sweep',next:'sweep',step:5});
  assert.deepEqual(workroomView(5,true),{label:'Sweep finalized · Đối chiếu số dư',next:'reconcile',step:6});
  assert.equal(workroomView(null,false).label,'Chưa deploy · NOT RUN');
});
