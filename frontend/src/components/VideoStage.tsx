'use client';

import { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mic, MicOff, Video, VideoOff, BadgeCheck, Crown } from 'lucide-react';
import type { ChatMode, NetworkQuality, PublicPartner } from '@/lib/types';
import { CountryFlag } from './CountryFlag';
import { NetworkIndicator } from './NetworkIndicator';

export type StageStatus =
  | 'idle'
  | 'searching'
  | 'connecting'
  | 'connected'
  | 'left';

function fmt(sec: number) {
  const m = Math.floor(sec / 60)
    .toString()
    .padStart(2, '0');
  const s = Math.floor(sec % 60)
    .toString()
    .padStart(2, '0');
  return `${m}:${s}`;
}

const GENDER_TINT: Record<string, string> = {
  MALE: 'text-sky-300',
  FEMALE: 'text-pink-300',
  NONBINARY: 'text-violet-300',
  UNKNOWN: 'text-white/50',
};

export function VideoStage({
  mode,
  status,
  localStream,
  remoteStream,
  partner,
  elapsed,
  localVideoEnabled,
  partnerAudioOn,
  partnerVideoOn,
  quality,
}: {
  mode: ChatMode;
  status: StageStatus;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  partner: PublicPartner | null;
  elapsed: number;
  localVideoEnabled: boolean;
  partnerAudioOn: boolean;
  partnerVideoOn: boolean;
  quality: NetworkQuality;
}) {
  const localRef = useRef<HTMLVideoElement>(null);
  const remoteRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (localRef.current && localStream) {
      localRef.current.srcObject = localStream;
    }
  }, [localStream]);

  useEffect(() => {
    if (remoteRef.current) {
      remoteRef.current.srcObject = remoteStream;
    }
  }, [remoteStream]);

  const showRemoteVideo = mode === 'VIDEO' && status === 'connected' && partnerVideoOn;

  return (
    <div className="relative h-full w-full overflow-hidden rounded-3xl glass-strong">
      {/* Remote video / audio */}
      <video
        ref={remoteRef}
        autoPlay
        playsInline
        className={`h-full w-full bg-ink-900 object-cover transition-opacity duration-300 ${
          showRemoteVideo ? 'opacity-100' : 'opacity-0'
        }`}
      />

      {/* Status / placeholder overlay */}
      <AnimatePresence>
        {status !== 'connected' || !showRemoteVideo ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-ink-900/80 text-center"
          >
            {status === 'searching' && (
              <>
                <div className="relative flex h-20 w-20 items-center justify-center">
                  <span className="absolute h-full w-full animate-pulse-ring rounded-full bg-violet/40" />
                  <span
                    className="absolute h-full w-full animate-pulse-ring rounded-full bg-violet/40"
                    style={{ animationDelay: '0.6s' }}
                  />
                  <span className="relative flex h-16 w-16 items-center justify-center rounded-full bg-violet-grad shadow-glow">
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
                      <circle cx="11" cy="11" r="7" stroke="white" strokeWidth="2" />
                      <path d="m20 20-3-3" stroke="white" strokeWidth="2" strokeLinecap="round" />
                    </svg>
                  </span>
                </div>
                <p className="font-display text-lg font-semibold text-white">
                  Finding someone for you…
                </p>
                <p className="text-sm text-white/50">
                  Matching you with a stranger
                </p>
              </>
            )}

            {status === 'connecting' && (
              <>
                <div className="h-12 w-12 animate-spin rounded-full border-2 border-white/15 border-t-violet" />
                <p className="font-display text-lg font-semibold text-white">
                  Connecting…
                </p>
              </>
            )}

            {status === 'connected' && !showRemoteVideo && (
              <>
                <div className="flex h-20 w-20 items-center justify-center rounded-full bg-white/5 text-3xl">
                  {mode === 'AUDIO' ? '🎧' : partner ? (
                    <CountryFlag code={partner.countryCode} />
                  ) : (
                    '👤'
                  )}
                </div>
                <p className="font-display text-lg font-semibold text-white">
                  {mode === 'AUDIO'
                    ? 'Audio call connected'
                    : "Stranger's camera is off"}
                </p>
              </>
            )}

            {status === 'left' && (
              <>
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-white/5 text-2xl">
                  👋
                </div>
                <p className="font-display text-lg font-semibold text-white">
                  Stranger disconnected
                </p>
                <p className="text-sm text-white/50">Tap Next to keep going</p>
              </>
            )}

            {status === 'idle' && (
              <>
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-violet-grad text-2xl shadow-glow">
                  ✨
                </div>
                <p className="font-display text-lg font-semibold text-white">
                  Ready when you are
                </p>
                <p className="text-sm text-white/50">
                  Press Start to meet someone new
                </p>
              </>
            )}
          </motion.div>
        ) : null}
      </AnimatePresence>

      {/* Top overlay: partner info + network + timer */}
      {status === 'connected' && (
        <div className="absolute inset-x-0 top-0 flex items-start justify-between gap-2 p-4">
          <div className="flex flex-wrap items-center gap-2">
            {partner && (
              <div className="glass flex items-center gap-2 rounded-full px-3 py-1.5">
                <CountryFlag code={partner.countryCode} className="text-base" />
                <span
                  className={`text-xs font-semibold capitalize ${GENDER_TINT[partner.gender] ?? 'text-white/60'}`}
                >
                  {partner.gender === 'UNKNOWN'
                    ? 'Stranger'
                    : partner.gender.toLowerCase()}
                </span>
                {partner.age ? (
                  <span className="text-xs text-white/50">· {partner.age}</span>
                ) : null}
                {partner.isVerified && (
                  <BadgeCheck className="h-3.5 w-3.5 text-sky-400" />
                )}
                {partner.isPremium && (
                  <Crown className="h-3.5 w-3.5 text-amber-400" />
                )}
              </div>
            )}
            {partner?.interests?.slice(0, 3).map((i) => (
              <span key={i} className="chip hidden sm:inline-flex">
                {i}
              </span>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <NetworkIndicator quality={quality} />
            <div className="glass rounded-full px-3 py-1.5 text-xs font-semibold tabular-nums text-white">
              {fmt(elapsed)}
            </div>
          </div>
        </div>
      )}

      {/* Partner mic state pill */}
      {status === 'connected' && !partnerAudioOn && (
        <div className="absolute bottom-4 left-4 glass flex items-center gap-1.5 rounded-full px-3 py-1.5">
          <MicOff className="h-3.5 w-3.5 text-red-400" />
          <span className="text-xs text-white/70">Muted</span>
        </div>
      )}

      {/* Local PiP */}
      {mode === 'VIDEO' && (
        <motion.div
          drag
          dragMomentum={false}
          dragConstraints={{ left: -8, right: 8, top: -8, bottom: 8 }}
          className="absolute bottom-4 right-4 aspect-[3/4] w-28 cursor-grab overflow-hidden rounded-2xl border border-white/15 bg-ink-900 shadow-glass sm:w-36 active:cursor-grabbing"
        >
          <video
            ref={localRef}
            autoPlay
            playsInline
            muted
            className={`mirror h-full w-full object-cover ${localVideoEnabled ? 'opacity-100' : 'opacity-0'}`}
          />
          {!localVideoEnabled && (
            <div className="absolute inset-0 flex items-center justify-center">
              <VideoOff className="h-6 w-6 text-white/40" />
            </div>
          )}
          <div className="absolute bottom-1.5 left-1.5 rounded-md bg-black/50 px-1.5 py-0.5 text-[10px] font-medium text-white/80">
            You
          </div>
        </motion.div>
      )}
    </div>
  );
}
