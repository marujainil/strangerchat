'use client';

import Link from 'next/link';
import { Crown, LogIn, User as UserIcon } from 'lucide-react';
import { Logo } from './Logo';
import { useAuth } from '@/app/providers';

export function Navbar({ online }: { online?: React.ReactNode }) {
  const { user, loading } = useAuth();
  return (
    <header className="sticky top-0 z-50 border-b border-white/5 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
        <Logo />
        <div className="flex items-center gap-2 sm:gap-3">
          {online}
          <Link href="/premium" className="hidden sm:block">
            <span className="chip border-violet/30 text-violet-glow">
              <Crown className="h-3.5 w-3.5" /> Premium
            </span>
          </Link>
          {loading ? (
            <span className="h-9 w-20 rounded-xl shimmer" />
          ) : user && !user.isGuest ? (
            <span className="glass flex items-center gap-2 rounded-xl px-3 py-2 text-sm text-white">
              <UserIcon className="h-4 w-4 text-violet-glow" />
              <span className="max-w-[100px] truncate">
                {user.displayName || user.email || 'You'}
              </span>
              {user.isPremium && <Crown className="h-3.5 w-3.5 text-amber-400" />}
            </span>
          ) : (
            <Link href="/login" className="btn-ghost h-9 !py-2 text-sm">
              <LogIn className="h-4 w-4" /> Log in
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
