'use client';

import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Send } from 'lucide-react';
import type { ChatMessage } from '@/lib/types';

export function ChatPanel({
  messages,
  partnerTyping,
  disabled,
  onSend,
  onTyping,
}: {
  messages: ChatMessage[];
  partnerTyping: boolean;
  disabled: boolean;
  onSend: (text: string) => void;
  onTyping: (typing: boolean) => void;
}) {
  const [text, setText] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: 'smooth',
    });
  }, [messages, partnerTyping]);

  const submit = () => {
    const value = text.trim();
    if (!value || disabled) return;
    onSend(value);
    setText('');
    onTyping(false);
  };

  const handleChange = (v: string) => {
    setText(v);
    onTyping(true);
    if (typingTimer.current) clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(() => onTyping(false), 1200);
  };

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-3xl glass-strong">
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
        <h2 className="font-display text-sm font-semibold text-white">Chat</h2>
        <span className="text-xs text-white/40">Be kind. Stay safe.</span>
      </div>

      <div
        ref={scrollRef}
        className="flex-1 space-y-2 overflow-y-auto px-4 py-4"
      >
        {messages.length === 0 && (
          <div className="flex h-full flex-col items-center justify-center text-center text-sm text-white/30">
            <span className="mb-2 text-2xl">💬</span>
            Say hi to break the ice
          </div>
        )}
        <AnimatePresence initial={false}>
          {messages.map((m) => (
            <motion.div
              key={m.id}
              initial={{ opacity: 0, y: 8, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              className={`flex ${m.self ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[80%] break-words rounded-2xl px-3.5 py-2 text-sm ${
                  m.self
                    ? 'rounded-br-md bg-violet-grad text-white shadow-glow'
                    : 'rounded-bl-md glass text-white/90'
                }`}
              >
                {m.text}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        <AnimatePresence>
          {partnerTyping && (
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="flex justify-start"
            >
              <div className="flex items-center gap-1 rounded-2xl rounded-bl-md glass px-3.5 py-3">
                {[0, 1, 2].map((i) => (
                  <span
                    key={i}
                    className="h-1.5 w-1.5 animate-bounce rounded-full bg-white/60"
                    style={{ animationDelay: `${i * 0.15}s` }}
                  />
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="border-t border-white/10 p-3">
        <div className="flex items-center gap-2">
          <input
            value={text}
            onChange={(e) => handleChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                submit();
              }
            }}
            disabled={disabled}
            maxLength={1000}
            placeholder={disabled ? 'Connect to start chatting…' : 'Type a message…'}
            className="input flex-1 disabled:opacity-50"
          />
          <button
            type="button"
            onClick={submit}
            disabled={disabled || !text.trim()}
            aria-label="Send message"
            className="btn-primary h-11 w-11 shrink-0 !px-0"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
