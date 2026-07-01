'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { CheckCircle2, Crown } from 'lucide-react';
import { useAuth } from '@/app/providers';
import { Background } from '@/components/Background';
import { Logo } from '@/components/Logo';

export default function PaymentSuccessPage() {
  const { refreshMe } = useAuth();
  useEffect(() => {
    refreshMe().catch(() => {});
  }, [refreshMe]);

  return (
    <div className="relative flex min-h-screen flex-col">
      <Background />
      <header className="mx-auto flex h-16 w-full max-w-6xl items-center px-4 sm:px-6">
        <Logo />
      </header>
      <main className="flex flex-1 items-center justify-center px-4 py-10">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-md rounded-3xl glass-strong p-8 text-center shadow-glow-lg"
        >
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', damping: 12, stiffness: 200, delay: 0.1 }}
            className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-emerald-500/15"
          >
            <CheckCircle2 className="h-11 w-11 text-emerald-400" />
          </motion.div>
          <h1 className="mt-6 font-display text-3xl font-bold text-white">
            You’re Premium! <Crown className="ml-1 inline h-6 w-6 text-amber-400" />
          </h1>
          <p className="mt-2 text-white/60">
            Your subscription is active. Unlimited filters, priority matching and
            an ad-free experience are now unlocked.
          </p>
          <Link href="/chat" className="btn-primary mt-7 inline-flex h-12 w-full items-center justify-center">
            Start meeting people
          </Link>
          <Link
            href="/"
            className="mt-3 inline-block w-full text-center text-sm text-white/45 hover:text-white/70"
          >
            Back to home
          </Link>
        </motion.div>
      </main>
    </div>
  );
}
