'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { ChatMode } from '@/lib/types';

interface MediaState {
  stream: MediaStream | null;
  ready: boolean;
  error: string | null;
  audioEnabled: boolean;
  videoEnabled: boolean;
  toggleAudio: () => void;
  toggleVideo: () => void;
  switchCamera: () => Promise<void>;
}

/**
 * Owns the local camera/microphone MediaStream. The stream is acquired once
 * and persists across matches (skip/next), so only the RTCPeerConnection is
 * rebuilt per partner — not the user's camera.
 */
export function useLocalMedia(mode: ChatMode): MediaState {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [videoEnabled, setVideoEnabled] = useState(mode === 'VIDEO');
  const facingRef = useRef<'user' | 'environment'>('user');
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    let cancelled = false;
    const wantsVideo = mode === 'VIDEO';

    // Text mode needs no media at all — don't prompt for mic/camera.
    if (mode === 'TEXT') {
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      setStream(null);
      setReady(true);
      setError(null);
      setVideoEnabled(false);
      return () => {
        cancelled = true;
      };
    }

    async function acquire() {
      try {
        const constraints: MediaStreamConstraints = {
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
          video: wantsVideo
            ? {
                width: { ideal: 1280 },
                height: { ideal: 720 },
                facingMode: facingRef.current,
              }
            : false,
        };
        const s = await navigator.mediaDevices.getUserMedia(constraints);
        if (cancelled) {
          s.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = s;
        setStream(s);
        setReady(true);
        setError(null);
        setVideoEnabled(wantsVideo);
      } catch (e) {
        if (cancelled) return;
        const err = e as DOMException;
        setError(
          err.name === 'NotAllowedError'
            ? 'Camera & microphone permission denied. Please allow access and retry.'
            : err.name === 'NotFoundError'
              ? 'No camera or microphone found on this device.'
              : 'Could not access your camera/microphone.'
        );
        setReady(false);
      }
    }

    acquire();
    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  const toggleAudio = useCallback(() => {
    const s = streamRef.current;
    if (!s) return;
    const next = !audioEnabled;
    s.getAudioTracks().forEach((t) => (t.enabled = next));
    setAudioEnabled(next);
  }, [audioEnabled]);

  const toggleVideo = useCallback(() => {
    const s = streamRef.current;
    if (!s) return;
    const next = !videoEnabled;
    s.getVideoTracks().forEach((t) => (t.enabled = next));
    setVideoEnabled(next);
  }, [videoEnabled]);

  const switchCamera = useCallback(async () => {
    const s = streamRef.current;
    if (!s || mode !== 'VIDEO') return;
    facingRef.current = facingRef.current === 'user' ? 'environment' : 'user';
    try {
      const newStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: facingRef.current },
      });
      const newTrack = newStream.getVideoTracks()[0];
      const oldTrack = s.getVideoTracks()[0];
      if (oldTrack) {
        s.removeTrack(oldTrack);
        oldTrack.stop();
      }
      s.addTrack(newTrack);
      newTrack.enabled = videoEnabled;
      // Trigger a re-render with the same stream reference contents.
      setStream(s);
    } catch {
      /* ignore camera switch errors (e.g. single-camera devices) */
    }
  }, [mode, videoEnabled]);

  return {
    stream,
    ready,
    error,
    audioEnabled,
    videoEnabled,
    toggleAudio,
    toggleVideo,
    switchCamera,
  };
}
