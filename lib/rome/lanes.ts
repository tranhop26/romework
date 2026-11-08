import { Transaction, PublicKey } from '@solana/web3.js';
import type { getMultichainClient } from '@metamask/multichain-api-client';
import { submitRomeTx,submitRomeTxSolanaLane,submitRomeTxV1,submitSolanaInstructions,submitSolanaInstructionsV1,sizeSolanaLaneFee,buildUnsignedEip1559Rlp,authHashFor,buildCreatePdaCall,type EvmCall } from '@rome-protocol/sdk';
import { bytesToHex, encodeFunctionData, keccak256, parseAbi, toFunctionSelector, type Address, type Hex } from 'viem';
import { base58 } from '@scure/base';
import { connection,config,rpc } from './network';
import { checkpoint,type RecordEntry } from './journal';
import { settlementStatus } from './safety.mjs';
export type WalletSession={wallet:any;account:any;publicKey:PublicKey;version:string};
const devnetScope='solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1';

export async function connectMetaMaskDevnet(
  client:Pick<ReturnType<typeof getMultichainClient>,'getSession'|'createSession'|'invokeMethod'>,
  expected:string,
):Promise<WalletSession> {
  const authorizedAddress=(session:Awaited<ReturnType<typeof client.getSession>>)=>{
    const scope=session?.sessionScopes[devnetScope];
    if(!scope?.methods.includes('signTransaction'))return undefined;
    const prefix=`${devnetScope}:`;
    return scope.accounts?.find(id=>id.startsWith(prefix)&&(!expected||id===`${prefix}${expected}`))?.slice(prefix.length);
  };
  let address=authorizedAddress(await client.getSession());
  if(!address){
    const session=await client.createSession({requiredScopes:{[devnetScope]:{methods:['signTransaction'],notifications:[]}}});
    address=authorizedAddress(session);
  }
  if(!address)throw new Error('MetaMask chưa cấp quyền ký Solana Devnet cho đúng tài khoản freelancer.');
  const publicKey=new PublicKey(address);
  const account={address,publicKey:publicKey.toBytes(),chains:['solana:devnet']};
  const wallet={name:'MetaMask',accounts:[account],features:{
    'solana:signTransaction':{async signTransaction(input:{account:typeof account;chain:string;transaction:Uint8Array}){
      const current=await client.getSession();
      const scope=current?.sessionScopes[devnetScope];
      if(input.chain!=='solana:devnet'||input.account.address!==account.address||
        !scope?.methods.includes('signTransaction')||!scope.accounts?.some(id=>id===`${devnetScope}:${account.address}`)){
        throw new Error('MetaMask chưa cấp quyền ký Solana Devnet cho đúng tài khoản freelancer.');
      }
      const result=await client.invokeMethod({scope:devnetScope,request:{method:'signTransaction',params:{
        scope:devnetScope,account:{address:account.address},transaction:Buffer.from(input.transaction).toString('base64'),
      }}});
      if(typeof result?.signedTransaction!=='string')throw new Error('MetaMask không trả về giao dịch đã ký.');
      return [{signedTransaction:Uint8Array.from(Buffer.from(result.signedTransaction,'base64'))}];
    }},
  }};
  return {wallet,account,publicKey,version:'CAIP-25'};
}
const feeCap=100000000000000000n; // <=0.1 native TEST USDC per EVM authorization; rent/gas separate from escrow.
export function reviewedActionFeeCap(action:string) {
  if(action==='allowance')return 3n*10n**17n;
  if(action==='fund')return 45n*10n**16n;
  if(action==='claim')return 75n*10n**16n;
  if(action==='provision')return 2n*10n**17n;
}
const deployFeeCap=5n*10n**18n;
const acceptFeeCap=6n*10n**17n;
type EvmWriteCall = { from: Address; to?: Address; data: Hex; value?: bigint };
type EvmFeeFields = { gas: Hex; maxFeePerGas?: Hex; gasPrice?: Hex };
const feeWithinCap = (gas: bigint, price: bigint, cap = feeCap) =>
  gas > 0n && gas <= 250000000n && price >= 0n && gas * price <= cap;

