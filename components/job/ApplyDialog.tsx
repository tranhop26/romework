'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Loader2, Send } from 'lucide-react';

interface ApplyDialogProps {
  jobId: string;
  defaultAmount: number;
  trigger: React.ReactElement;
}

export function ApplyDialog({ jobId, defaultAmount, trigger }: ApplyDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [coverLetter, setCoverLetter] = useState('');
  const [proposedAmount, setProposedAmount] = useState(defaultAmount.toString());
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!coverLetter || coverLetter.length < 20) {
      toast.error('Cover letter must be at least 20 characters long.');
      return;
    }

    const amt = parseFloat(proposedAmount);
    if (isNaN(amt) || amt <= 0) {
      toast.error('Please enter a valid budget proposal.');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`/api/jobs/${jobId}/apply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          coverLetter,
          proposedAmount: amt,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.message || 'Failed to submit application.');
      }

      toast.success('Your application was submitted successfully!');
      setOpen(false);
      setCoverLetter('');
      router.refresh();
    } catch (err: any) {
      toast.error(err.message || 'Failed to submit application');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={trigger} />
      <DialogContent className="sm:max-w-[500px] bg-white rounded-lg">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold text-slate-900">Apply to Contract</DialogTitle>
          <DialogDescription className="text-slate-500 text-xs">
            Describe your qualifications and confirm your proposed milestones budget.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5 pt-3">
          <div className="space-y-2">
            <Label htmlFor="proposedAmount" className="text-xs font-bold text-slate-700 uppercase">
              Proposed Budget (USDC)
            </Label>
            <Input
              id="proposedAmount"
              type="number"
              min={1}
              className="text-slate-900 border-slate-200 font-mono"
              value={proposedAmount}
              onChange={(e) => setProposedAmount(e.target.value)}
              disabled={loading}
              required
            />
            <span className="text-[10px] text-slate-400 block">
              Sample proposal: ${parseFloat(proposedAmount || '0').toFixed(2)} USDC
            </span>
          </div>

          <div className="space-y-2">
            <Label htmlFor="coverLetter" className="text-xs font-bold text-slate-700 uppercase">
              Introduction &amp; Experience
            </Label>
            <Textarea
              id="coverLetter"
              rows={5}
              placeholder="Detail your background, relevant past projects, and how you plan to complete this job milestone..."
              className="text-slate-900 border-slate-200 text-xs leading-relaxed"
              value={coverLetter}
              onChange={(e) => setCoverLetter(e.target.value)}
              disabled={loading}
              required
            />
            <span className="text-[10px] text-slate-400 block text-right">
              {coverLetter.length} / 1000 characters
            </span>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button
              type="button"
              variant="ghost"
              className="border border-slate-200 text-slate-700 hover:bg-slate-50"
              onClick={() => setOpen(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="bg-blue-700 hover:bg-blue-800 text-white flex items-center gap-1.5"
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Submitting...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4" /> Submit Proposal
                </>
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
