export function shortenAddress(address:string|null|undefined):string;
export function formatTokenUnits(amount:bigint|string):string;
export function workroomView(state:number|null|undefined,swept?:boolean):{label:string;next:string;step:number};
export function guidedStage(input:{hasContract:boolean;state:number|null|undefined;swept?:boolean;unresolved?:boolean}):string;
export function fundingStep(input:{client:string;amount:string;grant:boolean;allowance:string;hasBaseline:boolean}):'wrap'|'grant'|'allowance'|'baseline'|'fund';
export function findDevnetWallet<T extends {name:string;chains:readonly string[];features:object}>(wallets:readonly T[],name:'MetaMask'|'OKX Wallet'):T|undefined;
