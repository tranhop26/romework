import {test} from 'node:test';
import assert from 'node:assert/strict';
const base=process.env.ROME_TEST_URL??'http://127.0.0.1:3000';
test('legacy Arc signer and AI endpoints cannot sign or fabricate a chain receipt',async()=>{
  for(const route of ['/api/contracts/mock-accept','/api/contracts/mock-approve','/api/contracts/mock-submit','/api/contracts/mock-dispute','/api/judge','/api/wallet/create']) {
    const response=await fetch(base+route,{method:'POST',headers:{'content-type':'application/json'},body:'{}'});
    const data=await response.json();assert.equal(response.status,410,route);assert.equal(data.code,'ROME_EXTENSION_REQUIRED');assert.equal(data.txHash,undefined);assert.equal(data.signature,undefined);
  }
});
test('Rome proxy refuses server signing, relay and arbitrary methods before forwarding',async()=>{
  for(const method of ['eth_sendTransaction','eth_sendRawTransaction','rome_relayUnsignedV1','wallet_sendCalls','private_exportKey']) {
    const response=await fetch(base+'/rome-rpc',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:3,method,params:[]})});
    assert.equal(response.status,400,method);const data=await response.json();assert.equal(data.error.code,-32601);
  }
});
test('Rome proxy rejects a foreign origin and unbounded batches',async()=>{
  const foreign=await fetch(base+'/rome-rpc',{method:'POST',headers:{'content-type':'application/json',origin:'https://attacker.example'},body:JSON.stringify({jsonrpc:'2.0',id:4,method:'eth_chainId',params:[]})});assert.equal(foreign.status,403);
  const batch=await fetch(base+'/rome-rpc',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(Array.from({length:21},(_,id)=>({jsonrpc:'2.0',id,method:'eth_chainId',params:[]})))});assert.equal(batch.status,400);
});
test('a browser on the app origin reaches the read-only Hadrian proxy',async()=>{
  const response=await fetch(base+'/rome-rpc',{method:'POST',headers:{'content-type':'application/json',origin:new URL(base).origin},body:JSON.stringify({jsonrpc:'2.0',id:5,method:'eth_chainId',params:[]})});
  assert.equal(response.status,200);
  const result=await response.json();
  assert.equal(Number(BigInt(result.result)),200010);
});
test('Hadrian workroom is a native app page with wallet actions, not an iframe to another app',async()=>{
  const response=await fetch(base+'/rome');assert.equal(response.status,200);const html=await response.text();assert.match(html,/Kết nối MetaMask/);assert.match(html,/Kết nối MetaMask Solana/);assert.match(html,/Kết nối OKX Wallet/);assert.match(html,/Hadrian/);assert.doesNotMatch(html,/<iframe|Phantom|Solflare|<select[^>]+id="wallets"/i);
});
