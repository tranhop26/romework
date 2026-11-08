'use client';

import Link from 'next/link';
import { useState } from 'react';
import { usePathname } from 'next/navigation';
import { useAuthStore } from '@/lib/stores/authStore';
import { WalletBalance } from '@/components/wallet/WalletBalance';
import { EmailAuth } from '@/components/auth/EmailAuth';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Menu, X, PlusCircle, LayoutDashboard, Search, User, LogOut, Shield } from 'lucide-react';

export function Navbar() {
  const pathname = usePathname();
  const { user, logout } = useAuthStore();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [authModalOpen, setAuthModalOpen] = useState(false);

  const isActive = (path: string) => pathname === path;

  return (
    <>
      <header className="sticky top-0 z-50 w-full border-b border-slate-200 bg-white/80 backdrop-blur-md">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            {/* Logo */}
            <div className="flex items-center">
              <Link href="/" className="flex items-center gap-2 font-bold text-lg text-slate-900">
                <Shield className="h-6 w-6 text-blue-700" />
                <span>RomeWork</span>
              </Link>
            </div>

            {/* Desktop Navigation */}
            {user && (
              <nav className="hidden md:flex items-center gap-6">
                <Link
                  href="/dashboard"
                  className={`flex items-center gap-1.5 text-sm font-medium transition-colors hover:text-blue-700 ${
                    isActive('/dashboard') ? 'text-blue-700' : 'text-slate-600'
                  }`}
                >
                  <LayoutDashboard className="h-4 w-4" />
                  Dashboard
                </Link>
                <Link
                  href="/jobs/browse"
                  className={`flex items-center gap-1.5 text-sm font-medium transition-colors hover:text-blue-700 ${
                    isActive('/jobs/browse') ? 'text-blue-700' : 'text-slate-600'
                  }`}
                >
                  <Search className="h-4 w-4" />
                  Browse Jobs
                </Link>
                {(user.role === 'client' || user.role === 'both') && (
                  <Link
                    href="/jobs/new"
                    className={`flex items-center gap-1.5 text-sm font-medium transition-colors hover:text-blue-700 ${
                      isActive('/jobs/new') ? 'text-blue-700' : 'text-slate-600'
                    }`}
                  >
                    <PlusCircle className="h-4 w-4" />
                    Post a Job
                  </Link>
                )}
              </nav>
            )}

            {/* Right Side Widgets / Actions */}
            <div className="hidden md:flex items-center gap-4">
              <Link href="/rome" className="text-sm font-semibold text-blue-700 hover:underline">Hadrian Workroom</Link>
              {user ? (
                <>
                  {user.wallet_address && <WalletBalance address={user.wallet_address} />}
                  <DropdownMenu>
                    <DropdownMenuTrigger
                      render={
                        <button className="rounded-full focus:outline-none focus:ring-2 focus:ring-blue-700 focus:ring-offset-2">
                          <Avatar className="h-9 w-9 border border-slate-200">
                            <AvatarFallback className="bg-blue-100 text-blue-700 font-semibold text-sm">
                              {user.email.substring(0, 2).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                        </button>
                      }
                    />
                    <DropdownMenuContent className="w-56 bg-white border border-slate-200 rounded-lg shadow-lg" align="end">
                      <DropdownMenuLabel className="font-normal">
                        <div className="flex flex-col space-y-1">
                          <p className="text-sm font-semibold text-slate-800">{user.display_name || 'User Profile'}</p>
                          <p className="text-xs text-slate-500 truncate">{user.email}</p>
                        </div>
                      </DropdownMenuLabel>
                      <DropdownMenuSeparator className="bg-slate-100" />
                      {user.wallet_address && (
                        <DropdownMenuItem
                          render={
                            <Link
                              href={`/profile/${user.wallet_address}`}
                              className="flex items-center gap-2 cursor-pointer text-slate-700 hover:text-slate-900"
                            >
                              <User className="h-4 w-4" />
                              My Reputation Profile
                            </Link>
                          }
                        />
                      )}
                      <DropdownMenuSeparator className="bg-slate-100" />
                      <DropdownMenuItem
                        onClick={() => logout()}
                        className="flex items-center gap-2 text-red-600 focus:text-red-700 cursor-pointer"
                      >
                        <LogOut className="h-4 w-4" />
                        Log Out
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </>
              ) : (
                <Button
                  onClick={() => setAuthModalOpen(true)}
                  className="bg-blue-700 hover:bg-blue-800 text-white font-medium py-1.5 px-4 rounded-md transition-all shadow-sm"
                >
                  Enter App
                </Button>
              )}
            </div>

            {/* Mobile Menu Button */}
            <div className="flex md:hidden items-center gap-2">
              {!isActive('/rome') && <Link href="/rome" className="text-sm font-semibold text-blue-700 hover:underline">Workroom</Link>}
              {!isActive('/rome') && user?.wallet_address && <WalletBalance address={user.wallet_address} />}
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-700 focus:outline-none"
              >
                {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Menu Panel */}
        {mobileMenuOpen && user && (
          <div className="border-b border-slate-200 bg-white px-4 py-3 md:hidden space-y-3">
            <Link
              href="/dashboard"
              onClick={() => setMobileMenuOpen(false)}
              className="flex items-center gap-2 py-2 text-sm font-semibold text-slate-700 hover:text-blue-700"
            >
              <LayoutDashboard className="h-4 w-4" />
              Dashboard
            </Link>
            <Link
              href="/jobs/browse"
              onClick={() => setMobileMenuOpen(false)}
              className="flex items-center gap-2 py-2 text-sm font-semibold text-slate-700 hover:text-blue-700"
            >
              <Search className="h-4 w-4" />
              Browse Jobs
            </Link>
            {(user.role === 'client' || user.role === 'both') && (
              <Link
                href="/jobs/new"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center gap-2 py-2 text-sm font-semibold text-slate-700 hover:text-blue-700"
              >
                <PlusCircle className="h-4 w-4" />
                Post a Job
              </Link>
            )}
            {user.wallet_address && (
              <Link
                href={`/profile/${user.wallet_address}`}
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center gap-2 py-2 text-sm font-semibold text-slate-700 hover:text-blue-700"
              >
                <User className="h-4 w-4" />
                My Profile
              </Link>
            )}
            <hr className="border-slate-100" />
            <button
              onClick={() => {
                setMobileMenuOpen(false);
                logout();
              }}
              className="flex w-full items-center gap-2 py-2 text-sm font-semibold text-red-600"
            >
              <LogOut className="h-4 w-4" />
              Log Out
            </button>
          </div>
        )}
      </header>

      <EmailAuth open={authModalOpen} onOpenChange={setAuthModalOpen} />
    </>
  );
}