async function evmFeeDetails(tx: EvmFeeFields, call: EvmWriteCall, cap=call.to===undefined?deployFeeCap:feeCap) {
  const [priceHex, balanceHex] = await Promise.all([
    tx.maxFeePerGas ?? tx.gasPrice ?? rpc('eth_gasPrice'),
    rpc('eth_getBalance', [call.from, 'pending']),
  ]);
  const gas = BigInt(tx.gas);
  const price = BigInt(priceHex);
  if (price <= 0n) throw new Error('Hadrian chưa trả về giá gas hợp lệ.');
  const maxFee = gas * price;
  const balance = BigInt(balanceHex);
  return {
    gas, priceHex: priceHex as Hex, maxFee, balance, cap,
    withinCap: feeWithinCap(gas, price, cap),
    hasBalance: balance >= maxFee + (call.value ?? 0n),
  };
}

export async function estimateEvmWrite(call: EvmWriteCall) {
  let feeFields: EvmFeeFields | undefined;
  let estimateFailed = false;
  await submitRomeTx({ async request({method,params}) {
    if (method === 'eth_sendTransaction') {
      feeFields = params?.[0] as EvmFeeFields;
      return null; // Capture the SDK's unsigned request. No wallet provider is used.
    }
    try {
      return await rpc(method,params);
    } catch (error) {
      if (method === 'eth_estimateGas') estimateFailed = true;
      throw error;
    }
  } }, call as Parameters<typeof submitRomeTx>[1]);
  if (!feeFields || estimateFailed) throw new Error('Hadrian chưa ước tính được phí giao dịch. Kiểm tra RPC trước khi ký.');
  return evmFeeDetails(feeFields,call);
}

