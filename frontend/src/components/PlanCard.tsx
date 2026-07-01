'use client';

import { Check, Crown } from 'lucide-react';
import type { Plan } from '@/lib/types';

const INTERVAL_LABEL: Record<Plan['interval'], string> = {
  MONTHLY: '/month',
  HALF_YEARLY: '/6 months',
  YEARLY: '/year',
};

export function PlanCard({
  plan,
  popular,
  loading,
  onSelect,
}: {
  plan: Plan;
  popular?: boolean;
  loading?: boolean;
  onSelect: (plan: Plan) => void;
}) {
  return (
    <div
      className={`relative flex flex-col rounded-3xl p-6 transition ${
        popular
          ? 'glass-strong shadow-glow-lg ring-1 ring-violet/50'
          : 'glass hover:bg-white/[0.06]'
      }`}
    >
      {popular && (
        <span className="absolute -top-3 left-1/2 flex -translate-x-1/2 items-center gap-1 rounded-full bg-violet-grad px-3 py-1 text-xs font-semibold text-white shadow-glow">
          <Crown className="h-3 w-3" /> Most popular
        </span>
      )}
      <h3 className="font-display text-lg font-semibold text-white">
        {plan.name}
      </h3>
      <div className="mt-3 flex items-end gap-1">
        <span className="font-display text-4xl font-bold gradient-text">
          ₹{plan.priceInr}
        </span>
        <span className="mb-1 text-sm text-white/50">
          {INTERVAL_LABEL[plan.interval]}
        </span>
      </div>
      <ul className="mt-5 flex-1 space-y-2.5">
        {plan.features.map((f) => (
          <li key={f} className="flex items-start gap-2 text-sm text-white/75">
            <Check className="mt-0.5 h-4 w-4 shrink-0 text-violet-glow" />
            {f}
          </li>
        ))}
      </ul>
      <button
        type="button"
        disabled={loading}
        onClick={() => onSelect(plan)}
        className={`mt-6 h-12 ${popular ? 'btn-primary' : 'btn-ghost'}`}
      >
        {loading ? 'Please wait…' : `Choose ${plan.name}`}
      </button>
    </div>
  );
}
