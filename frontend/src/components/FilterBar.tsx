'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  SlidersHorizontal,
  Lock,
  Video,
  Phone,
  MessageSquare,
  ChevronDown,
  Check,
  X,
} from 'lucide-react';
import type {
  ChatMode,
  Country,
  Gender,
  Interest,
  MatchFilters,
  RelationshipStatus,
} from '@/lib/types';

const GENDERS: { value: Gender; label: string }[] = [
  { value: 'MALE', label: 'Male' },
  { value: 'FEMALE', label: 'Female' },
  { value: 'NONBINARY', label: 'Non-binary' },
];

const RELATIONSHIPS: { value: RelationshipStatus; label: string }[] = [
  { value: 'SINGLE', label: 'Single' },
  { value: 'TAKEN', label: 'Taken' },
  { value: 'COMPLICATED', label: 'Complicated' },
];

const LANGUAGES = [
  'English', 'Hindi', 'Spanish', 'French', 'German', 'Portuguese',
  'Arabic', 'Russian', 'Japanese', 'Korean', 'Chinese', 'Italian',
];

function Toggle({
  on,
  onClick,
  label,
  disabled,
}: {
  on: boolean;
  onClick: () => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5 text-sm text-white/80 transition hover:bg-white/[0.06] disabled:opacity-40"
    >
      <span>{label}</span>
      <span
        className={`relative h-5 w-9 rounded-full transition ${on ? 'bg-violet' : 'bg-white/15'}`}
      >
        <span
          className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all ${on ? 'left-[18px]' : 'left-0.5'}`}
        />
      </span>
    </button>
  );
}

function CheckList<T extends string>({
  label,
  options,
  selected,
  onToggle,
  disabled,
}: {
  label: string;
  options: { value: T; label: string }[];
  selected: T[];
  onToggle: (v: T) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5 text-sm text-white/80 transition hover:bg-white/[0.06] disabled:opacity-40"
      >
        <span>
          {label}
          {selected.length > 0 && (
            <span className="ml-1.5 rounded-full bg-violet/30 px-1.5 text-xs text-violet-glow">
              {selected.length}
            </span>
          )}
        </span>
        <ChevronDown
          className={`h-4 w-4 transition ${open ? 'rotate-180' : ''}`}
        />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            className="absolute z-30 mt-1.5 max-h-56 w-full overflow-y-auto rounded-xl glass-strong p-1.5 shadow-glass"
          >
            {options.map((o) => {
              const isSel = selected.includes(o.value);
              return (
                <button
                  key={o.value}
                  type="button"
                  onClick={() => onToggle(o.value)}
                  className="flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-sm text-white/80 hover:bg-white/10"
                >
                  {o.label}
                  {isSel && <Check className="h-4 w-4 text-violet-glow" />}
                </button>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function FilterBar({
  mode,
  onModeChange,
  filters,
  onChange,
  countries,
  interests,
  isPremium,
  locked,
  remainingSec,
  onUpgrade,
  busy,
}: {
  mode: ChatMode;
  onModeChange: (m: ChatMode) => void;
  filters: MatchFilters;
  onChange: (f: MatchFilters) => void;
  countries: Country[];
  interests: Interest[];
  isPremium: boolean;
  locked: boolean;
  remainingSec: number | null;
  onUpgrade: () => void;
  busy: boolean;
}) {
  const [expanded, setExpanded] = useState(false);

  const toggleInArray = <T,>(arr: T[] | undefined, v: T): T[] => {
    const a = arr ?? [];
    return a.includes(v) ? a.filter((x) => x !== v) : [...a, v];
  };

  const activeCount =
    (filters.genders?.length ?? 0) +
    (filters.countries?.length ?? 0) +
    (filters.languages?.length ?? 0) +
    (filters.interests?.length ?? 0) +
    (filters.relationship ? 1 : 0) +
    (filters.onlyVerified ? 1 : 0) +
    (filters.onlyPremium ? 1 : 0) +
    (filters.newUsersOnly ? 1 : 0) +
    (filters.ageMin || filters.ageMax ? 1 : 0) +
    (filters.distanceKm ? 1 : 0);

  return (
    <div className="flex flex-col gap-3 rounded-3xl glass p-3 sm:p-4">
      {/* Mode selector */}
      <div className="grid grid-cols-3 gap-1.5 rounded-2xl bg-black/30 p-1.5">
        {(
          [
            { m: 'VIDEO' as ChatMode, icon: Video, label: 'Video' },
            { m: 'AUDIO' as ChatMode, icon: Phone, label: 'Audio' },
            { m: 'TEXT' as ChatMode, icon: MessageSquare, label: 'Text' },
          ]
        ).map(({ m, icon: Icon, label }) => (
          <button
            key={m}
            type="button"
            onClick={() => onModeChange(m)}
            disabled={busy}
            className={`relative flex items-center justify-center gap-1.5 rounded-xl py-2.5 text-sm font-medium transition disabled:opacity-50 ${
              mode === m ? 'text-white' : 'text-white/50 hover:text-white/80'
            }`}
          >
            {mode === m && (
              <motion.span
                layoutId="mode-pill"
                className="absolute inset-0 rounded-xl bg-violet-grad shadow-glow"
              />
            )}
            <Icon className="relative h-4 w-4" />
            <span className="relative">{label}</span>
          </button>
        ))}
      </div>

      {/* Filter header */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => setExpanded((e) => !e)}
          className="flex items-center gap-2 text-sm font-semibold text-white"
        >
          <SlidersHorizontal className="h-4 w-4 text-violet-glow" />
          Filters
          {activeCount > 0 && (
            <span className="rounded-full bg-violet/30 px-1.5 text-xs text-violet-glow">
              {activeCount}
            </span>
          )}
          <ChevronDown
            className={`h-4 w-4 transition ${expanded ? 'rotate-180' : ''}`}
          />
        </button>
        {!isPremium && (
          <span className="flex items-center gap-1 text-xs text-white/50">
            {locked ? (
              <>
                <Lock className="h-3 w-3 text-amber-400" /> Daily limit reached
              </>
            ) : remainingSec !== null ? (
              <>
                <span className="text-violet-glow">
                  {Math.max(0, Math.ceil(remainingSec))}s
                </span>{' '}
                free filtering left
              </>
            ) : (
              'Free 3 min/day'
            )}
          </span>
        )}
      </div>

      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="relative space-y-3 pt-1">
              {/* Lock overlay for free users who exhausted quota */}
              {locked && (
                <div className="absolute inset-0 z-20 -m-1 flex flex-col items-center justify-center gap-3 rounded-2xl bg-ink-900/85 p-4 text-center backdrop-blur-sm">
                  <Lock className="h-7 w-7 text-amber-400" />
                  <p className="font-display text-sm font-semibold text-white">
                    You&apos;ve used your free filtering for today
                  </p>
                  <p className="text-xs text-white/50">
                    Upgrade to Premium for unlimited filters
                  </p>
                  <button
                    type="button"
                    onClick={onUpgrade}
                    className="btn-primary h-10"
                  >
                    Go Premium
                  </button>
                </div>
              )}

              {/* Gender */}
              <div>
                <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-white/40">
                  Gender
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {GENDERS.map((g) => {
                    const sel = filters.genders?.includes(g.value);
                    return (
                      <button
                        key={g.value}
                        type="button"
                        disabled={locked}
                        onClick={() =>
                          onChange({
                            ...filters,
                            genders: toggleInArray(filters.genders, g.value),
                          })
                        }
                        className={`rounded-full border px-3 py-1.5 text-sm transition disabled:opacity-40 ${
                          sel
                            ? 'border-violet bg-violet/20 text-white'
                            : 'border-white/10 text-white/60 hover:bg-white/5'
                        }`}
                      >
                        {g.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Country + Interest + Language checklists */}
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                <CheckList
                  label="Country"
                  disabled={locked}
                  options={countries.map((c) => ({
                    value: c.code,
                    label: `${c.flagEmoji} ${c.name}`,
                  }))}
                  selected={filters.countries ?? []}
                  onToggle={(v) =>
                    onChange({
                      ...filters,
                      countries: toggleInArray(filters.countries, v),
                    })
                  }
                />
                <CheckList
                  label="Interest"
                  disabled={locked}
                  options={interests.map((i) => ({
                    value: i.slug,
                    label: i.label,
                  }))}
                  selected={filters.interests ?? []}
                  onToggle={(v) =>
                    onChange({
                      ...filters,
                      interests: toggleInArray(filters.interests, v),
                    })
                  }
                />
                <CheckList
                  label="Language"
                  disabled={locked}
                  options={LANGUAGES.map((l) => ({ value: l, label: l }))}
                  selected={filters.languages ?? []}
                  onToggle={(v) =>
                    onChange({
                      ...filters,
                      languages: toggleInArray(filters.languages, v),
                    })
                  }
                />
              </div>

              {/* Age range + distance */}
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2">
                  <p className="mb-1 text-xs text-white/40">Age range</p>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min={18}
                      max={120}
                      disabled={locked}
                      placeholder="18"
                      value={filters.ageMin ?? ''}
                      onChange={(e) =>
                        onChange({
                          ...filters,
                          ageMin: e.target.value
                            ? Number(e.target.value)
                            : undefined,
                        })
                      }
                      className="w-full bg-transparent text-sm text-white outline-none"
                    />
                    <span className="text-white/30">–</span>
                    <input
                      type="number"
                      min={18}
                      max={120}
                      disabled={locked}
                      placeholder="99"
                      value={filters.ageMax ?? ''}
                      onChange={(e) =>
                        onChange({
                          ...filters,
                          ageMax: e.target.value
                            ? Number(e.target.value)
                            : undefined,
                        })
                      }
                      className="w-full bg-transparent text-sm text-white outline-none"
                    />
                  </div>
                </div>
                <div className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2">
                  <p className="mb-1 text-xs text-white/40">
                    Max distance{' '}
                    {filters.distanceKm ? `· ${filters.distanceKm} km` : ''}
                  </p>
                  <input
                    type="range"
                    min={0}
                    max={20000}
                    step={100}
                    disabled={locked}
                    value={filters.distanceKm ?? 0}
                    onChange={(e) =>
                      onChange({
                        ...filters,
                        distanceKm: Number(e.target.value) || undefined,
                      })
                    }
                    className="w-full accent-violet"
                  />
                </div>
              </div>

              {/* Relationship */}
              <div>
                <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-white/40">
                  Relationship
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {RELATIONSHIPS.map((r) => {
                    const sel = filters.relationship === r.value;
                    return (
                      <button
                        key={r.value}
                        type="button"
                        disabled={locked}
                        onClick={() =>
                          onChange({
                            ...filters,
                            relationship: sel ? undefined : r.value,
                          })
                        }
                        className={`rounded-full border px-3 py-1.5 text-sm transition disabled:opacity-40 ${
                          sel
                            ? 'border-violet bg-violet/20 text-white'
                            : 'border-white/10 text-white/60 hover:bg-white/5'
                        }`}
                      >
                        {r.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Toggles */}
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                <Toggle
                  label="Verified only"
                  disabled={locked}
                  on={!!filters.onlyVerified}
                  onClick={() =>
                    onChange({ ...filters, onlyVerified: !filters.onlyVerified })
                  }
                />
                <Toggle
                  label="Premium only"
                  disabled={locked}
                  on={!!filters.onlyPremium}
                  onClick={() =>
                    onChange({ ...filters, onlyPremium: !filters.onlyPremium })
                  }
                />
                <Toggle
                  label="New users"
                  disabled={locked}
                  on={!!filters.newUsersOnly}
                  onClick={() =>
                    onChange({ ...filters, newUsersOnly: !filters.newUsersOnly })
                  }
                />
              </div>

              {activeCount > 0 && (
                <button
                  type="button"
                  disabled={locked}
                  onClick={() => onChange({})}
                  className="flex items-center gap-1.5 text-xs text-white/50 hover:text-white/80"
                >
                  <X className="h-3.5 w-3.5" /> Clear all filters
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
