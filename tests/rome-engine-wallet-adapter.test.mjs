import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {build} from 'esbuild';
import {PublicKey} from '@solana/web3.js';
import {failureStatus} from '../lib/rome/recovery.mjs';
import {assertResumeAllowed} from '../lib/rome/safety.mjs';

async function loadLanes(name='default'){
  const output=path.resolve(`../../work/browser-tests/lanes-test-${name}.mjs`);fs.mkdirSync(path.dirname(output),{recursive:true});
  await build({entryPoints:['lib/rome/lanes.ts'],outfile:output,bundle:true,platform:'node',format:'esm',plugins:[{name:'absolute-external-packages',setup(b){b.onResolve({filter:/^[^./]/},args=>({path:import.meta.resolve(args.path),external:true}));}}]});
  globalThis.location={origin:'http://127.0.0.1:5173'};globalThis.window=new EventTarget();
  const store=new Map();globalThis.localStorage={getItem:k=>store.get(k)??null,setItem:(k,v)=>store.set(k,v)};
  return { lanes:await import(pathToFileURL(output)), store };
}

test('MetaMask signing uses an explicit Devnet permission and never falls back to Mainnet',async()=>{
  const {lanes:{connectMetaMaskDevnet}}=await loadLanes('metamask-devnet');
  const scope='solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1';
  const mainnet='solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp';
  const address=new PublicKey(new Uint8Array(32)).toBase58();
  const methods=['signTransaction'];
  let session={sessionScopes:{[mainnet]:{accounts:[`${mainnet}:${address}`],methods}}};
  let allowDevnet=false;
  const calls=[];
  const client={
    getSession:async()=>session,
    createSession:async(params)=>{
      assert.deepEqual(params,{requiredScopes:{[scope]:{methods,notifications:[]}}});
      if(allowDevnet)session.sessionScopes[scope]={accounts:[`${scope}:${address}`],methods};
      return session;
    },
    invokeMethod:async(params)=>{calls.push(params);return {signedTransaction:'AQI='};},
  };
  await assert.rejects(connectMetaMaskDevnet(client,address),/Devnet/);
  allowDevnet=true;
  const wallet=await connectMetaMaskDevnet(client,address);
  const sign=wallet.wallet.features['solana:signTransaction'].signTransaction;
  await assert.rejects(sign({chain:'solana:mainnet',account:wallet.account,transaction:new Uint8Array([3])}),/Devnet/);
  const [signed]=await sign({chain:'solana:devnet',account:wallet.account,transaction:new Uint8Array([3])});
  assert.deepEqual(signed.signedTransaction,new Uint8Array([1,2]));
  delete session.sessionScopes[scope];
  await assert.rejects(sign({chain:'solana:devnet',account:wallet.account,transaction:new Uint8Array([3])}),/Devnet/);
  assert.deepEqual(calls,[{scope,request:{method:'signTransaction',params:{scope,account:{address},transaction:'Aw=='}}}]);
});

test('native v1 ambiguous wallet-sign timeout persists the request and blocks new writes',async()=>{
  const { lanes:{makeV1Signer}, store }=await loadLanes();
  const publicKey=new PublicKey(new Uint8Array(32)),account={address:publicKey.toBase58()};
  let walletRequested=false;const record={id:'native-v1-1',action:'ata',caller:'0x1111111111111111111111111111111111111111',status:'INTENT',nativeOnly:true};
  const session={publicKey,account,version:'test-boundary',wallet:{accounts:[account],features:{'solana:signTransaction':{signTransaction:async()=>{walletRequested=true;throw new Error('wallet transport timeout after request');}}}}};
  await assert.rejects(makeV1Signer(session,record).signV1Wire(new Uint8Array(80)),/wallet transport timeout/);
  assert.equal(walletRequested,true);assert.equal(record.signingRequested,true);
  assert.equal(failureStatus(record,new Error('timeout')),'UNKNOWN');
  const persisted=JSON.parse(store.get('romework-g0-journal-v1'));assert.equal(persisted[0].signingRequested,true);
});

