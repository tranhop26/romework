export function failureStatus(record,error) {
  if(['AUTHORIZED','SIGNED','BROADCAST','CONFIRMED','FINALIZED'].includes(record.status))return 'UNKNOWN';
  if(error?.code===4001||error?.cause?.code===4001||/user rejected|user declined/i.test(error?.message??''))return 'REJECTED_BEFORE_AUTH';
  if(record.status==='INTENT'&&!record.authorizationRequested&&!record.signingRequested)return 'PREAUTH_FAILED';
  return 'UNKNOWN';
}
export function scopeRun(journal,snapshots,contract) {const same=x=>x.contract?.toLowerCase()===contract.toLowerCase();return {journal:journal.filter(same),snapshots:snapshots.filter(same)};}
export function selectDeploymentRecord(records,current) {return [...records].reverse().find(r=>r.action==='deploy'&&r.hash&&r.receipt?.status==='0x1'&&r.receipt?.contractAddress&&(!current||r.receipt.contractAddress.toLowerCase()===current.toLowerCase()));}
