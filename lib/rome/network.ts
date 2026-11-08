import { Connection, PublicKey } from '@solana/web3.js';
import { getAssociatedTokenAddressSync, TOKEN_PROGRAM_ID } from '@solana/spl-token';
import { createPublicClient, http, parseAbi, keccak256, type Address, type Hex } from 'viem';
import { deriveAuthorityPda, PRECOMPILE_ADDRESSES } from '@rome-protocol/sdk';
import config from './hadrian.json';
import { assertEnvironment, verifyRuntime } from './safety.mjs';
export { config };
export const chain={id:config.chainId,name:'Rome Hadrian TESTNET',nativeCurrency:{name:'Test USDC gas',symbol:'USDC',decimals:18},rpcUrls:{default:{http:[`${location.origin}/rome-rpc`]}}} as const;
export const publicClient=createPublicClient({chain,transport:http('/rome-rpc',{retryCount:0,timeout:25000})});
export const connection=new Connection(`${location.origin}/solana-rpc`,{commitment:'confirmed',disableRetryOnRateLimit:true});
export const tokenAbi=parseAbi(['function decimals() view returns(uint8)','function mint_id() view returns(bytes32)','function balanceOf(address) view returns(uint256)','function allowance(address,address) view returns(uint256)','function approve(address,uint256) returns(bool)','function isEnabled(address) view returns(bool)']);
export const helperAbi=parseAbi(['function approve_spl(address,uint64,bytes32)','function withdraw_to_ata(uint256)']);
export async function rpc(method:string,params:unknown[]=[],lane:'rome-rpc'|'solana-rpc'='rome-rpc') {
  const response=await fetch(`/${lane}`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:1,method,params}),signal:AbortSignal.timeout(25000)});
  if(!response.ok) throw new Error(`RPC HTTP ${response.status}`); const body=await response.json();if(body.error)throw new Error(JSON.stringify(body.error));return body.result;
}
export async function preflight() {
  const [chainId,genesis,code,decimals,mintHex,mintInfo,program,proxyProgram,compatible]=await Promise.all([
    publicClient.getChainId(),connection.getGenesisHash(),publicClient.getCode({address:config.wrapper as Address}),
    publicClient.readContract({address:config.wrapper as Address,abi:tokenAbi,functionName:'decimals'}),
    publicClient.readContract({address:config.wrapper as Address,abi:tokenAbi,functionName:'mint_id'}),
    connection.getParsedAccountInfo(new PublicKey(config.mint),'finalized'),connection.getAccountInfo(new PublicKey(config.programId),'finalized'),
    publicClient.readContract({address:PRECOMPILE_ADDRESSES.system,abi:parseAbi(['function rome_evm_program_id() view returns(bytes32)']),functionName:'rome_evm_program_id'}),rpc('rome_isCompatible')
  ]);
  if(!code||code==='0x'||!mintInfo.value||!program?.executable||compatible!==true)throw new Error('Missing wrapper/mint/program or incompatible proxy');
  const observed={chainId,genesis,wrapper:config.wrapper,decimals:Number(decimals),mint:new PublicKey(Buffer.from(mintHex.slice(2),'hex')).toBase58(),programId:new PublicKey(Buffer.from(proxyProgram.slice(2),'hex')).toBase58(),tokenProgram:mintInfo.value.owner.toBase58()};
  assertEnvironment(config,observed);
  if(keccak256(code)!==(config as any).wrapperCodeHash)throw new Error('Wrapper code fingerprint changed since saved preflight');
  const currentTokens=await (await fetch('https://raw.githubusercontent.com/rome-protocol/rome-registry/main/chains/200010-hadrian/tokens.json',{signal:AbortSignal.timeout(25000)})).json();
  const current=currentTokens.find((t:any)=>t.kind==='spl_wrapper'&&t.symbol==='wUSDC');
  if(!current||current.address.toLowerCase()!==config.wrapper.toLowerCase()||current.mintId!==config.mint)throw new Error('Current canonical wrapper differs from pinned configuration');
  if(!('parsed' in mintInfo.value.data)||mintInfo.value.data.parsed.info.decimals!==6)throw new Error('Invalid SPL mint');
  return {observed,wrapperCodeHash:keccak256(code),mintSlot:mintInfo.context.slot,checkedAt:new Date().toISOString(),compatible};
}
export function accounts(wallet:PublicKey,synthetic:Hex) {
  const mint=new PublicKey(config.mint),programId=new PublicKey(config.programId),authority=deriveAuthorityPda(synthetic,programId);
  return {mint,programId,authority,syntheticAta:getAssociatedTokenAddressSync(mint,authority,true,TOKEN_PROGRAM_ID),walletAta:getAssociatedTokenAddressSync(mint,wallet,true,TOKEN_PROGRAM_ID)};
}
export async function verifyDeployment(address:Address,artifact:any,expected:{client:Address;freelancer:Address;amount:bigint;termsHash:Hex}) {
  const code=await publicClient.getCode({address});
  if(!code||!verifyRuntime(artifact.deployedBytecode,code,artifact.immutableReferences))throw new Error('Escrow runtime does not match locally compiled G0');
  const read=async(name:string)=>publicClient.readContract({address,abi:artifact.abi,functionName:name,args:[]} as any);
  const [token,client,freelancer,amount,termsHash]=await Promise.all(['token','client','freelancer','amount','termsHash'].map(read));
  if(String(token).toLowerCase()!==config.wrapper.toLowerCase()||String(client).toLowerCase()!==expected.client.toLowerCase()||String(freelancer).toLowerCase()!==expected.freelancer.toLowerCase()||BigInt(amount as bigint)!==expected.amount||termsHash!==expected.termsHash)throw new Error('Escrow immutable constructor roles/token/amount/hash mismatch');
  return {runtimeCodeHash:keccak256(code),token,client,freelancer,amount:String(amount),termsHash};
}
