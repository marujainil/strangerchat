'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { XCircle } from 'lucide-react';
import { Background } from '@/components/Background';
import { Logo } from '@/components/Logo';

export default function PaymentFailedPage() {
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
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-rose-500/15">
            <XCircle className="h-11 w-11 text-rose-400" />
          </div>
          <h1 className="mt-6 font-display text-3xl font-bold text-white">
            Payment didn’t go through
          </h1>
          <p className="mt-2 text-white/60">
            No charge was made. This can happen if the payment was cancelled or
            interrupted. You can safely try again.
          </p>
          <Link href="/premium" className="btn-primary mt-7 inline-flex h-12 w-full items-center justify-center">
            Try again
          </Link>
          <Link
            href="/chat"
            className="mt-3 inline-block w-full text-center text-sm text-white/45 hover:text-white/70"
          >
            Continue with free chat
          </Link>
        </motion.div>
      </main>
    </div>
  );
}