test('recovers the indexed legacy hash only when it maps to the finalized Solana signature',async()=>{
  const caller='0x'+'11'.repeat(20),to='0x'+'22'.repeat(20);
  const payloadHash='0x'+'33'.repeat(32),hash='0x'+'44'.repeat(32);
  const signature='5'.repeat(88),data='0xe4725ba1',blockNumber='0x7b';
  const tx={hash,from:caller,to,input:data,nonce:'0x0',blockNumber};
  const receipt={transactionHash:hash,blockNumber,status:'0x1'};
  const record={id:'legacy-indexed',action:'accept',caller,to,data,hash:payloadHash,payloadHash,signature,nonce:'0',route:'solana-legacy',status:'UNKNOWN'};
  let mapping=[];
  const originalFetch=globalThis.fetch;
  globalThis.fetch=async(input,init)=>{
    const body=JSON.parse(init?.body??await input.text());
    const results={
      eth_getTransactionReceipt:body.params[0]===hash?receipt:null,
      eth_getBlockByNumber:{number:blockNumber,transactions:[{...tx,nonce:'0x1'},tx]},
      eth_getTransactionByHash:tx,
      rome_solanaTxForEvmTx:mapping,
      getSignatureStatuses:{context:{slot:123},value:[{slot:123,confirmationStatus:'finalized',confirmations:null,err:null}]},
    };
    assert.ok(Object.hasOwn(results,body.method),body.method);
    return Response.json({jsonrpc:'2.0',id:body.id,result:results[body.method]});
  };
  try{
    const {lanes:{reconcileRecord}}=await loadLanes('legacy-indexed');
    await reconcileRecord(record);
    assert.equal(record.hash,payloadHash);
    assert.equal(record.status,'UNKNOWN');
    mapping=[signature];
    await reconcileRecord(record);
    assert.equal(record.hash,hash);
    assert.equal(record.payloadHash,payloadHash);
    assert.equal(record.status,'FINALIZED');
    assert.deepEqual(record.receipt,receipt);
  }finally{globalThis.fetch=originalFetch;}
});

test('legacy accept blocked before broadcast stays locked until the old blockhash expires and Hadrian state is unchanged',async()=>{
  const caller='0x1111111111111111111111111111111111111111';
  const contract='0x2222222222222222222222222222222222222222';
  const hash='0x'+'33'.repeat(32);
  const record={id:'accept-recovery',action:'accept',caller,to:contract,contract,hash,payloadHash:hash,nonce:'0',
    route:'solana-legacy',status:'UNKNOWN',signingRequested:true,recentBlockhash:'11111111111111111111111111111111',
    error:'Wallet changed the legacy message; not broadcasting'};
  const fetchOriginal=globalThis.fetch;
  let valid=true, nonce='0x0';
  globalThis.fetch=async(input,init)=>{
    const body=JSON.parse(init?.body??await input.text());
    const responses={
      eth_getTransactionReceipt:null,eth_getTransactionByHash:null,eth_getTransactionCount:nonce,
      eth_call:'0x'+'00'.repeat(32),isBlockhashValid:{context:{slot:123},value:valid},
    };
    assert.ok(Object.hasOwn(responses,body.method),body.method);
    return Response.json({jsonrpc:'2.0',id:body.id,result:responses[body.method]});
  };
  try {
    const { lanes:{reconcileRecord} }=await loadLanes('reconcile');
    await reconcileRecord(record);
    assert.throws(()=>assertResumeAllowed([record]),/Unresolved intent/);
    valid=false;
    nonce='0x1';
    await reconcileRecord(record);
    assert.throws(()=>assertResumeAllowed([record]),/Unresolved intent/);
    nonce='0x0';
    await reconcileRecord(record);
    assert.equal(record.status,'WALLET_MESSAGE_REJECTED');
    assert.equal(record.recovery.blockhashExpired,true);
    assert.doesNotThrow(()=>assertResumeAllowed([record]));
  } finally {globalThis.fetch=fetchOriginal;}
});

