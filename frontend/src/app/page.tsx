'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  Video,
  Phone,
  MessageSquare,
  Shield,
  Globe2,
  Zap,
  Crown,
  ArrowRight,
  Sparkles,
} from 'lucide-react';
import { Background } from '@/components/Background';
import { Navbar } from '@/components/Navbar';
import { OnlineCounter } from '@/components/OnlineCounter';
import { useSocket } from '@/hooks/useSocket';
import { useOnlineCount } from '@/hooks/useOnlineCount';

const FEATURES = [
  {
    icon: Zap,
    title: 'Instant matching',
    body: 'A Redis-backed engine pairs you with someone new in milliseconds. Skip anytime.',
  },
  {
    icon: Globe2,
    title: 'The whole world',
    body: 'Meet people across 35+ countries. Filter by country, language and interests with Premium.',
  },
  {
    icon: Shield,
    title: 'Safe by design',
    body: 'Anonymous by default, with reporting, blocking and AI moderation hooks built in.',
  },
];

const STEPS = [
  { n: '01', t: 'Allow camera', d: 'Grant access — no account required to start.' },
  { n: '02', t: 'Get matched', d: 'We connect you to a random stranger instantly.' },
  { n: '03', t: 'Talk or skip', d: 'Hit it off, or tap Next for someone new.' },
];

export default function LandingPage() {
  const { socket } = useSocket(true);
  const { online, waiting } = useOnlineCount(socket);

  return (
    <main className="relative min-h-screen">
      <Background />
      <Navbar online={<OnlineCounter online={online} waiting={waiting} />} />

      {/* Hero */}
      <section className="mx-auto max-w-7xl px-4 pb-16 pt-16 sm:px-6 sm:pt-24">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="mx-auto max-w-3xl text-center"
        >
          <span className="chip mx-auto mb-6 border-violet/30 text-violet-glow">
            <Sparkles className="h-3.5 w-3.5" /> Modern anonymous chat
          </span>
          <h1 className="font-display text-4xl font-extrabold leading-[1.05] tracking-tight text-white sm:text-6xl md:text-7xl">
            Talk to <span className="gradient-text">strangers</span>,
            <br /> instantly.
          </h1>
          <p className="mx-auto mt-6 max-w-xl text-base text-white/60 sm:text-lg">
            Free, anonymous video, audio and text chat with people around the
            world. No sign-up. Just press start.
          </p>

          <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link href="/chat" className="btn-primary h-14 w-full text-base sm:w-auto">
              <Video className="h-5 w-5" /> Start video chat
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link href="/chat?mode=text" className="btn-ghost h-14 w-full text-base sm:w-auto">
              <MessageSquare className="h-5 w-5" /> Text only
            </Link>
          </div>

          <div className="mt-6 flex items-center justify-center gap-4 text-sm text-white/40">
            <span className="flex items-center gap-1.5">
              <Video className="h-4 w-4" /> Video
            </span>
            <span className="flex items-center gap-1.5">
              <Phone className="h-4 w-4" /> Audio
            </span>
            <span className="flex items-center gap-1.5">
              <MessageSquare className="h-4 w-4" /> Text
            </span>
          </div>
        </motion.div>

        {/* Floating preview card */}
        <motion.div
          initial={{ opacity: 0, y: 40, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.7, delay: 0.2 }}
          className="mx-auto mt-16 max-w-4xl"
        >
          <div className="relative aspect-video overflow-hidden rounded-3xl glass-strong p-1.5 shadow-glow-lg">
            <div className="flex h-full w-full items-center justify-center rounded-[20px] bg-gradient-to-br from-ink-800 to-ink-900">
              <div className="text-center">
                <div className="relative mx-auto flex h-24 w-24 items-center justify-center">
                  <span className="absolute h-full w-full animate-pulse-ring rounded-full bg-violet/40" />
                  <span className="relative flex h-20 w-20 items-center justify-center rounded-full bg-violet-grad shadow-glow">
                    <Video className="h-9 w-9 text-white" />
                  </span>
                </div>
                <p className="mt-5 font-display text-lg font-semibold text-white">
                  {online > 0
                    ? `${online.toLocaleString()} people online now`
                    : 'Be the first one online'}
                </p>
                <p className="text-sm text-white/40">Your next conversation is one tap away</p>
              </div>
            </div>
          </div>
        </motion.div>
      </section>

      {/* Features */}
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
        <div className="grid gap-4 sm:grid-cols-3">
          {FEATURES.map((f, i) => (
            <motion.div
              key={f.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className="rounded-3xl glass p-6"
            >
              <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-violet-soft">
                <f.icon className="h-5 w-5 text-violet-glow" />
              </div>
              <h3 className="font-display text-lg font-semibold text-white">
                {f.title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-white/55">
                {f.body}
              </p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
        <h2 className="text-center font-display text-3xl font-bold text-white sm:text-4xl">
          Three taps to hello
        </h2>
        <div className="mt-12 grid gap-8 sm:grid-cols-3">
          {STEPS.map((s) => (
            <div key={s.n} className="relative">
              <span className="font-display text-5xl font-bold text-white/10">
                {s.n}
              </span>
              <h3 className="mt-2 font-display text-xl font-semibold text-white">
                {s.t}
              </h3>
              <p className="mt-1.5 text-sm text-white/55">{s.d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Premium CTA */}
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
        <div className="relative overflow-hidden rounded-3xl glass-strong p-8 text-center sm:p-14">
          <div className="absolute inset-0 bg-violet-soft" />
          <div className="relative">
            <Crown className="mx-auto mb-4 h-10 w-10 text-amber-400" />
            <h2 className="font-display text-3xl font-bold text-white sm:text-4xl">
              Meet exactly who you want
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-white/60">
              Free filters last 3 minutes a day. Go Premium for unlimited
              country, gender, age, language and interest matching — from just
              ₹69/month.
            </p>
            <Link href="/premium" className="btn-primary mt-7 inline-flex h-13 px-7 text-base">
              See Premium plans <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/5 py-10">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-4 sm:flex-row sm:px-6">
          <p className="text-sm text-white/40">
            © {new Date().getFullYear()} StrangerChat. Be kind out there.
          </p>
          <div className="flex items-center gap-5 text-sm text-white/40">
            <Link href="/chat" className="hover:text-white">Chat</Link>
            <Link href="/premium" className="hover:text-white">Premium</Link>
            <Link href="/login" className="hover:text-white">Log in</Link>
          </div>
        </div>
      </footer>
    </main>
  );
}
