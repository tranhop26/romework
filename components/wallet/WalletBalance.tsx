import Link from 'next/link';
import { Wallet } from 'lucide-react';

export function WalletBalance({ address }: { address: string }) {
  return (
    <Link href="/rome" title={`Sample profile: ${address}`} className="inline-flex items-center gap-1.5 rounded-md bg-blue-50 px-2 py-1 text-xs font-semibold text-blue-800">
      <Wallet className="h-4 w-4" /> Testnet balances
    </Link>
  );
}
