'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useAuthStore } from '@/lib/stores/authStore';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { RefreshCw, ArrowLeftRight, LogOut, Sparkles } from 'lucide-react';
import { useState, useEffect, Suspense } from 'react';

function DemoBannerContent() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { user, logout, setUser } = useAuthStore();
  const [loading, setLoading] = useState(false);
  const [showBanner, setShowBanner] = useState(false);

  useEffect(() => {
    if (user?.email?.endsWith('@demo.freelanceguard.app') || searchParams?.get('demo') === 'true') {
      setShowBanner(true);
    } else {
      setShowBanner(false);
    }
  }, [user, searchParams]);

  if (pathname === '/rome' || !showBanner || !user) return null;

  const isClient = user.email === 'sarah@demo.freelanceguard.app';
  const roleName = isClient ? 'Sarah Chen (Client)' : 'Minh Nguyen (Freelancer)';
  const switchTargetName = isClient ? 'Minh (Freelancer)' : 'Sarah (Client)';

  const handleSwitchRole = async () => {
    setLoading(true);
    toast.loading('Switching session role...', { id: 'switch' });
    try {
      const res = await fetch('/api/seed/switch', { method: 'POST' });
      if (!res.ok) throw new Error('Switch failed');
      const data = await res.json();
      if (data.success) {
        setUser(data.user);
        toast.success(`Switched role to ${data.user.display_name}`, { id: 'switch' });
        router.push('/dashboard?demo=true');
        router.refresh();
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to switch role', { id: 'switch' });
    } finally {
      setLoading(false);
    }
  };

  const handleResetDemo = async () => {
    setLoading(true);
    toast.loading('Resetting sandbox database...', { id: 'reset' });
    try {
      const res = await fetch('/api/seed/reset', { method: 'POST' });
      if (!res.ok) throw new Error('Reset failed');
      const data = await res.json();
      if (data.success) {
        setUser(data.demo_user);
        toast.success('Sandbox database reset completed!', { id: 'reset' });
        router.push('/dashboard?demo=true');
        router.refresh();
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to reset demo', { id: 'reset' });
    } finally {
      setLoading(false);
    }
  };

  const handleExitDemo = async () => {
    setLoading(true);
    toast.loading('Exiting demo sandbox...', { id: 'exit' });
    try {
      await logout();
      toast.success('Logged out from sandbox!', { id: 'exit' });
      router.push('/');
      router.refresh();
    } catch (err: any) {
      toast.error(err.message || 'Failed to exit', { id: 'exit' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full bg-slate-900 border-b border-slate-800 px-4 py-2 text-white flex flex-col sm:flex-row items-center justify-between gap-3 text-xs z-50 relative select-none">
      <div className="flex items-center gap-1.5 font-medium text-slate-200">
        <Sparkles className="h-4 w-4 text-orange-500 animate-pulse" />
        <span>🎭 You are in <strong>Demo Sandbox · local sample data</strong> as <span className="text-blue-400 font-bold">{roleName}</span></span>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button
          onClick={handleSwitchRole}
          variant="ghost"
          size="sm"
          className="text-slate-300 hover:text-white hover:bg-slate-800 text-[11px] h-7 px-2.5 font-bold flex items-center gap-1 border border-slate-700/50"
          disabled={loading}
        >
          <ArrowLeftRight className="h-3.5 w-3.5 text-blue-400" />
          Switch to {switchTargetName}
        </Button>
        
        <Button
          onClick={handleResetDemo}
          variant="ghost"
          size="sm"
          className="text-slate-300 hover:text-white hover:bg-slate-800 text-[11px] h-7 px-2.5 font-bold flex items-center gap-1 border border-slate-700/50"
          disabled={loading}
        >
          <RefreshCw className="h-3.5 w-3.5 text-emerald-500" />
          Reset Sandbox
        </Button>

        <Button
          onClick={handleExitDemo}
          variant="ghost"
          size="sm"
          className="text-slate-300 hover:text-red-400 hover:bg-slate-800 text-[11px] h-7 px-2.5 font-bold flex items-center gap-1 border border-slate-700/50"
          disabled={loading}
        >
          <LogOut className="h-3.5 w-3.5 text-red-500" />
          Exit Demo
        </Button>
      </div>
    </div>
  );
}

export function DemoBanner() {
  return (
    <Suspense fallback={null}>
      <DemoBannerContent />
    </Suspense>
  );
}