export async function evmWrite(provider:any,record:RecordEntry,call:EvmWriteCall,reviewedMaxFee?:bigint,feeApproved=false) {
  const approvedCap=feeApproved?reviewedActionFeeCap(record.action):undefined;
  if(feeApproved){
    const destination=call.to?.toLowerCase();
    const isAllowance=record.action==='allowance'&&destination===config.wrapper.toLowerCase()&&call.data.startsWith('0x095ea7b3');
    const isFunding=record.action==='fund'&&!!destination&&destination===record.contract?.toLowerCase()&&call.data===toFunctionSelector('fund()');
    if((!isAllowance&&!isFunding)||(call.value??0n)!==0n||reviewedMaxFee===undefined||approvedCap===undefined||
      reviewedMaxFee>approvedCap)throw new Error('Xác nhận trần phí chỉ áp dụng cho đúng giao dịch vừa xem.');
  }
  const nonce=BigInt(await rpc('eth_getTransactionCount',[call.from,'pending']));checkpoint(record,{nonce:String(nonce)});
  let estimateFailed=false;
  const guarded={request:async({method,params}:any)=>{
    if(method==='eth_sendTransaction') {
      if(reviewedMaxFee!==undefined&&estimateFailed)throw new Error('Hadrian chưa xác nhận lại được phí. Chuẩn bị lại giao dịch.');
      if(Number(BigInt(await provider.request({method:'eth_chainId'})))!==config.chainId)throw new Error('MetaMask wrong network');
      const current=await provider.request({method:'eth_accounts'});if(current[0]?.toLowerCase()!==call.from.toLowerCase())throw new Error('MetaMask account changed');
      const tx={...params[0],nonce:`0x${nonce.toString(16)}`};
      if(tx.from?.toLowerCase()!==call.from.toLowerCase()||tx.to?.toLowerCase()!==call.to?.toLowerCase()||tx.data!==call.data)throw new Error('Unexpected SDK EVM payload');
      const fee=await evmFeeDetails(tx,call,approvedCap);
      if(!fee.withinCap)throw new Error('Fee exceeds G0 cap; inspect before continuing');
      if(!fee.hasBalance)throw new Error('Ví client không đủ USDC gas trên Hadrian.');
      if(reviewedMaxFee!==undefined&&fee.maxFee>reviewedMaxFee)throw new Error('Phí đã tăng từ lúc xem trước. Chuẩn bị lại giao dịch.');
      if(tx.maxFeePerGas===undefined&&tx.gasPrice===undefined)tx.gasPrice=fee.priceHex;
      checkpoint(record,{status:'WALLET_REQUEST',transaction:tx,payloadHash:keccak256(new TextEncoder().encode(JSON.stringify(tx)))});
      const hash=await provider.request({method,params:[tx]});checkpoint(record,{hash,status:'BROADCAST',route:'evm'});return hash;
    }
    try {
      return await rpc(method,params);
    } catch(error) {
      if(method==='eth_estimateGas')estimateFailed=true;
      throw error;
    }
  }};
  // SDK request type requires to; deployment intentionally omits it at runtime (Ethereum CREATE).
  return submitRomeTx(guarded,call as any);
}
function assertWallet(session:WalletSession) {if(!session.wallet.accounts.some((a:any)=>a.address===session.account.address))throw new Error('Solana account disconnected/changed');}
export function makeV1Signer(session:WalletSession,record:RecordEntry) {
  return {payer:session.publicKey,
    signAuthHash:async(message:Uint8Array)=>{assertWallet(session);const feature=session.wallet.features['solana:signMessage'];if(!feature)throw new Error('Wallet has no solana:signMessage');
      checkpoint(record,{authorizationRequested:true});const [result]=await feature.signMessage({account:session.account,message});
      checkpoint(record,{status:'AUTHORIZED',payloadHash:new TextDecoder().decode(message).split('\n')[1]});return result.signature;},
    signV1Wire:async(wire:Uint8Array)=>{assertWallet(session);const feature=session.wallet.features['solana:signTransaction'];if(!feature)throw new Error('Wallet cannot sign Solana transactions');
      checkpoint(record,{signingRequested:true});
      const [result]=await feature.signTransaction({account:session.account,chain:'solana:devnet',transaction:wire});
      const sig=result.signedTransaction.slice(-64);checkpoint(record,{status:'SIGNED',signature:base58.encode(sig),wireBytes:wire.length,signedWireHash:keccak256(result.signedTransaction)});return sig;}
  };
}
function legacySign(session:WalletSession,record:RecordEntry) {
  return async(tx:Transaction)=>{assertWallet(session);const feature=session.wallet.features['solana:signTransaction'];if(!feature)throw new Error('Wallet cannot sign legacy transactions');
    const message=tx.serializeMessage(),wire=tx.serialize({requireAllSignatures:false,verifySignatures:false});checkpoint(record,{signingRequested:true,payloadHash:record.payloadHash??keccak256(message),wireBytes:wire.length,accounts:tx.compileMessage().accountKeys.length,recentBlockhash:tx.recentBlockhash});
    checkpoint(record,{signingRequested:true});const [result]=await feature.signTransaction({account:session.account,chain:'solana:devnet',transaction:wire});
    const signed=Transaction.from(result.signedTransaction);if(!signed.signature)throw new Error('Wallet returned unsigned transaction');
    if(keccak256(signed.serializeMessage())!==keccak256(message))throw new Error('Wallet changed the legacy message; not broadcasting');
    checkpoint(record,{status:'SIGNED',signature:base58.encode(signed.signature),signedWireHash:keccak256(result.signedTransaction)});return signed;
  };
}
export async function estimateSolanaWrite(action:string,from:Hex,call:EvmCall) {
  const fee=await sizeSolanaLaneFee(`${location.origin}/rome-rpc`,{
    from,to:call.to,data:call.data,value:call.value?`0x${call.value.toString(16)}`:undefined,
  },{fallbackGas:250000000n});
  const cap=action==='accept'?acceptFeeCap:feeCap;
  return {fee,cap,maxFee:fee.gasLimit*fee.maxFeePerGas,withinCap:feeWithinCap(fee.gasLimit,fee.maxFeePerGas,cap)};
}
export async function solanaWrite(session:WalletSession,lane:'legacy'|'v1',record:RecordEntry,call:EvmCall&{extraAccounts?:any[]},reviewedFee?:bigint) {
  if(reviewedFee!==undefined){
    const approvedCap=reviewedActionFeeCap(record.action);
    const provision=record.action==='provision'?buildCreatePdaCall(record.caller as Hex):undefined;
    const isClaim=record.action==='claim'&&!!call.to&&call.to.toLowerCase()===record.contract?.toLowerCase()&&call.data===toFunctionSelector('claim()');
    const isProvision=!!provision&&call.to===provision.to&&call.data===provision.data;
    if((!isClaim&&!isProvision)||(call.value??0n)!==0n||approvedCap===undefined||reviewedFee>approvedCap){
      throw new Error('Xác nhận trần phí chỉ áp dụng cho đúng giao dịch Solana vừa xem.');
    }
  }
  const from=record.caller as Hex,nonce=BigInt(await rpc('eth_getTransactionCount',[from,'pending']));
  const {fee,withinCap}=await estimateSolanaWrite(record.action,from,call);
  const allowed=reviewedFee===undefined?withinCap:feeWithinCap(fee.gasLimit,fee.maxFeePerGas,reviewedFee);
  if(!allowed)throw new Error('Phí vượt mức đã xem trước. Kiểm tra lại phí trước khi ký.');
  const rlp=buildUnsignedEip1559Rlp({chainId:config.chainId,nonce,...fee,to:call.to,data:call.data,value:call.value??0n});
  checkpoint(record,{nonce:String(nonce),payloadHash:bytesToHex(authHashFor(rlp)),hash:bytesToHex(authHashFor(rlp)),fee:{gasLimit:String(fee.gasLimit),maxFeePerGas:String(fee.maxFeePerGas),maxPriorityFeePerGas:String(fee.maxPriorityFeePerGas)},route:lane==='legacy'?'solana-legacy':'atomic-v1',relayOnRefusal:false});
  const common={connection,proxyUrl:`${location.origin}/rome-rpc`,programId:config.programId,chainId:config.chainId};
  if(lane==='legacy') {
    const result=await submitRomeTxSolanaLane({...common,payer:session.publicKey,signTransaction:legacySign(session,record)},{...call,nonce,fee,autoProvision:false});checkpoint(record,{signature:result.signature,status:'CONFIRMED'});return result;
  }
  const result=await submitRomeTxV1({...common,signer:makeV1Signer(session,record),receiptTimeoutMs:30000,confirmTimeoutMs:30000},{...call,nonce,fee,relayOnRefusal:false});
  if(result.route!=='atomic')throw new Error('Unexpected relay route; stop and preserve evidence');
  checkpoint(record,{hash:result.hash,signature:result.signature,receipt:result.receipt,status:result.receipt?'CONFIRMED':'UNKNOWN'});return result;
}
export async function nativeInstructions(session:WalletSession,lane:'legacy'|'v1',record:RecordEntry,instructions:any[]) {
  if(lane==='v1')return submitSolanaInstructionsV1(instructions,{connection,signer:makeV1Signer(session,record)});
  return submitSolanaInstructions(instructions,{connection,feePayer:session.publicKey,signTransaction:legacySign(session,record)});
}
export async function reconcileRecord(record:RecordEntry) {
  let receipt=null;
  if(record.hash) receipt=await rpc('eth_getTransactionReceipt',[record.hash]);
  // This exact error is thrown by legacySign before the SDK receives a transaction to broadcast.
  if(receipt===null&&record.status==='UNKNOWN'&&record.action==='accept'&&record.route==='solana-legacy'
    &&record.error==='Wallet changed the legacy message; not broadcasting'
    &&record.signingRequested===true&&!record.signature&&record.hash&&record.hash===record.payloadHash
    &&record.recentBlockhash&&record.nonce!==undefined&&record.to&&record.to.toLowerCase()===record.contract?.toLowerCase()) {
    const [valid,transaction,nonce,state]=await Promise.all([
      rpc('isBlockhashValid',[record.recentBlockhash,{commitment:'finalized'}],'solana-rpc'),
      rpc('eth_getTransactionByHash',[record.hash]),
      rpc('eth_getTransactionCount',[record.caller,'pending']),
      rpc('eth_call',[{to:record.to,data:encodeFunctionData({abi:parseAbi(['function state() view returns (uint8)']),functionName:'state'})},'latest']),
    ]);
    if(valid?.value===false&&Number.isSafeInteger(valid.context?.slot)&&transaction===null&&BigInt(nonce)===BigInt(record.nonce)&&/^0x0{64}$/.test(state)) {
      checkpoint(record,{status:'WALLET_MESSAGE_REJECTED',recovery:{
        blockhashExpired:true,finalizedSolanaSlot:valid.context.slot,transactionAbsent:true,
        pendingNonce:String(BigInt(nonce)),escrowState:'0',checkedAt:new Date().toISOString(),
      },reconciliationError:undefined});
    }
    return record;
  }
  const signature=record.signature;
  const signatureStatus=signature
    ?(await rpc('getSignatureStatuses',[[signature],{searchTransactionHistory:true}],'solana-rpc')).value[0]
    :null;
  // A legacy unsigned Rome payload is indexed under a different EVM hash.
  if(!receipt&&signature&&record.route==='solana-legacy'&&!record.nativeOnly&&record.hash===record.payloadHash&&
    signatureStatus?.confirmationStatus==='finalized'&&signatureStatus.err===null&&Number.isSafeInteger(signatureStatus.slot)&&
    record.nonce!==undefined&&record.to&&record.data){
    const blockNumber=`0x${signatureStatus.slot.toString(16)}`;
    const block=await rpc('eth_getBlockByNumber',[blockNumber,true]);
    const candidates=(block?.transactions??[]).filter((tx:any)=>
      tx.blockNumber===blockNumber&&tx.from?.toLowerCase()===record.caller.toLowerCase()&&
      tx.to?.toLowerCase()===record.to?.toLowerCase()&&(tx.input??tx.data)===record.data&&
      typeof tx.nonce==='string'&&BigInt(tx.nonce)===BigInt(record.nonce!));
    if(candidates.length===1){
      const hash=candidates[0].hash;
      const mapping=await rpc('rome_solanaTxForEvmTx',[hash]);
      if(Array.isArray(mapping)&&mapping.includes(signature)){
        const indexedReceipt=await rpc('eth_getTransactionReceipt',[hash]);
        if(indexedReceipt?.transactionHash===hash&&indexedReceipt.blockNumber===blockNumber){
          receipt=indexedReceipt;
          checkpoint(record,{hash,settlementMapping:mapping});
        }
      }
    }
  }
  if(receipt) {
    const tx=await rpc('eth_getTransactionByHash',[record.hash]);
    if(!tx||tx.from?.toLowerCase()!==record.caller.toLowerCase()||(record.to&&tx.to?.toLowerCase()!==record.to.toLowerCase())||(record.data&&tx.input!==record.data&&tx.data!==record.data))throw new Error('Receipt does not match intended sender/destination/data');
    checkpoint(record,{receipt,transaction:tx,status:'CONFIRMED'});
    if(!record.signature) {try{checkpoint(record,{settlementMapping:await rpc('rome_solanaTxForEvmTx',[record.hash])});}catch{}}
  }
  // Solana finality is explicit. EVM receipt alone does not clear an UNKNOWN write.
  if(signature) {
    checkpoint(record,{solanaStatus:signatureStatus,status:settlementStatus(receipt,[signatureStatus],record.nativeOnly)});
  } else if(receipt && record.settlementMapping) {
    const signatures=JSON.stringify(record.settlementMapping).match(/[1-9A-HJ-NP-Za-km-z]{87,88}/g)??[];
    if(signatures.length) {
      const statuses=(await connection.getSignatureStatuses([...new Set(signatures)],{searchTransactionHistory:true})).value;
      checkpoint(record,{settlementStatuses:statuses,status:settlementStatus(receipt,statuses)});
    }
  }
  return record;
}
