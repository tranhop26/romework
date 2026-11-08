'use client';

import { useState, useEffect, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { EmailAuth } from '@/components/auth/EmailAuth';
import { useAuthStore } from '@/lib/stores/authStore';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { 
  ArrowRight, Shield, Zap, DollarSign, Scale, Globe, Lock, CheckCircle2, 
  HelpCircle, Star, AlertCircle, Sparkles, Building2, UserCheck, Mail, Loader2
} from 'lucide-react';

export default function Home() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-700"></div>
      </div>
    }>
      <LandingPageContent />
    </Suspense>
  );
}

function LandingPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { setUser } = useAuthStore();
  const [authOpen, setAuthOpen] = useState(false);
  const [demoLoading, setDemoLoading] = useState(false);
  const [demoError, setDemoError] = useState<string | null>(null);
  const demoPending = useRef(false);

  // If redirected with auth=required, open auth modal
  useEffect(() => {
    if (searchParams.get('auth') === 'required') {
      setAuthOpen(true);
    }
  }, [searchParams]);

  const handleDemoMode = async () => {
    if (demoPending.current) return;
    demoPending.current = true;
    setDemoLoading(true);
    setDemoError(null);
    toast.loading('Setting up demo sandbox...', { id: 'demo' });
    try {
      const res = await fetch('/api/seed', { method: 'POST', signal: AbortSignal.timeout(35000) });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.success || !data?.demo_user?.id) {
        throw new Error(data?.error || 'Demo could not be started. Please try again shortly.');
      }
      setUser(data.demo_user);
      toast.success(`Demo ready! Logged in as ${data.demo_user.display_name}`, { id: 'demo' });
      router.push('/dashboard?demo=true');
      router.refresh();
    } catch (err: unknown) {
      const message = err instanceof Error && err.name !== 'TimeoutError'
        ? err.message
        : 'Demo setup timed out. Please try again shortly.';
      setDemoError(message);
      toast.error(message, { id: 'demo' });
    } finally {
      demoPending.current = false;
      setDemoLoading(false);
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-slate-50">
      {/* 1. Hero Section */}
      <section className="relative py-20 lg:py-32 overflow-hidden bg-white">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            {/* Left Col */}
            <div className="lg:col-span-7 space-y-6 text-center lg:text-left">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50 text-blue-700 text-xs font-semibold border border-blue-100">
                <Sparkles className="h-3.5 w-3.5" />
                <span>Rome Hadrian Testnet · G0</span>
              </div>
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-slate-900 leading-tight">
                USDC escrow, <br />
                <span className="text-blue-700">on Rome</span>
              </h1>
              <p className="text-lg sm:text-xl text-slate-600 max-w-2xl mx-auto lg:mx-0">
                Test one freelance milestone with a MetaMask client and a Solana Devnet freelancer.
              </p>
              <div className="flex flex-col sm:flex-row justify-center lg:justify-start gap-4">
                <Button 
                  onClick={() => router.push('/rome')}
                  className="bg-blue-700 hover:bg-blue-800 text-white font-semibold py-3 px-8 rounded-lg text-base shadow-md transition-all flex items-center justify-center gap-2"
                >
                  Open Hadrian Workroom
                  <ArrowRight className="h-5 w-5" />
                </Button>
                <Button 
                  onClick={handleDemoMode}
                  disabled={demoLoading}
                  aria-busy={demoLoading}
                  variant="outline"
                  className="border-slate-200 hover:bg-slate-50 text-slate-800 font-semibold py-3 px-8 rounded-lg text-base shadow-sm"
                >
                  {demoLoading && <Loader2 className="h-4 w-4 animate-spin" />}
                  {demoLoading ? 'Preparing Demo...' : 'Try Demo Mode'}
                </Button>
              </div>
              {demoError && <p role="alert" className="text-sm text-red-700">{demoError}</p>}
              <p className="text-xs text-slate-500">
                Connect through your browser extensions. Use test tokens only.
              </p>
            </div>

            {/* Right Col (Graphic) */}
            <div className="lg:col-span-5 flex justify-center">
              <div className="relative w-full max-w-md p-6 rounded-2xl bg-slate-900 text-white shadow-2xl border border-slate-800">
                <div className="flex items-center justify-between border-b border-slate-800 pb-4 mb-4">
                  <div className="flex items-center gap-2">
                    <Shield className="h-5 w-5 text-blue-500" />
                    <span className="font-bold text-sm text-slate-300">RomeWork Escrow Preview</span>
                  </div>
                  <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 text-xs font-semibold">
                    Testnet Preview
                  </span>
                </div>
                <div className="space-y-4">
                  <div>
                    <span className="text-xs text-slate-500 uppercase block font-semibold">Contract Address</span>
                    <span className="text-xs text-slate-300 font-mono">Deployment pending</span>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <span className="text-xs text-slate-500 uppercase block font-semibold">Client</span>
                      <span className="text-sm font-semibold">Global Client</span>
                    </div>
                    <div>
                      <span className="text-xs text-slate-500 uppercase block font-semibold">Freelancer</span>
                      <span className="text-sm font-semibold">VN Freelancer</span>
                    </div>
                  </div>
                  <div className="border-t border-slate-800 pt-4 flex justify-between items-center">
                    <div>
                      <span className="text-xs text-slate-500 block uppercase font-semibold">G0 Test Cap</span>
                      <span className="text-2xl font-extrabold text-emerald-400">1 test USDC</span>
                    </div>
                    <div className="text-right">
                      <span className="text-xs text-slate-500 block uppercase font-semibold">Wallet Networks</span>
                      <span className="text-xs text-blue-400 font-medium">Hadrian + Devnet</span>
                    </div>
                  </div>
                  <div className="bg-slate-800/50 border border-slate-700/50 p-3 rounded-lg flex items-start gap-2.5">
                    <Scale className="h-4 w-4 text-orange-500 mt-0.5 shrink-0" />
                    <div>
                      <span className="text-xs font-bold text-orange-400 block">Explicit Claim and Sweep</span>
                      <p className="text-[10px] text-slate-400 leading-normal">
                        Approval grants a claim. The freelancer claims and then sweeps to a verified Solana token account.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 2. Stats Bar */}
      <section className="bg-slate-100 py-6 border-y border-slate-200">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 text-center divide-y lg:divide-y-0 lg:divide-x divide-slate-200">
            <div className="py-2 lg:py-0">
              <span className="text-2xl font-extrabold text-slate-900 block">Hadrian</span>
              <span className="text-xs text-slate-500 font-semibold uppercase">Rome Testnet</span>
            </div>
            <div className="py-2 lg:py-0 pt-4 lg:pt-0">
              <span className="text-2xl font-extrabold text-slate-900 block">1 USDC</span>
              <span className="text-xs text-slate-500 font-semibold uppercase">Test Cap per Milestone</span>
            </div>
            <div className="py-2 lg:py-0 pt-4 lg:pt-0">
              <span className="text-2xl font-extrabold text-slate-900 block">Two Wallets</span>
              <span className="text-xs text-slate-500 font-semibold uppercase">MetaMask + Solana</span>
            </div>
            <div className="py-2 lg:py-0 pt-4 lg:pt-0">
              <span className="text-2xl font-extrabold text-slate-900 block">One Milestone</span>
              <span className="text-xs text-slate-500 font-semibold uppercase">G0 Escrow</span>
            </div>
          </div>
        </div>
      </section>

      {/* 3. Problem Section */}
      <section className="py-16 lg:py-24 bg-slate-50">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto space-y-4 mb-16">
            <h2 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
              Freelancers lose money and time
            </h2>
            <p className="text-lg text-slate-600">
              The workroom records funding, delivery and payout as separate steps.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="p-6 bg-white rounded-xl border border-slate-200/80 shadow-sm space-y-4">
              <div className="h-10 w-10 rounded-lg bg-red-50 flex items-center justify-center text-red-600">
                <DollarSign className="h-6 w-6" />
              </div>
              <h3 className="text-lg font-bold text-slate-900">Funding</h3>
              <p className="text-sm text-slate-600 leading-relaxed">
                Upwork and Fiverr take a massive chunk of your earnings, cutting deep into freelancer profit margins.
              </p>
            </div>
            <div className="p-6 bg-white rounded-xl border border-slate-200/80 shadow-sm space-y-4">
              <div className="h-10 w-10 rounded-lg bg-red-50 flex items-center justify-center text-red-600">
                <Zap className="h-6 w-6" />
              </div>
              <h3 className="text-lg font-bold text-slate-900">Payout</h3>
              <p className="text-sm text-slate-600 leading-relaxed">
                Verify the claim and the final Solana token account separately.
              </p>
            </div>
            <div className="p-6 bg-white rounded-xl border border-slate-200/80 shadow-sm space-y-4">
              <div className="h-10 w-10 rounded-lg bg-red-50 flex items-center justify-center text-red-600">
                <Globe className="h-6 w-6" />
              </div>
              <h3 className="text-lg font-bold text-slate-900">Evidence</h3>
              <p className="text-sm text-slate-600 leading-relaxed">
                The workroom exports public hashes, receipts and balance snapshots for the test run.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 4. How It Works Section */}
      <section className="py-16 lg:py-24 bg-white border-t border-slate-200">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto space-y-4 mb-16">
            <h2 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
              Seamless Escrow Flow
            </h2>
            <p className="text-lg text-slate-600">
              Test funds follow the immutable terms in the Hadrian escrow.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-12 relative">
            {/* Step 1 */}
            <div className="flex flex-col items-center text-center space-y-4">
              <div className="h-16 w-16 rounded-full bg-blue-50 border border-blue-200 flex items-center justify-center font-bold text-lg text-blue-700">
                1
              </div>
              <h3 className="text-xl font-bold text-slate-900">Set Terms</h3>
              <p className="text-sm text-slate-600 max-w-xs">
                Client and freelancer addresses, amount and terms hash are fixed at deploy.
              </p>
            </div>

            {/* Step 2 */}
            <div className="flex flex-col items-center text-center space-y-4">
              <div className="h-16 w-16 rounded-full bg-blue-50 border border-blue-200 flex items-center justify-center font-bold text-lg text-blue-700">
                2
              </div>
              <h3 className="text-xl font-bold text-slate-900">Accept &amp; Lock</h3>
              <p className="text-sm text-slate-600 max-w-xs">
                The freelancer accepts the terms. The client then locks the agreed amount in escrow.
              </p>
            </div>

            {/* Step 3 */}
            <div className="flex flex-col items-center text-center space-y-4">
              <div className="h-16 w-16 rounded-full bg-blue-50 border border-blue-200 flex items-center justify-center font-bold text-lg text-blue-700">
                3
              </div>
              <h3 className="text-xl font-bold text-slate-900">Deliver, Claim &amp; Sweep</h3>
              <p className="text-sm text-slate-600 max-w-xs">
                The freelancer submits a delivery hash. Client approval makes the amount claimable.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 5. Features Grid */}
      <section className="py-16 lg:py-24 bg-slate-50 border-t border-slate-200">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto space-y-4 mb-16">
            <h2 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
              Inside the Hadrian Workroom
            </h2>
            <p className="text-lg text-slate-600">
              Check each role, wallet and receipt during the testnet run.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            <div className="p-6 bg-white rounded-xl border border-slate-200 shadow-sm space-y-3">
              <div className="h-8 w-8 rounded bg-blue-50 text-blue-700 flex items-center justify-center">
                <Mail className="h-5 w-5" />
              </div>
              <h3 className="font-bold text-slate-900">Extension Wallets</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Client uses MetaMask. Freelancer connects a Solana Devnet wallet.
              </p>
            </div>

            <div className="p-6 bg-white rounded-xl border border-slate-200 shadow-sm space-y-3">
              <div className="h-8 w-8 rounded bg-blue-50 text-blue-700 flex items-center justify-center">
                <Scale className="h-5 w-5" />
              </div>
              <h3 className="font-bold text-slate-900">Immutable Terms</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                The freelancer accepts the exact terms hash before the client funds the contract.
              </p>
            </div>

            <div className="p-6 bg-white rounded-xl border border-slate-200 shadow-sm space-y-3">
              <div className="h-8 w-8 rounded bg-blue-50 text-blue-700 flex items-center justify-center">
                <Globe className="h-5 w-5" />
              </div>
              <h3 className="font-bold text-slate-900">Deployment Verification</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                The workroom checks deployed code and immutable roles against the local artifact.
              </p>
            </div>

            <div className="p-6 bg-white rounded-xl border border-slate-200 shadow-sm space-y-3">
              <div className="h-8 w-8 rounded bg-blue-50 text-blue-700 flex items-center justify-center">
                <Zap className="h-5 w-5" />
              </div>
              <h3 className="font-bold text-slate-900">Read Test Balances</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Check gas and token balances before signing with your wallet.
              </p>
            </div>

            <div className="p-6 bg-white rounded-xl border border-slate-200 shadow-sm space-y-3">
              <div className="h-8 w-8 rounded bg-blue-50 text-blue-700 flex items-center justify-center">
                <Globe className="h-5 w-5" />
              </div>
              <h3 className="font-bold text-slate-900">Verified Solana Destination</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                The explicit sweep checks the mint and owner of the destination token account.
              </p>
            </div>

            <div className="p-6 bg-white rounded-xl border border-slate-200 shadow-sm space-y-3">
              <div className="h-8 w-8 rounded bg-blue-50 text-blue-700 flex items-center justify-center">
                <Lock className="h-5 w-5" />
              </div>
              <h3 className="font-bold text-slate-900">Receipt Recovery</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Reconcile the original transaction after a timeout before sending again.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 6. Demo Mode CTA Card */}
      <section className="py-16 bg-white">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
          <div className="bg-slate-900 text-white rounded-2xl p-8 md:p-12 border border-slate-800 relative overflow-hidden shadow-xl text-center space-y-6">
            <div className="absolute top-0 right-0 p-4 opacity-5">
              <Shield className="h-64 w-64" />
            </div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-500/10 text-blue-400 text-xs font-semibold border border-blue-500/20">
              <AlertCircle className="h-3.5 w-3.5" />
              <span>Developer Demo Mode Active</span>
            </div>
            <h2 className="text-3xl md:text-4xl font-extrabold tracking-tight">
              Try FreelanceGuard in Sandbox
            </h2>
            <p className="text-slate-400 max-w-2xl mx-auto text-sm md:text-base">
              Explore the original FreelanceGuard dashboard with local sample data.
              Sandbox actions only update sample data. Hadrian transactions are in the workroom.
            </p>
            <div>
              <Button
                onClick={handleDemoMode}
                disabled={demoLoading}
                aria-busy={demoLoading}
                className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-8 rounded-lg text-base shadow-md transition-all inline-flex items-center gap-2"
              >
                {demoLoading ? 'Preparing Demo...' : 'Launch App Demo'}
                {demoLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : <ArrowRight className="h-5 w-5" />}
              </Button>
              {demoError && <p className="mt-3 text-sm text-red-300">{demoError}</p>}
            </div>
          </div>
        </div>
      </section>

      {/* 7. Built On Section */}
      <section className="py-12 bg-slate-50 border-t border-slate-200">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 text-center space-y-4">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Built On Core Ecosystems</p>
          <div className="flex flex-wrap justify-center items-center gap-8 md:gap-16 opacity-60 grayscale hover:opacity-85 transition-opacity">
            <div className="flex items-center gap-1.5 text-slate-900 font-extrabold text-sm">
              <Shield className="h-5 w-5 text-blue-700" />
              <span>ROME HADRIAN</span>
            </div>
            <div className="flex items-center gap-1.5 text-slate-900 font-extrabold text-sm">
              <UserCheck className="h-5 w-5 text-blue-700" />
              <span>SOLANA DEVNET</span>
            </div>
            <div className="flex items-center gap-1.5 text-slate-900 font-extrabold text-sm">
              <span>WALLET STANDARD</span>
            </div>
            <div className="flex items-center gap-1.5 text-slate-900 font-extrabold text-sm">
              <span>NEXT.JS + TAILWIND</span>
            </div>
          </div>
        </div>
      </section>

      <EmailAuth open={authOpen} onOpenChange={setAuthOpen} />
    </div>
  );
}
