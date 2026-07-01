'use client';

import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Flag, X } from 'lucide-react';

const REASONS: { value: string; label: string }[] = [
  { value: 'NUDITY', label: 'Nudity / sexual content' },
  { value: 'HARASSMENT', label: 'Harassment or hate' },
  { value: 'MINOR', label: 'Appears underage' },
  { value: 'VIOLENCE', label: 'Violence or threats' },
  { value: 'SPAM', label: 'Spam or advertising' },
  { value: 'OTHER', label: 'Something else' },
];

export function ReportModal({
  open,
  onClose,
  onSubmit,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (reason: string, details: string) => void;
}) {
  const [reason, setReason] = useState<string>('HARASSMENT');
  const [details, setDetails] = useState('');

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 z-[95] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
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
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-500/20">
              <Flag className="h-6 w-6 text-rose-300" />
            </div>
            <h2 className="font-display text-xl font-bold text-white">Report this user</h2>
            <p className="mt-1 text-sm text-white/60">
              Reports are anonymous. Repeat offenders are automatically banned.
            </p>

            <div className="mt-5 space-y-2">
              {REASONS.map((r) => (
                <button
                  key={r.value}
                  type="button"
                  onClick={() => setReason(r.value)}
                  className={`flex w-full items-center justify-between rounded-xl border px-4 py-3 text-left text-sm transition ${
                    reason === r.value
                      ? 'border-violet/60 bg-violet/15 text-white'
                      : 'border-white/10 bg-white/[0.03] text-white/70 hover:bg-white/[0.06]'
                  }`}
                >
                  {r.label}
                  <span
                    className={`h-4 w-4 rounded-full border ${
                      reason === r.value ? 'border-violet bg-violet' : 'border-white/30'
                    }`}
                  />
                </button>
              ))}
            </div>

            <textarea
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              rows={3}
              maxLength={500}
              placeholder="Add details (optional)"
              className="input mt-4 resize-none"
            />

            <div className="mt-5 flex gap-2">
              <button type="button" onClick={onClose} className="btn-ghost h-11 flex-1">
                Cancel
              </button>
              <button
                type="button"
                onClick={() => onSubmit(reason, details)}
                className="btn-danger h-11 flex-1"
              >
                Submit report
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
