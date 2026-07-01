'use client';

import { motion } from 'framer-motion';

export function OnlineCounter({
  online,
  waiting,
}: {
  online: number;
  waiting?: number;
}) {
  return (
    <div className="glass flex items-center gap-2 rounded-full px-3.5 py-1.5">
      <span className="relative flex h-2.5 w-2.5">
        <span className="absolute inline-flex h-full w-full animate-pulse-ring rounded-full bg-emerald-400" />
        <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-400" />
      </span>
      <motion.span
        key={online}
        initial={{ opacity: 0, y: -4 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-sm font-semibold tabular-nums text-white"
      >
        {online.toLocaleString()}
      </motion.span>
      <span className="text-xs text-white/50">online</span>
      {typeof waiting === 'number' && waiting > 0 && (
        <span className="ml-1 hidden text-xs text-white/40 sm:inline">
          · {waiting} waiting
        </span>
      )}
    </div>
  );
}
