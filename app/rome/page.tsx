import type { Metadata } from 'next';
import { Shield } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { HadrianWorkroom } from '@/components/rome/HadrianWorkroom';

export const metadata: Metadata = { title: 'Hadrian G0 Workroom | RomeWork' };

export default function RomePage() {
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6">
      <header className="mb-5 flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 pb-5">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">RomeWork</h1>
          <p className="mt-1.5 text-sm text-slate-600">Ký quỹ một mốc với MetaMask và OKX Wallet.</p>
        </div>
        <Badge variant="outline" className="border-blue-200 bg-blue-50 text-blue-800">Hadrian Testnet · 200010</Badge>
      </header>
      <aside className="mb-5 flex gap-2.5 rounded-lg border border-amber-200 bg-amber-50/70 px-3 py-2.5 text-sm text-amber-950">
        <Shield className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
        <p><strong>Chỉ dùng token testnet.</strong> Khoản ký quỹ không hoàn lại.</p>
      </aside>
      <HadrianWorkroom />
      <a className="mt-5 inline-block text-sm font-semibold text-blue-700 underline" href="https://docs.rome.builders/developer-guides/dual-lane-app">Tài liệu Rome Dual Lane</a>
    </div>
  );
}
