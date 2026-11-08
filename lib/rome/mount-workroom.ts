import './polyfills';
import { getWallets } from '@wallet-standard/app';
import { PublicKey } from '@solana/web3.js';
import { getAccount, createAssociatedTokenAccountIdempotentInstruction, TOKEN_PROGRAM_ID } from '@solana/spl-token';
import { syntheticAddress, buildCreatePdaCall,isSyntheticProvisioned,buildSweepLeg,PRECOMPILE_ADDRESSES,pubkeyToBytes32 } from '@rome-protocol/sdk';
import { formatUnits,encodeDeployData,encodeFunctionData,decodeFunctionData,decodeEventLog,keccak256,toBytes,isAddress,type Address,type Hex } from 'viem';
import artifact from './RomeWorkG0.json';
import { config,publicClient,connection,tokenAbi,helperAbi,accounts,preflight,verifyDeployment,rpc } from './network';
import { begin,checkpoint,readJournal,saveSession,sessionConfig,type RecordEntry } from './journal';
import { estimateEvmWrite,estimateSolanaWrite,evmWrite,solanaWrite,nativeInstructions,reconcileRecord,connectMetaMaskDevnet,reviewedActionFeeCap,type WalletSession } from './lanes';
import { parseAmount,sanitizeEvidence,assertResumeAllowed,hasUnresolvedIntent } from './safety.mjs';
import { failureStatus,scopeRun,selectDeploymentRecord } from './recovery.mjs';
import { shortenAddress,formatTokenUnits,workroomView,guidedStage,findDevnetWallet,fundingStep } from './workroom.mjs';

const solanaLane='legacy';

const actionLabels: Record<string,string> = {
  DEPLOY:'Tạo escrow', accept:'Chấp thuận điều khoản', fund:'Nạp tiền ký quỹ',
  delivery:'Gửi bàn giao', approve:'Duyệt bàn giao', claim:'Nhận tiền từ escrow',
  sweep:'Chuyển USDC về ví Solana', wrap:'Wrap test USDC', grant:'Bật quyền wrapper',
  allowance:'Đặt allowance cho escrow', provision:'Tạo tài khoản Rome', ata:'Tạo tài khoản USDC trên Solana',
};

function summarizeEvmFee(fee:Awaited<ReturnType<typeof estimateEvmWrite>>) {
  return {
    maxFeeUsdc:formatUnits(fee.maxFee,18),
    balanceUsdc:formatUnits(fee.balance,18),
    capUsdc:formatUnits(fee.cap,18),
  };
}