test('deploy preflight quotes live fees without opening a wallet and detects a fee increase before signing',async()=>{
  const { lanes:{estimateEvmWrite, evmWrite} }=await loadLanes();
  const from='0x1111111111111111111111111111111111111111';
  const call={from,data:'0x6000'};
  const record={id:'deploy-fee-1',action:'deploy',caller:from,status:'INTENT'};
  const fetchOriginal=globalThis.fetch;
  let gas=20482161n;
  let estimateUnavailable=false;
  const reads=[];
  globalThis.fetch=async(input,init)=>{
    const body=JSON.parse(init?.body??await input.text());
    reads.push(body.method);
    if (estimateUnavailable && body.method==='eth_estimateGas') {
      return Response.json({jsonrpc:'2.0',id:body.id,error:{code:-32000,message:'estimate unavailable'}});
    }
    const responses={
      eth_estimateGas:`0x${gas.toString(16)}`,eth_getBlockByNumber:{baseFeePerGas:'0x27b6a71a60'},
      eth_maxPriorityFeePerGas:'0x0',eth_gasPrice:'0x27b6a71a60',
      eth_getBalance:'0x1bc0b7812dd38000',eth_getTransactionCount:'0x0',
    };
    assert.ok(Object.hasOwn(responses,body.method),body.method);
    return Response.json({jsonrpc:'2.0',id:body.id,result:responses[body.method]});
  };
  try {
    const blocked=await estimateEvmWrite(call);
    assert.equal(blocked.withinCap,true);
    assert.equal(blocked.cap,5n*10n**18n);
    assert.equal(blocked.hasBalance,false);
    assert.ok(blocked.maxFee>4n*10n**18n);
    assert.equal((await estimateEvmWrite({...call,to:from})).withinCap,false);
    gas=21000000n;
    assert.equal((await estimateEvmWrite(call)).withinCap,false);
    gas=100000n;
    const reviewed=await estimateEvmWrite(call);
    assert.equal(reviewed.withinCap,true);
    assert.equal(reviewed.hasBalance,true);
    gas=120000n;
    const provider={request:async({method})=>{
      if(method==='eth_chainId')return '0x30d4a';
      if(method==='eth_accounts')return [from];
      assert.fail(`Unexpected wallet request ${method}`);
    }};
    await assert.rejects(evmWrite(provider,record,call,reviewed.maxFee),/tăng từ lúc xem trước/);
    estimateUnavailable=true;
    await assert.rejects(estimateEvmWrite(call),/chưa ước tính được/);
    await assert.rejects(evmWrite(provider,record,call,reviewed.maxFee),/chưa xác nhận lại được/);
    assert.ok(reads.includes('eth_estimateGas'));
    assert.equal(record.status,'INTENT');
  } finally { globalThis.fetch=fetchOriginal; }
});

test('the higher testnet allowance fee requires opt-in and is limited to the wrapper approval',async()=>{
  const {lanes:{estimateEvmWrite,evmWrite}}=await loadLanes('allowance-fee');
  const from='0x1111111111111111111111111111111111111111';
  const call={from,to:'0xbce339ba4c3a8de3bb8af1c5539e6ac11da3112d',data:'0x095ea7b3'+'00'.repeat(64)};
  const record={id:'allowance-fee',action:'allowance',caller:from,status:'INTENT'};
  const originalFetch=globalThis.fetch;
  let sends=0;
  const provider={request:async({method})=>{
    if(method==='eth_chainId')return '0x30d4a';
    if(method==='eth_accounts')return [from];
    assert.equal(method,'eth_sendTransaction');
    sends++;
    return '0x'+'55'.repeat(32);
  }};
  globalThis.fetch=async(input,init)=>{
    const body=JSON.parse(init?.body??await input.text());
    const results={eth_estimateGas:'0x101ee1',eth_getBlockByNumber:{baseFeePerGas:'0x27b6a71a60'},
      eth_maxPriorityFeePerGas:'0x0',eth_gasPrice:'0x27b6a71a60',eth_getBalance:'0x1bc0b7812dd380000',eth_getTransactionCount:'0x3'};
    assert.ok(Object.hasOwn(results,body.method),body.method);
    return Response.json({jsonrpc:'2.0',id:body.id,result:results[body.method]});
  };
  try{
    const fee=await estimateEvmWrite(call);
    assert.equal(fee.withinCap,false);
    await assert.rejects(evmWrite(provider,record,call,fee.maxFee),/Fee exceeds G0 cap/);
    await assert.rejects(evmWrite(provider,{...record,action:'fund'},call,fee.maxFee,true),/chỉ áp dụng/);
    assert.equal(sends,0);
    await evmWrite(provider,record,call,fee.maxFee,true);
    assert.equal(sends,1);
    const fund={...call,to:from,data:'0xb60d4288'};
    const funding={...record,action:'fund',contract:from,status:'INTENT'};
    await assert.rejects(evmWrite(provider,funding,fund,fee.maxFee),/Fee exceeds G0 cap/);
    await assert.rejects(evmWrite(provider,funding,{...fund,to:call.to},fee.maxFee,true),/chỉ áp dụng/);
    await evmWrite(provider,funding,fund,fee.maxFee,true);
    assert.equal(sends,2);
  }finally{globalThis.fetch=originalFetch;}
});
