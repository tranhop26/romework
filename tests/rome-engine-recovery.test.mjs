import { test } from 'node:test';
import assert from 'node:assert/strict';
import { failureStatus,scopeRun,selectDeploymentRecord } from '../lib/rome/recovery.mjs';
test('pre-sign RPC/fee/feature failures do not permanently poison the signing journal',()=>{
  assert.equal(failureStatus({status:'INTENT'},new Error('fee cap')),'PREAUTH_FAILED');
  assert.equal(failureStatus({status:'INTENT',signingRequested:true},new Error('timeout')),'UNKNOWN');
  assert.equal(failureStatus({status:'AUTHORIZED'},Object.assign(new Error('rejected'),{code:4001})),'UNKNOWN');
  assert.equal(failureStatus({status:'WALLET_REQUEST'},Object.assign(new Error('rejected'),{code:4001})),'REJECTED_BEFORE_AUTH');
  assert.equal(failureStatus({status:'SIGNED'},new Error('network timeout')),'UNKNOWN');
  assert.equal(failureStatus({status:'INTENT',authorizationRequested:true},new Error('wallet timeout')),'UNKNOWN');
});
test('new deployment exports cannot inherit successful actions/snapshots from an older deployment',()=>{
  const result=scopeRun([{contract:'0xAA',action:'claim'},{contract:'0xbb',action:'accept'}],[{contract:'0xaa',label:'after-sweep'},{contract:'0xbB',label:'baseline'}],'0xBB');
  assert.deepEqual(result,{journal:[{contract:'0xbb',action:'accept'}],snapshots:[{contract:'0xbB',label:'baseline'}]});
});
test('deployment recovered after reload requires a successful actual CREATE receipt',()=>{
  const good={action:'deploy',hash:'0x123',receipt:{status:'0x1',contractAddress:'0xAa'}};
  assert.equal(selectDeploymentRecord([good],''),good);
  assert.equal(selectDeploymentRecord([good],'0xaa'),good);
  assert.equal(selectDeploymentRecord([good],'0xbb'),undefined);
  assert.equal(selectDeploymentRecord([{...good,receipt:null}],''),undefined);
  assert.equal(selectDeploymentRecord([{...good,receipt:{status:'0x0',contractAddress:'0xAa'}}],''),undefined);
});