export function mountRomeWorkroom(app: HTMLElement) {
  const listeners = new AbortController();
  const { signal } = listeners;
  const el=<T extends HTMLElement=HTMLInputElement>(id:string)=>app.querySelector(`#${id}`) as T;
  const saved=sessionConfig();for(const [id,value] of Object.entries(saved.inputs??{}))if(el(id))el<HTMLInputElement>(id).value=String(value);
  let evm:any=null,evmAccount:Address|undefined,sol:WalletSession|undefined,env:any=null,deployment:any=saved.deployment??null;
  let snapshots:any[]=saved.snapshots??[],pending:(()=>Promise<void>)|null=null,busy=false;
  let reviewActionFee:(()=>void)|null=null;
  let observedContract='';
  const show=(id:string,value:unknown)=>el(id).textContent=typeof value==='string'?value:JSON.stringify(sanitizeEvidence(value),null,2);
  const log=(value:unknown)=>show('log',value instanceof Error?value.message:value);
  const inputIds=['client','sol-key','amount','terms','contract'];
  const inputs=()=>({...Object.fromEntries(inputIds.map(id=>[id,el<HTMLInputElement>(id).value])),lane:solanaLane});
  const save=()=>{saveSession({inputs:inputs(),deployment,snapshots});renderWorkroom();};
  const values=()=>{
    const client=el<HTMLInputElement>('client').value as Address;if(!isAddress(client))throw new Error('Client address invalid');
    const wallet=new PublicKey(el<HTMLInputElement>('sol-key').value),freelancer=syntheticAddress(wallet),amount=parseAmount(el<HTMLInputElement>('amount').value),termsHash=keccak256(toBytes(el<HTMLInputElement>('terms').value));
    if(client.toLowerCase()===freelancer.toLowerCase())throw new Error('Client and freelancer must differ');return {client,wallet,freelancer,amount,termsHash};
  };
  const address=()=>{const a=el<HTMLInputElement>('contract').value;if(!isAddress(a))throw new Error('Deploy/import and verify an escrow first');return a as Address;};
  const contractRead=(name:string)=>publicClient.readContract({address:address(),abi:artifact.abi,functionName:name,args:[]} as any);
  async function ensure() {env=await preflight();show('environment',env);save();return env;}
  async function verified() {await ensure();const v=values();const result=await verifyDeployment(address(),artifact,v);show('identity',{...result,publicKey:v.wallet.toBase58(),synthetic:v.freelancer,...Object.fromEntries(Object.entries(accounts(v.wallet,v.freelancer)).map(([k,v])=>[k,v.toBase58()]))});return v;}
  function requireSol() {if(!sol)throw new Error('Kết nối ví ở ô Freelancer để tiếp tục.');if(sol.publicKey.toBase58()!==el<HTMLInputElement>('sol-key').value)throw new Error('Hãy chọn đúng tài khoản Solana đã gắn với escrow.');return sol;}
  function requireEvm(){if(!evm||!evmAccount)throw new Error('Bấm Kết nối MetaMask để tiếp tục.');if(evmAccount.toLowerCase()!==el<HTMLInputElement>('client').value.toLowerCase())throw new Error('Hãy kết nối đúng ví client đã gắn với escrow.');return evmAccount;}
  async function balanceAta(key:PublicKey) {const r=await connection.getParsedAccountInfo(key,'finalized');if(!r.value)return {amount:'0',exists:false,slot:r.context.slot};if(!('parsed' in r.value.data)||r.value.owner.toBase58()!==config.tokenProgram)throw new Error('Unexpected token account owner');return {amount:r.value.data.parsed.info.tokenAmount.amount,owner:r.value.data.parsed.info.owner,mint:r.value.data.parsed.info.mint,slot:r.context.slot,exists:true};}
  async function snapshot(label:string) {
    const v=await verified(),a=accounts(v.wallet,v.freelancer),block=await publicClient.getBlockNumber();
    const readToken=(who:Address)=>publicClient.readContract({address:config.wrapper as Address,abi:tokenAbi,functionName:'balanceOf',args:[who],blockNumber:block});
    const [client,escrow,synthetic,walletAta,syntheticAta,nativeClient,solBalance,grant,allowance,...escrowState]=await Promise.all([
      readToken(v.client),readToken(address()),readToken(v.freelancer),balanceAta(a.walletAta),balanceAta(a.syntheticAta),publicClient.getBalance({address:v.client}),connection.getBalanceAndContext(v.wallet,'finalized'),
      publicClient.readContract({address:config.wrapper as Address,abi:tokenAbi,functionName:'isEnabled',args:[v.client],blockNumber:block}),
      publicClient.readContract({address:config.wrapper as Address,abi:tokenAbi,functionName:'allowance',args:[v.client,address()],blockNumber:block}),
      ...['deposited','locked','claimable','paidOut','state'].map(contractRead)
    ]);
    const [deposited,locked,claimable,paidOut,state]=escrowState;
    if(walletAta.exists&&(walletAta.owner!==v.wallet.toBase58()||walletAta.mint!==config.mint))throw new Error('Destination ATA owner/mint mismatch');
    const result={label,timestampUtc:new Date().toISOString(),timestampUtc7:new Date().toLocaleString('sv-SE',{timeZone:'Asia/Bangkok'})+' UTC+7',contract:address(),evmBlock:block.toString(),evmReads:'wrapper balances and permissions requested at recorded block; state getters latest',atomicAcrossVM:false,commitment:'Solana finalized; record individual slots',client:String(client),escrow:String(escrow),synthetic:String(synthetic),walletAta:walletAta.amount,syntheticAta,nativeClient:String(nativeClient),solLamports:String(solBalance.value),solSlot:solBalance.context.slot,walletAtaContext:walletAta,deposited:String(deposited),locked:String(locked),claimable:String(claimable),paidOut:String(paidOut),state:String(state),grant,allowance:String(allowance),amount:String(v.amount)};
    observedContract=result.contract.toLowerCase();
    snapshots.push(result);save();show('state',result);return result;
  }
  async function hydrateDeployment() {
    const current=el<HTMLInputElement>('contract').value.toLowerCase();
    const r=selectDeploymentRecord(readJournal(),current);
    if(!r)return;
    if(!current&&r.originalInputs)for(const [id,value] of Object.entries(r.originalInputs))if(el(id))el<HTMLInputElement>(id).value=String(value);
    el<HTMLInputElement>('contract').value=r.receipt.contractAddress;
    const v=values();await verifyDeployment(address(),artifact,v);
    if(!r.constructorArgs||r.constructorArgs[0].toLowerCase()!==config.wrapper.toLowerCase()||r.constructorArgs[1].toLowerCase()!==v.client.toLowerCase()||r.constructorArgs[2].toLowerCase()!==v.freelancer.toLowerCase()||r.constructorArgs[3]!==String(v.amount)||r.constructorArgs[4]!==v.termsHash)throw new Error('Saved deploy intent does not match constructor/runtime');
    const tx=await rpc('eth_getTransactionByHash',[r.hash]);if(!tx||tx.to||tx.from.toLowerCase()!==v.client.toLowerCase()||(tx.input??tx.data)!==r.data)throw new Error('Deployment receipt does not match signed CREATE intent');
    checkpoint(r,{contract:r.receipt.contractAddress});
    deployment={network:config,contract:r.receipt.contractAddress,deployHash:r.hash,deployReceipt:r.receipt,deploymentFinality:r.status,constructorArgs:r.constructorArgs,compiler:artifact.compiler,settings:artifact.settings,sourceHash:artifact.sourceHash,creationBytecodeHash:artifact.creationBytecodeHash,sourceCommits:config.sourceCommits,timestampUtc:r.timestampUtc};save();
  }
  async function refresh(){
    clearPreview();
    observedContract='';
    const button=el<HTMLButtonElement>('refresh');
    button.disabled=true;
    button.textContent='Đang đọc…';
    try{
      for(const record of readJournal().filter(x=>!['FINALIZED','REVERTED','REJECTED_BEFORE_AUTH','PREAUTH_FAILED','WALLET_MESSAGE_REJECTED'].includes(x.status))){
        try{await reconcileRecord(record);}catch(error){checkpoint(record,{reconciliationError:String(error)});}
      }
      await hydrateDeployment();
      if(el<HTMLInputElement>('contract').value)await snapshot('refresh');
    }finally{
      button.disabled=false;
      button.textContent='Đọc trạng thái';
    }
  }
  function showJournal(){const journal=readJournal();show('journal',journal);renderWorkroom();}
  function renderWorkroom(){
    const current=el<HTMLInputElement>('contract').value.toLowerCase();
    const last=current&&observedContract===current?snapshots.findLast(s=>s.contract?.toLowerCase()===current&&s.state!==undefined):undefined;
    const journal=readJournal();
    const swept=!!current&&journal.some(r=>r.contract?.toLowerCase()===current&&r.action==='sweep'&&r.status==='FINALIZED');
    const state=last?Number(last.state):null;
    const stage=guidedStage({hasContract:!!current,state,swept,unresolved:hasUnresolvedIntent(journal)});
    const view=workroomView(state,swept);
    for(const panel of app.querySelectorAll<HTMLElement>('[data-stage]'))panel.hidden=panel.dataset.stage!==stage;
    if(stage==='fund'&&last){
      const hasBaseline=snapshots.some(s=>s.label==='baseline'&&s.contract?.toLowerCase()===current&&s.deposited==='0');
      const step=fundingStep({client:last.client,amount:last.amount,grant:last.grant,allowance:last.allowance,hasBaseline});
      for(const panel of app.querySelectorAll<HTMLElement>('[data-fund-step]'))panel.hidden=panel.dataset.fundStep!==step;
      const hints={wrap:'Ví client cần thêm wUSDC thử nghiệm.',grant:'Bật quyền cho wrapper để escrow có thể nhận wUSDC.',allowance:'Đặt giới hạn chi đúng số tiền của escrow.',baseline:'Lưu số dư trước khi nạp để đối chiếu khi freelancer nhận tiền.',fund:'Đã kiểm tra số dư và quyền chi. Có thể chuẩn bị giao dịch nạp.'};
      show('fund-hint',hints[step]);
    }
    const status:Record<string,string>={recover:'Có giao dịch cần đối chiếu',read:'Đã lưu escrow · Cần đọc trạng thái',deploy:'Chưa tạo escrow',claim:'Đã duyệt · Chờ nhận tiền',sweep:'Đã nhận trên Rome · Chờ chuyển về Solana',reconcile:'Đã chuyển · Kiểm tra số dư'};
    show('workroom-status',status[stage]??view.label);
    const list=el<HTMLOListElement>('workroom-steps');
    list.replaceChildren();
    for(const [index,label] of ['Chấp thuận','Ký quỹ','Bàn giao','Duyệt','Nhận tiền','Về ví','Đối chiếu'].entries()){
      const li=document.createElement('li');
      li.textContent=label;
      if(index<view.step)li.className='done';
      if(index===view.step&&stage!=='recover'){li.className='current';li.setAttribute('aria-current','step');}
      list.append(li);
    }
    try{show('budget-value',formatTokenUnits(parseAmount(el<HTMLInputElement>('amount').value)));}catch{show('budget-value','—');}
    for(const [id,key] of [['locked-value','locked'],['claimable-value','claimable'],['paid-value','paidOut']])show(id,last?formatTokenUnits(last[key]):'—');
    show('client-display',shortenAddress(evmAccount??'')||'Chưa kết nối');show('freelancer-display',sol?`${sol.wallet.name} · ${shortenAddress(sol.publicKey.toBase58())}`:'Chưa kết nối');
  }
  function clearPreview(){
    pending=null;
    reviewActionFee=null;
    el('review-action-fee').hidden=true;
    el<HTMLButtonElement>('send').disabled=true;
    el('preview-section').hidden=true;
  }
  function preview(fields:any,execute:(()=>Promise<void>)|null,preparedInputs:string) {
    const assertInputs = () => {
      if (JSON.stringify(inputs()) !== preparedInputs) throw new Error('Điều khoản, ví hoặc deployment đã đổi. Hãy chuẩn bị lại giao dịch.');
    };
    assertInputs();
    show('preview',{network:'Hadrian testnet 200010 / Solana Devnet',...fields});
    const amount=['DEPLOY','fund','wrap','allowance','claim','sweep'].includes(fields.action)?`Số tiền: ${formatTokenUnits(fields.amount)} test USDC.`:null;
    const fee=fields.fee?`Phí tối đa ước tính: ${fields.fee.maxFeeUsdc} test USDC.`:null;
    const grant=fields.action==='grant'?'Cấp quyền delegate SPL tối đa uint64 cho wrapper chuẩn và thay thế delegate cũ. Bước allowance riêng giới hạn khoản ký quỹ.':null;
    show('preview-summary',[actionLabels[fields.action],amount,fee,grant,...(fields.blockers??[])].filter(Boolean).join('\n'));
    pending=execute?async()=>{assertInputs();await execute();}:null;
    el<HTMLButtonElement>('send').disabled=!pending;
    el('preview-section').hidden=false;
    el('preview-section').scrollIntoView({behavior:'smooth'});
  }
  async function withJournalLock(fn: () => Promise<unknown>) {
    if (!navigator.locks) throw new Error('Mở workroom trong Chrome để dùng khóa nhật ký giữa các tab.');
    return navigator.locks.request('romework-hadrian-journal',{ifAvailable:true},async lock => {
      if (!lock) throw new Error('Một tab khác đang ký hoặc đối chiếu. Kiểm tra giao dịch cũ trước khi tiếp tục.');
      return fn();
    });
  }
  async function execute(fields:any,send:(r:RecordEntry)=>Promise<unknown>) {
    assertResumeAllowed(readJournal());const record=begin({...fields,contract:el<HTMLInputElement>('contract').value,lane:solanaLane,wallet:sol?{name:sol.wallet.name,version:sol.version,publicKey:sol.publicKey.toBase58()}:null});
    try {await send(record);await reconcileRecord(record);if(record.status!=='FINALIZED'&&record.status!=='REVERTED')checkpoint(record,{status:'UNKNOWN'});}
    catch(error:any){checkpoint(record,{status:failureStatus(record,error),error:String(error?.message??error)});throw error;}
    finally{showJournal();save();}
  }
  async function prepareDeploy() {
    clearPreview();
    if(el<HTMLInputElement>('contract').value)throw new Error('Đã chọn một escrow. Hoàn tất và xuất bằng chứng trước khi tạo lượt mới.');
    const from=requireEvm();
    requireSol();
    const preparedInputs=JSON.stringify(inputs());
    const v=values();
    await ensure();
    assertResumeAllowed(readJournal());
    const constructorArgs=[config.wrapper,v.client,v.freelancer,v.amount,v.termsHash] as const;
    const data=encodeDeployData({abi:artifact.abi,bytecode:artifact.bytecode as Hex,args:constructorArgs});
    const call={from,data};
    const fee=await estimateEvmWrite(call);
    const feeSummary=summarizeEvmFee(fee);
    const blockers=[
      ...(!fee.withinCap?['Phí tối đa vượt giới hạn G0.']:[]),
      ...(!fee.hasBalance?['Ví client chưa đủ USDC gas.']:[]),
    ];
    preview({
      action:'DEPLOY',from,to:'CREATE RomeWorkG0 only',wrapper:config.wrapper,amount:String(v.amount),
      client:v.client,freelancer:v.freelancer,termsHash:v.termsHash,creationBytecodeHash:artifact.creationBytecodeHash,
      fee:feeSummary,blockers,
    }, blockers.length?null:async()=>{
      const journal=readJournal(),previous=selectDeploymentRecord(journal,'');
      if(previous&&!journal.some(r=>r.contract?.toLowerCase()===previous.receipt.contractAddress.toLowerCase()&&r.action==='sweep'&&r.status==='FINALIZED'))throw new Error('Đã có deployment trong nhật ký. Hãy đối chiếu và khôi phục run cũ trước.');
      await execute({
        action:'deploy',caller:from,data,originalInputs:inputs(),
        constructorArgs:[config.wrapper,v.client,v.freelancer,String(v.amount),v.termsHash],feePreview:feeSummary,
      },r=>evmWrite(evm,r,call,fee.maxFee));
      await hydrateDeployment();
      if(deployment)await verified();
    },preparedInputs);
    if(blockers.length)log(`Phí tối đa ${feeSummary.maxFeeUsdc} USDC. Số dư gas ${feeSummary.balanceUsdc} USDC. Giới hạn ${feeSummary.capUsdc} USDC. ${blockers.join(' ')}`);
  }
  async function prepareAction(action:string) {
    clearPreview();
    const preparedInputs=JSON.stringify(inputs());
    assertResumeAllowed(readJournal());const solActions=['accept','provision','ata','delivery','claim','sweep'],isSol=solActions.includes(action);
    const caller=isSol?syntheticAddress(requireSol().publicKey):requireEvm();
    const v=await verified(),a=accounts(v.wallet,v.freelancer),state=Number(await contractRead('state'));
    let to:Address=address(),data:Hex='0x',value=0n,native:any[]|null=null,extraAccounts:any[]|undefined;
    const expected:Record<string,number>={accept:0,fund:1,delivery:2,approve:3,claim:4,sweep:5};if(action in expected&&state!==expected[action])throw new Error(`Wrong state ${state} for ${action}; reload/read before retry`);
    if(action==='accept')data=encodeFunctionData({abi:artifact.abi,functionName:'accept',args:[v.termsHash]});
    else if(action==='delivery')data=encodeFunctionData({abi:artifact.abi,functionName:'submitDelivery',args:[keccak256(toBytes('RomeWork G0 public test delivery v1'))]});
    else if(['fund','approve','claim'].includes(action))data=encodeFunctionData({abi:artifact.abi,functionName:action,args:[]});
    else if(action==='provision'){if(await isSyntheticProvisioned(connection,config.programId,v.freelancer)){log('Synthetic already provisioned; no transaction needed');return;}const c=buildCreatePdaCall(v.freelancer);to=c.to;data=c.data??'0x';}
    else if(action==='ata'){
      if(await connection.getAccountInfo(a.walletAta,'finalized')){log('Wallet ATA already exists; verify owner/mint in snapshot');return;}
      native=[createAssociatedTokenAccountIdempotentInstruction(v.wallet,a.walletAta,v.wallet,a.mint,TOKEN_PROGRAM_ID)];
    }
    else if(action==='wrap'){to=PRECOMPILE_ADDRESSES.withdraw;data=encodeFunctionData({abi:helperAbi,functionName:'withdraw_to_ata',args:[v.amount*10n**12n]});}
    else if(action==='grant'){
      const enabled=await publicClient.readContract({address:config.wrapper as Address,abi:tokenAbi,functionName:'isEnabled',args:[v.client]});if(enabled){log('Wrapper grant already enabled; no write needed');return;}
      to=PRECOMPILE_ADDRESSES.helper;data=encodeFunctionData({abi:helperAbi,functionName:'approve_spl',args:[config.wrapper as Address,2n**64n-1n,pubkeyToBytes32(a.mint)]});
    }
    else if(action==='allowance'){to=config.wrapper as Address;data=encodeFunctionData({abi:tokenAbi,functionName:'approve',args:[address(),v.amount]});}
    else if(action==='sweep'){
      if(!(await isSyntheticProvisioned(connection,config.programId,v.freelancer)))throw new Error('Provision before sweep');
      const target=await getAccount(connection,a.walletAta,'finalized',TOKEN_PROGRAM_ID);if(!target.owner.equals(v.wallet)||!target.mint.equals(a.mint))throw new Error('Destination ATA owner/mint mismatch');
      const source=await getAccount(connection,a.syntheticAta,'finalized',TOKEN_PROGRAM_ID);if(!source.owner.equals(a.authority)||source.amount<v.amount)throw new Error('Synthetic token account missing received amount');
      const before=snapshots.find(x=>x.label==='baseline'&&x.contract.toLowerCase()===address().toLowerCase());if(!before)throw new Error('A pre-fund baseline is required for sweep recovery');
      if(source.amount<BigInt(before.synthetic)+v.amount)throw new Error('Amount already swept or synthetic balance changed; inspect evidence');
      const sweep=buildSweepLeg({programId:config.programId,mint:a.mint,amount:v.amount,wallet:v.wallet,synthetic:v.freelancer,tokenProgram:TOKEN_PROGRAM_ID});
      const decoded=decodeFunctionData({abi:[{name:'transfer_spl',type:'function',inputs:[{type:'bytes32'},{type:'uint64'},{type:'bytes32'}],outputs:[],stateMutability:'nonpayable'}],data:sweep.calldata});
      if(decoded.args?.[0]!==pubkeyToBytes32(a.walletAta)||decoded.args?.[1]!==v.amount||decoded.args?.[2]!==pubkeyToBytes32(a.mint))throw new Error('SDK sweep destination mismatch');to=sweep.helperTo;data=sweep.calldata;extraAccounts=sweep.extraAccounts;
    }
    if(action==='fund') {
      const baseline=snapshots.find(x=>x.label==='baseline'&&x.contract.toLowerCase()===address().toLowerCase()&&x.deposited==='0');if(!baseline)throw new Error('Save baseline after wrap/grant/allowance, before fund');
      const allowance=await publicClient.readContract({address:config.wrapper as Address,abi:tokenAbi,functionName:'allowance',args:[v.client,address()]});if(allowance!==v.amount)throw new Error('Set escrow allowance to exact amount first');
      if(!(await publicClient.readContract({address:config.wrapper as Address,abi:tokenAbi,functionName:'isEnabled',args:[v.client]})))throw new Error('Client wrapper grant missing');
    }
    const evmCall={from:caller,to,data,value};
    const evmFee=isSol?undefined:await estimateEvmWrite(evmCall);
    const evmFeePreview=evmFee?summarizeEvmFee(evmFee):undefined;
    const fields={action,caller,to:native?undefined:to,data:native?undefined:data,nativeOnly:!!native,nativeInstructions:native?.map(ix=>({programId:ix.programId.toBase58(),keys:ix.keys.map((k:any)=>({pubkey:k.pubkey.toBase58(),isSigner:k.isSigner,isWritable:k.isWritable})),data:`0x${Buffer.from(ix.data).toString('hex')}`})),amount:String(v.amount),destinationAta:a.walletAta.toBase58(),mint:config.mint,tokenProgram:config.tokenProgram,feePreview:evmFeePreview};
    const solFee=['accept','claim','provision'].includes(action)?await estimateSolanaWrite(action,caller,{to,data,value}):undefined;
    const feePreview=solFee?{maxFeeUsdc:formatUnits(solFee.maxFee,18),capUsdc:formatUnits(solFee.cap,18)}:evmFeePreview;
    const quote=solFee??evmFee;
    const hasFeeBalance=evmFee?.hasBalance??true;
    const lane=isSol?solanaLane:'MetaMask EVM';
    const grantScope=action==='grant'?'SPL delegate to canonical wrapper up to uint64 max; distinct from escrow allowance; new delegate replaces it':undefined;
    const actionCap=reviewedActionFeeCap(action);
    const run=async(feeApproved=false)=>{
      await verified();
      if(JSON.stringify(inputs())!==preparedInputs)throw new Error('Dữ liệu đã đổi trong lúc kiểm tra. Chuẩn bị lại giao dịch.');
      if(action in expected&&Number(await contractRead('state'))!==state)throw new Error('Trạng thái contract đã đổi. Đọc lại nhật ký trước khi ký.');
      if(action==='sweep'&&readJournal().some(r=>r.contract?.toLowerCase()===address().toLowerCase()&&r.action==='sweep'&&r.status==='FINALIZED'))throw new Error('Run này đã sweep finalized.');
      if(isSol)requireSol();else requireEvm();
      const feeApproval=feeApproved&&actionCap?{capUsdc:formatUnits(actionCap,18),source:'explicit workroom approval for this action only'}:undefined;
      await execute({...fields,feeApproval,feePreview},r=>native?nativeInstructions(requireSol(),solanaLane,r,native):isSol?solanaWrite(requireSol(),solanaLane,r,{to,data,value,extraAccounts},feeApproved?solFee?.maxFee:undefined):evmWrite(evm,r,evmCall,evmFee?.maxFee,feeApproved));
      const last=readJournal().at(-1)!;
      if(['accept','fund','delivery','approve','claim'].includes(action)&&last.receipt?.status==='0x1'){
        const expectedAction={accept:1,fund:2,delivery:3,approve:4,claim:5}[action];
        const transition=last.receipt.logs.filter((l:any)=>l.address.toLowerCase()===address().toLowerCase()).map((l:any)=>{try{return decodeEventLog({abi:artifact.abi,data:l.data,topics:l.topics}) as any;}catch{return null;}}).find((l:any)=>l?.eventName==='Transition');
        if(!transition||transition.args.caller.toLowerCase()!==caller.toLowerCase()||Number(transition.args.action)!==expectedAction)throw new Error('Missing/mismatched caller transition event');checkpoint(last,{identityEvent:transition});
      }
      await snapshot(`after-${action}`);
    };
    if(quote&&feePreview&&(!quote.withinCap||!hasFeeBalance)){
      const blockers=[
        ...(!quote.withinCap?[`Phí vượt trần ${feePreview.capUsdc} test USDC.`]:[]),
        ...(!hasFeeBalance?['Ví client chưa đủ USDC gas.']:[]),
      ];
      preview({...fields,state,lane,fee:feePreview,blockers},null,preparedInputs);
      if(actionCap&&hasFeeBalance&&quote.maxFee<=actionCap){
        const approvedCap=formatUnits(actionCap,18);
        const button=el('review-action-fee');
        button.textContent=`Duyệt trần phí ${approvedCap.replace('.',',')} test USDC cho lượt này`;
        reviewActionFee=()=>{
          preview({...fields,state,lane,fee:{...feePreview,capUsdc:approvedCap},blockers:[`Đã duyệt trần ${approvedCap} test USDC riêng cho lượt này.`]},()=>run(true),preparedInputs);
          reviewActionFee=null;
          button.hidden=true;
        };
        button.hidden=false;
      }
      return;
    }
    preview({...fields,state,lane,fee:feePreview,grantScope},()=>run(),preparedInputs);
  }
  function download(name:string,data:any){const blob=new Blob([JSON.stringify(sanitizeEvidence(data),null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;a.click();URL.revokeObjectURL(url);}
  function bind(id:string,fn:()=>Promise<unknown>|unknown){
    el(id).addEventListener('click',async()=>{
      if(busy)return;
      busy=true;
      log('');
      try{
        if (['send','load','refresh','attach-hash','new-run'].includes(id)) await withJournalLock(async()=>fn());
        else await fn();
      }catch(error){log(error);}
      finally{busy=false;showJournal();}
    },{signal});
  }
  bind('preflight',ensure);
  bind('wallet-balances', async () => {
    show('balance-summary','');
    if (!evm || !evmAccount) throw new Error('Kết nối MetaMask trước khi đọc số dư');
    await ensure();
    const [walletChain, walletAccounts, gas, wrapped] = await Promise.all([
      evm.request({method:'eth_chainId'}),
      evm.request({method:'eth_accounts'}),
      publicClient.getBalance({address:evmAccount}),
      publicClient.readContract({address:config.wrapper as Address,abi:tokenAbi,functionName:'balanceOf',args:[evmAccount]}),
    ]);
    if (walletAccounts[0]?.toLowerCase() !== evmAccount.toLowerCase()) throw new Error('Tài khoản MetaMask đã đổi. Kết nối lại để đọc số dư.');
    const wallet = sol;
    const freelancer = wallet ? await (async () => {
      const ata = accounts(wallet.publicKey, syntheticAddress(wallet.publicKey)).walletAta;
      const [balance, tokens] = await Promise.all([connection.getBalanceAndContext(wallet.publicKey,'finalized'), balanceAta(ata)]);
      if (tokens.exists && (tokens.owner !== wallet.publicKey.toBase58() || tokens.mint !== config.mint)) throw new Error('Địa chỉ ATA không khớp chủ ví hoặc mint');
      return {address:wallet.publicKey.toBase58(),sol:formatUnits(BigInt(balance.value),9),devnetUsdc:formatUnits(BigInt(tokens.amount),6),ata:ata.toBase58(),ataExists:tokens.exists};
    })() : 'Chưa kết nối ví freelancer';
    const nativeTestUsdc=formatUnits(gas,18),wrappedTestUsdc=formatUnits(wrapped,6);
    show('balances',{network:'Hadrian testnet / Solana Devnet',client:{address:evmAccount,selectedChainId:Number(BigInt(walletChain)),nativeTestUsdc,wrappedTestUsdc},freelancer});
    show('balance-summary',[`Client · ${nativeTestUsdc} test USDC gas · ${wrappedTestUsdc} wUSDC`,typeof freelancer==='string'?freelancer:`Freelancer · ${freelancer.sol} SOL · ${freelancer.devnetUsdc} test USDC`,Number(BigInt(walletChain))!==config.chainId?'Hãy chọn Hadrian Testnet trong MetaMask trước khi ký.':null].filter(Boolean).join('\n'));
  });

  const metamaskProviders = new Set<any>();
  window.addEventListener('eip6963:announceProvider', (event) => {
    const detail = (event as CustomEvent).detail;
    if (detail?.info?.rdns === 'io.metamask' && detail.provider?.request) metamaskProviders.add(detail.provider);
  }, {signal});
  window.dispatchEvent(new Event('eip6963:requestProvider'));
  bind('evm-connect',async()=>{
    clearPreview();show('balance-summary','');
    evmAccount=undefined;
    evm=metamaskProviders.values().next().value;
    if(!evm)throw new Error('Chrome chưa phát hiện extension MetaMask.');
    const result=await evm.request({method:'eth_requestAccounts'});
    if(!Array.isArray(result)||typeof result[0]!=='string'||!isAddress(result[0]))throw new Error('MetaMask chưa trả về địa chỉ ví hợp lệ.');
    evmAccount=result[0];
    if(!el<HTMLInputElement>('client').value)el<HTMLInputElement>('client').value=evmAccount;
    const id=await evm.request({method:'eth_chainId'});show('wallet-status',{MetaMask:evmAccount,chainId:Number(BigInt(id)),Solana:sol?.account.address??'not connected'});save();
  });
  function storeSolana(session:WalletSession){
    sol=session;
    if(!el<HTMLInputElement>('sol-key').value)el<HTMLInputElement>('sol-key').value=session.account.address;
    show('wallet-status',{MetaMask:evmAccount??'not connected',Solana:{name:session.wallet.name,version:session.version,account:session.account.address,synthetic:syntheticAddress(session.publicKey)}});
    save();
  }
  bind('sol-metamask-connect',async()=>{
    clearPreview();show('balance-summary','');
    sol=undefined;
    if(!metamaskProviders.size)throw new Error('Chrome chưa phát hiện extension MetaMask.');
    const {getMultichainClient,getDefaultTransport}=await import('@metamask/multichain-api-client');
    const client=getMultichainClient({transport:getDefaultTransport()});
    storeSolana(await connectMetaMaskDevnet(client,el<HTMLInputElement>('sol-key').value));
  });
  bind('sol-connect',async()=>{
    clearPreview();show('balance-summary','');
    sol=undefined;
    const selected=findDevnetWallet(getWallets().get(),'OKX Wallet');
    if(!selected)throw new Error('Chrome chưa phát hiện OKX Wallet hỗ trợ ký Solana Devnet.');
    const connect=selected.features['standard:connect'] as {connect():Promise<unknown>};
    await connect.connect();
    const accounts=selected.accounts.filter(account=>account.chains.includes('solana:devnet'));
    const expected=el<HTMLInputElement>('sol-key').value;
    const account=expected?accounts.find(account=>account.address===expected):accounts[0];
    if(!accounts.length)throw new Error('OKX Wallet chưa cung cấp tài khoản Solana Devnet.');
    if(!account)throw new Error(`Hãy cấp quyền cho tài khoản Solana ${shortenAddress(expected)} trong OKX Wallet rồi kết nối lại.`);
    const publicKey=new PublicKey(account.publicKey);
    if(publicKey.toBase58()!==account.address)throw new Error('Public key ví không khớp địa chỉ tài khoản Solana.');
    storeSolana({wallet:selected,account,publicKey,version:selected.version});
  });
  bind('deploy',prepareDeploy);bind('load',async()=>{await verified();await refresh();save();});bind('refresh',refresh);bind('snapshot',async()=>{await snapshot('baseline');log('Đã lưu số dư gốc.');});
  bind('review-action-fee',()=>reviewActionFee?.());
  bind('new-run',async()=>{assertResumeAllowed(readJournal());const current=address().toLowerCase();if(Number(await contractRead('state'))!==5||!readJournal().some(r=>r.contract?.toLowerCase()===current&&r.action==='sweep'&&r.status==='FINALIZED'))throw new Error('Finish claim + finalized sweep and export evidence before starting a new deployment');deployment=null;el<HTMLInputElement>('contract').value='';observedContract='';clearPreview();save();show('identity','New deployment run ready; prior journal and snapshots retained separately.');});
  for(const button of app.querySelectorAll<HTMLButtonElement>('[data-action]'))button.addEventListener('click',async()=>{if(busy)return;busy=true;log('');try{await prepareAction(button.dataset.action!);}catch(error){log(error);}finally{busy=false;}},{signal});
  bind('send',async()=>{if(!pending)throw new Error('Chuẩn bị giao dịch trước.');assertResumeAllowed(readJournal());const send=pending;pending=null;observedContract='';el<HTMLButtonElement>('send').disabled=true;show('preview-summary','Đang đợi ví và kiểm tra kết quả…');try{await send();}finally{clearPreview();}});
  bind('export',()=>{const current=address().toLowerCase();if(!deployment||deployment.contract.toLowerCase()!==current)throw new Error('Verify and recover actual deployment manifest first');download(`romework-g0-${Date.now()}.json`,{schema:'romework-g0-run-v1',sourceCommits:config.sourceCommits,environment:env,deployment,inputs:inputs(),...scopeRun(readJournal(),snapshots,current),scope:'Public testnet evidence only; success requires independent receipt/settlement/reconciliation'});});
  bind('manifest',()=>{if(!deployment?.deployHash||!deployment?.deployReceipt?.contractAddress)throw new Error('No actual deployment receipt; manifest not created');download('hadrian-g0.json',deployment);});
  bind('attach-hash',async()=>{const record=readJournal().filter(r=>!['FINALIZED','REVERTED','REJECTED_BEFORE_AUTH'].includes(r.status)&&!r.hash).at(-1);if(!record)throw new Error('No unresolved hashless intent');const hash=el<HTMLInputElement>('recovery-hash').value;if(!/^0x[0-9a-fA-F]{64}$/.test(hash))throw new Error('Expected public transaction hash');const tx=await rpc('eth_getTransactionByHash',[hash]);if(!tx||tx.from?.toLowerCase()!==record.caller.toLowerCase()||BigInt(tx.nonce)!==BigInt(record.nonce!)||(tx.input??tx.data)!==record.data||tx.to?.toLowerCase()!==record.to?.toLowerCase())throw new Error('Hash does not match caller/nonce/payload/destination');checkpoint(record,{hash});await refresh();});
  bind('negative',async()=>{const v=await verified(),tests=[{action:'accept',from:v.client,data:encodeFunctionData({abi:artifact.abi,functionName:'accept',args:[v.termsHash]})},{action:'fund',from:v.freelancer,data:encodeFunctionData({abi:artifact.abi,functionName:'fund',args:[]})}];const results=[];for(const t of tests){try{await rpc('eth_call',[{from:t.from,to:address(),data:t.data},'latest']);results.push({action:t.action,result:'FAIL: unauthorized simulation succeeded'});}catch(error){results.push({action:t.action,result:'SIMULATED_REVERT_NOT_A_TRANSACTION',error:String(error)});}}snapshots.push({label:'negative-eth-call',results,timestampUtc:new Date().toISOString()});save();show('state',results);});
  getWallets();
  showJournal();
  window.addEventListener('journal',showJournal,{signal});
  window.addEventListener('storage',(event)=>{if(event.key==='romework-g0-journal-v1'||event.key===null){observedContract='';clearPreview();showJournal();}},{signal});
  for(const id of inputIds)el(id).addEventListener('change',()=>{clearPreview();observedContract='';save();},{signal});
  return () => listeners.abort();
}
