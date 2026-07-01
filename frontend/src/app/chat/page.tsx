'use client';

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';
import { api } from '@/lib/api';
import { setAccessToken, getAccessToken } from '@/lib/api';
import { useAuth, useToast } from '@/app/providers';
import { useSocket } from '@/hooks/useSocket';
import { useOnlineCount } from '@/hooks/useOnlineCount';
import { useLocalMedia } from '@/hooks/useMediaDevices';
import { useWebRTC } from '@/hooks/useWebRTC';
import { Background } from '@/components/Background';
import { Navbar } from '@/components/Navbar';
import { OnlineCounter } from '@/components/OnlineCounter';
import { VideoStage, type StageStatus } from '@/components/VideoStage';
import { ControlBar } from '@/components/ControlBar';
import { ChatPanel } from '@/components/ChatPanel';
import { FilterBar } from '@/components/FilterBar';
import { PremiumModal } from '@/components/PremiumModal';
import { ReportModal } from '@/components/ReportModal';
import type {
  ChatMessage,
  ChatMode,
  Country,
  Interest,
  MatchFilters,
  MatchFound,
  PublicPartner,
} from '@/lib/types';

const FREE_FILTER_SECONDS = 180;
const DAY_KEY = () => new Date().toISOString().slice(0, 10);
const USAGE_KEY = () => `sc_filter_usage_${DAY_KEY()}`;

function readUsage(): number {
  if (typeof window === 'undefined') return 0;
  const raw = window.localStorage.getItem(USAGE_KEY());
  const n = raw ? Number(raw) : 0;
  return Number.isFinite(n) ? n : 0;
}
function writeUsage(seconds: number) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(USAGE_KEY(), String(Math.max(0, Math.floor(seconds))));
}

function hasActiveFilters(f: MatchFilters): boolean {
  return Boolean(
    (f.genders && f.genders.length) ||
      (f.countries && f.countries.length) ||
      (f.languages && f.languages.length) ||
      (f.interests && f.interests.length) ||
      f.ageMin ||
      f.ageMax ||
      f.relationship ||
      f.onlyVerified ||
      f.onlyPremium ||
      f.newUsersOnly ||
      f.distanceKm
  );
}

function normalizeMode(raw: string | null): ChatMode {
  const v = (raw || '').toUpperCase();
  if (v === 'AUDIO') return 'AUDIO';
  if (v === 'TEXT') return 'TEXT';
  return 'VIDEO';
}

