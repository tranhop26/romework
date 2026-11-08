export function parseAmount(value:string):bigint;
export function reconcileBalances(before:Record<string,string>,after:Record<string,string>,amount:bigint):{pass:boolean;checks:Record<string,boolean>;deltas:Record<string,string>};
export function assertResumeAllowed(records:Array<{status:string}>):void;
export function hasUnresolvedIntent(records:Array<{status:string}>):boolean;
export function verifyRuntime(expected:string,actual:string,references:Record<string,Array<{start:number;length:number}>>):boolean;
export function assertEnvironment(expected:Record<string,unknown>,actual:Record<string,unknown>):void;
export function sanitizeEvidence(value:unknown):any;
export function settlementStatus(receipt:any,statuses:any[],nativeOnly?:boolean):string;
