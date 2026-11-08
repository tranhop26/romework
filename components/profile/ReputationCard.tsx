import { Award } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export function ReputationCard({ address }: { address: string }) {
  return (
    <Card className="border-slate-200 bg-white">
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Award className="h-4 w-4 text-blue-700" /> Sample reputation</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 text-sm text-slate-600">
        <p className="break-all font-mono text-xs">{address}</p>
        <p>Hadrian G0 verifies escrow and payout receipts. Profile and reputation values are local sample data.</p>
      </CardContent>
    </Card>
  );
}
