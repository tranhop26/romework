import { sanitizeEvidence, assertResumeAllowed } from './safety.mjs';
const key='romework-g0-journal-v1';
export type RecordEntry={id:string;status:string;action:string;caller:string;to?:string;data?:string;nonce?:string;hash?:string;signature?:string;payloadHash?:string;route?:string;[key:string]:any};
export const readJournal=():RecordEntry[]=>JSON.parse(localStorage.getItem(key)??'[]');
export function update(record:RecordEntry) {const all=readJournal(); const index=all.findIndex(x=>x.id===record.id);if(index<0)all.push(record);else all[index]=record;localStorage.setItem(key,JSON.stringify(sanitizeEvidence(all)));window.dispatchEvent(new Event('journal'));}
export function begin(fields:{action:string;caller:string;[key:string]:any}) {assertResumeAllowed(readJournal()); const record:RecordEntry={...fields,id:crypto.randomUUID(),status:'INTENT',timestampUtc:new Date().toISOString()};update(record);return record;}
export function checkpoint(record:RecordEntry,fields:Record<string,any>) {Object.assign(record,fields);update(record);}
export function sessionConfig() {return JSON.parse(localStorage.getItem('romework-g0-session')??'{}');}
export function saveSession(value:unknown) {localStorage.setItem('romework-g0-session',JSON.stringify(value));}