function ChatInner() {
  const router = useRouter();
  const params = useSearchParams();
  const { user, loading, setUser } = useAuth();
  const { toast } = useToast();

  const [mode, setMode] = useState<ChatMode>(normalizeMode(params.get('mode')));
  const [status, setStatus] = useState<StageStatus>('idle');
  const [filters, setFilters] = useState<MatchFilters>({});
  const [premiumOpen, setPremiumOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [filtersLocked, setFiltersLocked] = useState(false);

  // Match state
  const [roomId, setRoomId] = useState<string | null>(null);
  const [polite, setPolite] = useState(false);
  const [iceServers, setIceServers] = useState<MatchFound['iceServers']>([]);
  const [partner, setPartner] = useState<PublicPartner | null>(null);

  // Chat / partner media
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [partnerTyping, setPartnerTyping] = useState(false);
  const [partnerAudioOn, setPartnerAudioOn] = useState(true);
  const [partnerVideoOn, setPartnerVideoOn] = useState(true);

  // Timer + filter quota
  const [elapsed, setElapsed] = useState(0);
  const [remainingSec, setRemainingSec] = useState<number | null>(null);

  // Reference data
  const [countries, setCountries] = useState<Country[]>([]);
  const [interests, setInterests] = useState<Interest[]>([]);

  const stageWrapRef = useRef<HTMLDivElement>(null);
  const guestRequested = useRef(false);

  const isPremium = Boolean(user?.isPremium);

  // ---- Ensure an authenticated (or guest) session exists ----
  useEffect(() => {
    if (loading) return;
    if (user) return;
    if (guestRequested.current) return;
    guestRequested.current = true;
    (async () => {
      try {
        const { data } = await api.post('/auth/guest');
        setAccessToken(data.accessToken);
        setUser(data.user);
      } catch {
        toast('Could not start an anonymous session. Please retry.', 'error');
      }
    })();
  }, [loading, user, setUser, toast]);

  const hasToken = Boolean(getAccessToken());
  const { socket, connected } = useSocket(hasToken);
  const { online } = useOnlineCount(socket);

  const media = useLocalMedia(mode);

  const rtcEnabled = status === 'connecting' || status === 'connected';
  const { remoteStream, connectionState, quality } = useWebRTC({
    socket,
    roomId,
    polite,
    iceServers,
    localStream: media.stream,
    enabled: rtcEnabled,
  });

  // ---- Load reference data for filters ----
  useEffect(() => {
    let active = true;
    Promise.all([
      api.get('/users/countries').catch(() => ({ data: { countries: [] } })),
      api.get('/users/interests').catch(() => ({ data: { interests: [] } })),
    ]).then(([c, i]) => {
      if (!active) return;
      setCountries(c.data.countries ?? c.data ?? []);
      setInterests(i.data.interests ?? i.data ?? []);
    });
    return () => {
      active = false;
    };
  }, []);

  // ---- Sync filter quota for free users ----
  useEffect(() => {
    if (isPremium) {
      setRemainingSec(null);
      setFiltersLocked(false);
      return;
    }
    const used = readUsage();
    const remaining = Math.max(0, FREE_FILTER_SECONDS - used);
    setRemainingSec(remaining);
    setFiltersLocked(remaining <= 0);
  }, [isPremium]);

  const filtersActive = useMemo(() => hasActiveFilters(filters), [filters]);

  // Countdown while a free user actively matches with filters applied.
  useEffect(() => {
    if (isPremium) return;
    const counting =
      filtersActive &&
      !filtersLocked &&
      (status === 'searching' || status === 'connecting' || status === 'connected');
    if (!counting) return;
    const id = setInterval(() => {
      const used = readUsage() + 1;
      writeUsage(used);
      const remaining = Math.max(0, FREE_FILTER_SECONDS - used);
      setRemainingSec(remaining);
      if (remaining <= 0) {
        setFiltersLocked(true);
        setPremiumOpen(true);
        toast('Your free 3 minutes of filtering is up.', 'info');
      }
    }, 1000);
    return () => clearInterval(id);
  }, [isPremium, filtersActive, filtersLocked, status, toast]);

  // ---- Connection timer ----
  useEffect(() => {
    if (status !== 'connected') {
      setElapsed(0);
      return;
    }
    const id = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(id);
  }, [status]);

  // ---- Promote connecting -> connected when the peer link is up ----
  useEffect(() => {
    if (status === 'connecting' && connectionState === 'connected') {
      setStatus('connected');
    }
  }, [connectionState, status]);

  // ---- Broadcast our own mic/cam state to the partner ----
  useEffect(() => {
    if (!socket || status !== 'connected') return;
    socket.emit('peer:state', { audio: media.audioEnabled, video: media.videoEnabled });
  }, [socket, status, media.audioEnabled, media.videoEnabled]);

  const resetMatch = useCallback(() => {
    setRoomId(null);
    setPolite(false);
    setIceServers([]);
    setPartner(null);
    setMessages([]);
    setPartnerTyping(false);
    setPartnerAudioOn(true);
    setPartnerVideoOn(true);
    setElapsed(0);
  }, []);

  // Compute the filters we are actually allowed to send right now.
  const effectiveFilters = useCallback((): MatchFilters | undefined => {
    if (!filtersActive) return undefined;
    if (isPremium) return filters;
    if (filtersLocked) return undefined;
    return filters;
  }, [filters, filtersActive, filtersLocked, isPremium]);

  const buildJoinPayload = useCallback(
    async (): Promise<Record<string, unknown>> => {
      const payload: Record<string, unknown> = { mode };
      const ef = effectiveFilters();
      if (ef) payload.filters = ef;
      if (ef?.distanceKm && typeof navigator !== 'undefined' && navigator.geolocation) {
        const coords = await new Promise<GeolocationCoordinates | null>((resolve) => {
          navigator.geolocation.getCurrentPosition(
            (pos) => resolve(pos.coords),
            () => resolve(null),
            { timeout: 4000, maximumAge: 60000 }
          );
        });
        if (coords) {
          payload.lat = coords.latitude;
          payload.lng = coords.longitude;
        }
      }
      return payload;
    },
    [mode, effectiveFilters]
  );

  // ---- Socket event wiring ----
  useEffect(() => {
    if (!socket) return;

    const onMatch = (m: MatchFound) => {
      setRoomId(m.roomId);
      setPolite(Boolean(m.polite));
      setIceServers(m.iceServers || []);
      setPartner(m.partner);
      setMessages([]);
      setPartnerTyping(false);
      setPartnerAudioOn(true);
      setPartnerVideoOn(m.mode === 'VIDEO');
      setStatus('connecting');
    };
    const onWaiting = () => setStatus('searching');
    const onPremiumRequired = () => {
      setFiltersLocked(true);
      setRemainingSec(0);
      writeUsage(FREE_FILTER_SECONDS);
      setPremiumOpen(true);
    };
    const onPartnerLeft = () => {
      setStatus('left');
      setPartnerTyping(false);
    };
    const onChat = (p: { text: string; ts: number }) => {
      setMessages((prev) => [
        ...prev,
        { id: `${p.ts}-${Math.random().toString(36).slice(2, 7)}`, self: false, text: p.text, at: p.ts },
      ]);
      setPartnerTyping(false);
    };
    const onTyping = (typing: boolean) => setPartnerTyping(Boolean(typing));
    const onPeerState = (s: { audio: boolean; video: boolean }) => {
      setPartnerAudioOn(Boolean(s.audio));
      setPartnerVideoOn(Boolean(s.video));
    };
    const onSkipDone = () => {
      resetMatch();
      setStatus('idle');
    };
    const onQueueLeft = () => {
      resetMatch();
      setStatus('idle');
    };
    const onReportReceived = () => toast('Report submitted. Thank you for keeping things safe.', 'success');
    const onBlockDone = () => {
      toast('User blocked. You won’t be matched again.', 'success');
      resetMatch();
      setStatus('idle');
    };
    const onBanned = () => {
      toast('Your access has been suspended.', 'error');
      setStatus('idle');
      resetMatch();
      setTimeout(() => router.push('/'), 1500);
    };
    const onErrorQueue = (e: { error?: string }) => {
      toast(e?.error ? `Queue error: ${e.error}` : 'Matching error. Please retry.', 'error');
      setStatus('idle');
    };

    socket.on('match:found', onMatch);
    socket.on('queue:waiting', onWaiting);
    socket.on('premium:required', onPremiumRequired);
    socket.on('partner:left', onPartnerLeft);
    socket.on('chat:message', onChat);
    socket.on('chat:typing', onTyping);
    socket.on('peer:state', onPeerState);
    socket.on('skip:done', onSkipDone);
    socket.on('queue:left', onQueueLeft);
    socket.on('report:received', onReportReceived);
    socket.on('block:done', onBlockDone);
    socket.on('banned', onBanned);
    socket.on('error:queue', onErrorQueue);

    return () => {
      socket.off('match:found', onMatch);
      socket.off('queue:waiting', onWaiting);
      socket.off('premium:required', onPremiumRequired);
      socket.off('partner:left', onPartnerLeft);
      socket.off('chat:message', onChat);
      socket.off('chat:typing', onTyping);
      socket.off('peer:state', onPeerState);
      socket.off('skip:done', onSkipDone);
      socket.off('queue:left', onQueueLeft);
      socket.off('report:received', onReportReceived);
      socket.off('block:done', onBlockDone);
      socket.off('banned', onBanned);
      socket.off('error:queue', onErrorQueue);
    };
  }, [socket, resetMatch, router, toast]);

  // ---- Actions ----
  const start = useCallback(async () => {
    if (!socket || !connected) {
      toast('Still connecting to the server…', 'info');
      return;
    }
    if (mode !== 'TEXT' && !media.ready) {
      toast(media.error || 'Waiting for camera/microphone access…', 'info');
      return;
    }
    resetMatch();
    setStatus('searching');
    const payload = await buildJoinPayload();
    socket.emit('queue:join', payload);
  }, [socket, connected, mode, media.ready, media.error, resetMatch, buildJoinPayload, toast]);

  const next = useCallback(async () => {
    if (!socket) return;
    setMessages([]);
    setPartnerTyping(false);
    setPartner(null);
    setRoomId(null);
    setStatus('searching');
    // Server re-queues using the last join parameters.
    socket.emit('next');
  }, [socket]);

  const stop = useCallback(() => {
    if (!socket) return;
    if (status === 'connected' || status === 'connecting') {
      socket.emit('skip');
    } else {
      socket.emit('queue:leave');
    }
    resetMatch();
    setStatus('idle');
  }, [socket, status, resetMatch]);

  const sendMessage = useCallback(
    (text: string) => {
      if (!socket || status !== 'connected') return;
      socket.emit('chat:message', { text });
      setMessages((prev) => [
        ...prev,
        { id: `self-${Date.now()}`, self: true, text, at: Date.now() },
      ]);
    },
    [socket, status]
  );

  const sendTyping = useCallback(
    (typing: boolean) => {
      if (!socket || status !== 'connected') return;
      socket.emit('chat:typing', typing);
    },
    [socket, status]
  );

  const submitReport = useCallback(
    (reason: string, details: string) => {
      if (!socket) return;
      socket.emit('report', { reason, details });
      setReportOpen(false);
    },
    [socket]
  );

  const blockPartner = useCallback(() => {
    if (!socket) return;
    socket.emit('block');
  }, [socket]);

  const toggleFullscreen = useCallback(() => {
    const el = stageWrapRef.current;
    if (!el) return;
    if (!document.fullscreenElement) {
      el.requestFullscreen?.().catch(() => {});
    } else {
      document.exitFullscreen?.().catch(() => {});
    }
  }, []);

  const onModeChange = useCallback(
    (m: ChatMode) => {
      if (m === mode) return;
      // Changing mode resets any active session.
      if (socket && (status === 'connected' || status === 'connecting')) {
        socket.emit('skip');
      } else if (socket && status === 'searching') {
        socket.emit('queue:leave');
      }
      resetMatch();
      setStatus('idle');
      setMode(m);
      const url = new URL(window.location.href);
      url.searchParams.set('mode', m.toLowerCase());
      window.history.replaceState({}, '', url.toString());
    },
    [mode, socket, status, resetMatch]
  );

  const showChat = mode === 'TEXT' || status === 'connected';

  return (
    <div className="relative min-h-screen">
      <Background />
      <Navbar online={<OnlineCounter online={online} />} />

      <main className="mx-auto w-full max-w-7xl px-4 pb-10 pt-2">
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
          {/* Stage + controls */}
          <div className="flex flex-col gap-4">
            <div ref={stageWrapRef} className="relative">
              <VideoStage
                mode={mode}
                status={status}
                localStream={media.stream}
                remoteStream={remoteStream}
                partner={partner}
                elapsed={elapsed}
                localVideoEnabled={media.videoEnabled}
                partnerAudioOn={partnerAudioOn}
                partnerVideoOn={partnerVideoOn}
                quality={quality}
              />
            </div>

            {media.error && (
              <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
                {media.error}
              </div>
            )}

            <ControlBar
              status={status}
              mode={mode}
              audioEnabled={media.audioEnabled}
              videoEnabled={media.videoEnabled}
              connected={connected}
              onStart={start}
              onStop={stop}
              onNext={next}
              onToggleAudio={media.toggleAudio}
              onToggleVideo={media.toggleVideo}
              onSwitchCamera={media.switchCamera}
              onFullscreen={toggleFullscreen}
              onReport={() => setReportOpen(true)}
              onBlock={blockPartner}
            />
          </div>

          {/* Sidebar: filters + chat */}
          <div className="flex flex-col gap-4">
            <FilterBar
              mode={mode}
              onModeChange={onModeChange}
              filters={filters}
              onChange={setFilters}
              countries={countries}
              interests={interests}
              isPremium={isPremium}
              locked={filtersLocked}
              remainingSec={isPremium ? null : remainingSec}
              onUpgrade={() => setPremiumOpen(true)}
              busy={status === 'searching' || status === 'connecting'}
            />

            {showChat && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="min-h-[320px] flex-1"
              >
                <ChatPanel
                  messages={messages}
                  partnerTyping={partnerTyping}
                  disabled={status !== 'connected'}
                  onSend={sendMessage}
                  onTyping={sendTyping}
                />
              </motion.div>
            )}
          </div>
        </div>
      </main>

      <PremiumModal open={premiumOpen} onClose={() => setPremiumOpen(false)} />
      <ReportModal
        open={reportOpen}
        onClose={() => setReportOpen(false)}
        onSubmit={submitReport}
      />
    </div>
  );
}

export default function ChatPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-ink-950" />}>
      <ChatInner />
    </Suspense>
  );
}
