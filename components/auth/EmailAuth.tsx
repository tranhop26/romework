'use client';

import Link from 'next/link';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';

interface EmailAuthProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EmailAuth({ open, onOpenChange }: EmailAuthProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Enter RomeWork</DialogTitle>
          <DialogDescription>Use your browser wallet in the Hadrian workroom. Try Demo on the home page to explore sample jobs.</DialogDescription>
        </DialogHeader>
        <Link href="/rome" onClick={() => onOpenChange(false)} className="rounded-md bg-blue-700 px-4 py-2 text-center font-semibold text-white hover:bg-blue-800">
          Open Hadrian Workroom
        </Link>
      </DialogContent>
    </Dialog>
  );
}
