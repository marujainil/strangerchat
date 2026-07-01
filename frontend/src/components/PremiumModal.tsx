'use client';

import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Crown, X, Check } from 'lucide-react';

const PERKS = [
  'Unlimited advanced filters',
  'Country, gender, age & interest matching',
  'Premium matching priority',
  'Verified badge eligibility',
  'Ad-free experience',
];

export function PremiumModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 z-[90] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
        >
          <motion.div
            initial={{ scale: 0.94, y: 16, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.94, y: 16, opacity: 0 }}
            transition={{ type: 'spring', damping: 24, stiffness: 280 }}
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-md overflow-hidden rounded-3xl glass-strong p-6 shadow-glow-lg"
          >
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="absolute right-4 top-4 text-white/40 hover:text-white"
            >
              <X className="h-5 w-5" />
            </button>
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-violet-grad shadow-glow">
              <Crown className="h-7 w-7 text-white" />
            </div>
            <h2 className="font-display text-2xl font-bold text-white">
              Unlock StrangerChat Premium
            </h2>
            <p className="mt-1.5 text-sm text-white/60">
              Your free 3 minutes of daily filtering is up. Go Premium for
              unlimited control over who you meet.
            </p>
            <ul className="mt-5 space-y-2.5">
              {PERKS.map((p) => (
                <li key={p} className="flex items-center gap-2 text-sm text-white/80">
                  <Check className="h-4 w-4 text-violet-glow" />
                  {p}
                </li>
              ))}
            </ul>
            <div className="mt-6 flex items-center gap-2">
              <button
                type="button"
                onClick={() => router.push('/premium')}
                className="btn-primary h-12 flex-1"
              >
                View plans · from ₹69
              </button>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="mt-2 w-full text-center text-xs text-white/40 hover:text-white/70"
            >
              Continue with random matching
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
