'use client';

import { useEffect, useRef, useState } from 'react';
import type { Socket } from 'socket.io-client';
import type { IceServer, NetworkQuality } from '@/lib/types';

interface UseWebRTCArgs {
  socket: Socket | null;
  roomId: string | null;
  polite: boolean;
  iceServers: IceServer[];
  localStream: MediaStream | null;
  /** When false, the peer connection is torn down (e.g. between matches). */
  enabled: boolean;
}

type SignalPayload = {
  roomId: string;
  description?: RTCSessionDescriptionInit;
  candidate?: RTCIceCandidateInit | null;
};

interface UseWebRTCResult {
  remoteStream: MediaStream | null;
  connectionState: RTCPeerConnectionState;
  quality: NetworkQuality;
}

/**
 * Implements the WebRTC "perfect negotiation" pattern over a Socket.io relay.
 *
 * The backend simply relays `signal` events to the other peer in the room; all
 * negotiation logic (glare handling, rollback) lives here. The `polite` peer
 * (assigned server-side as the lexicographically smaller userId) yields on
 * collision; the impolite peer ignores the incoming offer.
 *
 * Also performs automatic ICE restart on connection failure and samples
 * getStats() to surface a live network-quality indicator.
 */
export function useWebRTC({
  socket,
  roomId,
  polite,
  iceServers,
  localStream,
  enabled,
}: UseWebRTCArgs): UseWebRTCResult {
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [connectionState, setConnectionState] =
    useState<RTCPeerConnectionState>('new');
  const [quality, setQuality] = useState<NetworkQuality>('unknown');

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const makingOfferRef = useRef(false);
  const ignoreOfferRef = useRef(false);
  const isSettingRemoteAnswerPendingRef = useRef(false);
  const disconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const statsTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const prevStatsRef = useRef<{ lost: number; received: number } | null>(null);

  useEffect(() => {
    if (!socket || !roomId || !localStream || !enabled) return;

    const pc = new RTCPeerConnection({
      iceServers: iceServers as RTCIceServer[],
      bundlePolicy: 'max-bundle',
      rtcpMuxPolicy: 'require',
    });
    pcRef.current = pc;

    const remote = new MediaStream();
    setRemoteStream(remote);

    // Push local tracks.
    for (const track of localStream.getTracks()) {
      pc.addTrack(track, localStream);
    }

    const send = (payload: Omit<SignalPayload, 'roomId'>) => {
      socket.emit('signal', { roomId, ...payload });
    };

    pc.ontrack = (ev) => {
      ev.streams[0]?.getTracks().forEach((t) => remote.addTrack(t));
      // Some browsers fire ontrack without a stream — add the raw track.
      if (!ev.streams.length && ev.track) remote.addTrack(ev.track);
      setRemoteStream(new MediaStream(remote.getTracks()));
    };

    pc.onicecandidate = ({ candidate }) => {
      send({ candidate: candidate ? candidate.toJSON() : null });
    };

    pc.onnegotiationneeded = async () => {
      try {
        makingOfferRef.current = true;
        await pc.setLocalDescription();
        send({ description: pc.localDescription ?? undefined });
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error('[webrtc] negotiation error', err);
      } finally {
        makingOfferRef.current = false;
      }
    };

    pc.onconnectionstatechange = () => {
      setConnectionState(pc.connectionState);
    };

    pc.oniceconnectionstatechange = () => {
      const state = pc.iceConnectionState;
      if (state === 'failed') {
        // Hard failure — force an ICE restart immediately.
        try {
          pc.restartIce();
        } catch {
          /* older browsers: renegotiate manually */
        }
      } else if (state === 'disconnected') {
        // Transient — wait briefly, then restart if it hasn't recovered.
        if (disconnectTimerRef.current) clearTimeout(disconnectTimerRef.current);
        disconnectTimerRef.current = setTimeout(() => {
          if (pc.iceConnectionState === 'disconnected') {
            try {
              pc.restartIce();
            } catch {
              /* ignore */
            }
          }
        }, 2500);
      } else if (state === 'connected' || state === 'completed') {
        if (disconnectTimerRef.current) {
          clearTimeout(disconnectTimerRef.current);
          disconnectTimerRef.current = null;
        }
      }
    };

    const onSignal = async (payload: SignalPayload) => {
      if (!payload || payload.roomId !== roomId) return;
      try {
        if (payload.description) {
          const description = payload.description;
          const readyForOffer =
            !makingOfferRef.current &&
            (pc.signalingState === 'stable' ||
              isSettingRemoteAnswerPendingRef.current);
          const offerCollision =
            description.type === 'offer' && !readyForOffer;

          ignoreOfferRef.current = !polite && offerCollision;
          if (ignoreOfferRef.current) return;

          isSettingRemoteAnswerPendingRef.current =
            description.type === 'answer';
          await pc.setRemoteDescription(description);
          isSettingRemoteAnswerPendingRef.current = false;

          if (description.type === 'offer') {
            await pc.setLocalDescription();
            send({ description: pc.localDescription ?? undefined });
          }
        } else if (payload.candidate !== undefined) {
          try {
            if (payload.candidate) {
              await pc.addIceCandidate(payload.candidate);
            }
          } catch (err) {
            if (!ignoreOfferRef.current) throw err;
          }
        }
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error('[webrtc] signal handling error', err);
      }
    };

    socket.on('signal', onSignal);

    // ---- Network quality sampling ----
    statsTimerRef.current = setInterval(async () => {
      if (!pcRef.current) return;
      try {
        const stats = await pcRef.current.getStats();
        let rtt = 0;
        let lost = 0;
        let received = 0;
        stats.forEach((report) => {
          if (
            report.type === 'candidate-pair' &&
            report.state === 'succeeded' &&
            typeof report.currentRoundTripTime === 'number'
          ) {
            rtt = report.currentRoundTripTime;
          }
          if (report.type === 'inbound-rtp' && !report.isRemote) {
            lost += report.packetsLost ?? 0;
            received += report.packetsReceived ?? 0;
          }
        });

        let lossRate = 0;
        if (prevStatsRef.current) {
          const dLost = lost - prevStatsRef.current.lost;
          const dRecv = received - prevStatsRef.current.received;
          const total = dLost + dRecv;
          lossRate = total > 0 ? dLost / total : 0;
        }
        prevStatsRef.current = { lost, received };

        const rttMs = rtt * 1000;
        let q: NetworkQuality;
        if (received === 0 && pc.connectionState !== 'connected') {
          q = 'unknown';
        } else if (rttMs < 150 && lossRate < 0.02) {
          q = 'excellent';
        } else if (rttMs < 300 && lossRate < 0.05) {
          q = 'good';
        } else if (rttMs < 500 && lossRate < 0.1) {
          q = 'fair';
        } else {
          q = 'poor';
        }
        setQuality(q);
      } catch {
        /* ignore stats errors */
      }
    }, 2000);

    return () => {
      socket.off('signal', onSignal);
      if (disconnectTimerRef.current) clearTimeout(disconnectTimerRef.current);
      if (statsTimerRef.current) clearInterval(statsTimerRef.current);
      prevStatsRef.current = null;
      makingOfferRef.current = false;
      ignoreOfferRef.current = false;
      isSettingRemoteAnswerPendingRef.current = false;
      pc.ontrack = null;
      pc.onicecandidate = null;
      pc.onnegotiationneeded = null;
      pc.onconnectionstatechange = null;
      pc.oniceconnectionstatechange = null;
      pc.getSenders().forEach((s) => {
        try {
          pc.removeTrack(s);
        } catch {
          /* ignore */
        }
      });
      pc.close();
      pcRef.current = null;
      setRemoteStream(null);
      setConnectionState('closed');
      setQuality('unknown');
    };
  }, [socket, roomId, polite, enabled, localStream, iceServers]);

  return { remoteStream, connectionState, quality };
}
