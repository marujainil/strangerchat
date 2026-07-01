'use client';

import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  SkipForward,
  Square,
  Play,
  Flag,
  Ban,
  Maximize,
  SwitchCamera,
} from 'lucide-react';
import type { ChatMode } from '@/lib/types';
import type { StageStatus } from './VideoStage';

function IconButton({
  onClick,
  active,
  danger,
  label,
  children,
  disabled,
}: {
  onClick?: () => void;
  active?: boolean;
  danger?: boolean;
  label: string;
  children: React.ReactNode;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className={`flex h-12 w-12 items-center justify-center rounded-full border transition-all active:scale-95 disabled:opacity-40 ${
        danger
          ? 'border-red-400/30 bg-red-500/15 text-red-300 hover:bg-red-500/25'
          : active
            ? 'border-white/10 bg-white/[0.05] text-white hover:bg-white/10'
            : 'border-amber-400/30 bg-amber-500/15 text-amber-300 hover:bg-amber-500/25'
      }`}
    >
      {children}
    </button>
  );
}

export function ControlBar({
  status,
  mode,
  audioEnabled,
  videoEnabled,
  connected,
  onStart,
  onStop,
  onNext,
  onToggleAudio,
  onToggleVideo,
  onSwitchCamera,
  onFullscreen,
  onReport,
  onBlock,
}: {
  status: StageStatus;
  mode: ChatMode;
  audioEnabled: boolean;
  videoEnabled: boolean;
  connected: boolean;
  onStart: () => void;
  onStop: () => void;
  onNext: () => void;
  onToggleAudio: () => void;
  onToggleVideo: () => void;
  onSwitchCamera: () => void;
  onFullscreen: () => void;
  onReport: () => void;
  onBlock: () => void;
}) {
  const inCall = status === 'connected';
  const active = status !== 'idle';

  return (
    <div className="flex flex-wrap items-center justify-center gap-2.5">
      {/* Mic */}
      <IconButton
        label={audioEnabled ? 'Mute microphone' : 'Unmute microphone'}
        active={audioEnabled}
        onClick={onToggleAudio}
      >
        {audioEnabled ? <Mic className="h-5 w-5" /> : <MicOff className="h-5 w-5" />}
      </IconButton>

      {/* Camera (video mode only) */}
      {mode === 'VIDEO' && (
        <>
          <IconButton
            label={videoEnabled ? 'Turn camera off' : 'Turn camera on'}
            active={videoEnabled}
            onClick={onToggleVideo}
          >
            {videoEnabled ? (
              <Video className="h-5 w-5" />
            ) : (
              <VideoOff className="h-5 w-5" />
            )}
          </IconButton>
          <IconButton label="Switch camera" active onClick={onSwitchCamera}>
            <SwitchCamera className="h-5 w-5" />
          </IconButton>
        </>
      )}

      {/* Primary action */}
      {status === 'idle' ? (
        <button
          type="button"
          onClick={onStart}
          disabled={!connected}
          className="btn-primary h-12 min-w-[140px] text-base"
        >
          <Play className="h-5 w-5" />
          Start
        </button>
      ) : (
        <button
          type="button"
          onClick={onNext}
          className="btn-primary h-12 min-w-[140px] text-base"
        >
          <SkipForward className="h-5 w-5" />
          {status === 'searching' ? 'Searching…' : 'Next'}
        </button>
      )}

      {/* Stop */}
      {active && (
        <IconButton label="Stop" danger onClick={onStop}>
          <Square className="h-5 w-5" />
        </IconButton>
      )}

      {/* Fullscreen */}
      <IconButton label="Fullscreen" active onClick={onFullscreen}>
        <Maximize className="h-5 w-5" />
      </IconButton>

      {/* Report / Block (in-call only) */}
      {inCall && (
        <>
          <IconButton label="Report user" danger onClick={onReport}>
            <Flag className="h-5 w-5" />
          </IconButton>
          <IconButton label="Block user" danger onClick={onBlock}>
            <Ban className="h-5 w-5" />
          </IconButton>
        </>
      )}
    </div>
  );
}
