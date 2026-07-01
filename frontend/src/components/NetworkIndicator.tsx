'use client';

import type { NetworkQuality } from '@/lib/types';

const META: Record<
  NetworkQuality,
  { label: string; color: string; bars: number }
> = {
  excellent: { label: 'Excellent', color: '#34d399', bars: 4 },
  good: { label: 'Good', color: '#a3e635', bars: 3 },
  fair: { label: 'Fair', color: '#fbbf24', bars: 2 },
  poor: { label: 'Poor', color: '#f87171', bars: 1 },
  unknown: { label: 'Connecting', color: '#94a3b8', bars: 0 },
};

export function NetworkIndicator({ quality }: { quality: NetworkQuality }) {
  const m = META[quality];
  return (
    <div
      className="glass flex items-center gap-2 rounded-full px-3 py-1.5"
      title={`Network: ${m.label}`}
    >
      <span className="flex items-end gap-0.5">
        {[1, 2, 3, 4].map((b) => (
          <span
            key={b}
            className="w-1 rounded-sm transition-all"
            style={{
              height: `${b * 3 + 3}px`,
              backgroundColor: b <= m.bars ? m.color : 'rgba(255,255,255,0.15)',
            }}
          />
        ))}
      </span>
      <span className="text-xs font-medium" style={{ color: m.color }}>
        {m.label}
      </span>
    </div>
  );
}
