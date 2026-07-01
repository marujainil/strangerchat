'use client';

import {
  Suspense,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { ArrowLeft, Loader2, Mail, Lock, KeyRound, UserCircle2 } from 'lucide-react';
import { api, setAccessToken } from '@/lib/api';
import { useAuth, useToast } from '@/app/providers';
import { Background } from '@/components/Background';
import { Logo } from '@/components/Logo';
import type { AuthResponse } from '@/lib/types';

type Tab = 'login' | 'register' | 'otp';

const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || '';

function loadGsi(): Promise<boolean> {
  return new Promise((resolve) => {
    if (typeof window === 'undefined') return resolve(false);
    if ((window as unknown as { google?: unknown }).google) return resolve(true);
    const s = document.createElement('script');
    s.src = 'https://accounts.google.com/gsi/client';
    s.async = true;
    s.defer = true;
    s.onload = () => resolve(true);
    s.onerror = () => resolve(false);
    document.body.appendChild(s);
  });
}

function LoginInner() {
  const router = useRouter();
  const params = useSearchParams();
  const { setUser, refreshMe } = useAuth();
  const { toast } = useToast();

  const nextUrl = params.get('next') || '/chat';

  const [tab, setTab] = useState<Tab>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const googleBtnRef = useRef<HTMLDivElement>(null);

  const finish = useCallback(
    async (data: AuthResponse) => {
      setAccessToken(data.accessToken);
      setUser(data.user);
      await refreshMe().catch(() => {});
      router.push(nextUrl);
    },
    [setUser, refreshMe, router, nextUrl]
  );

  // ---- Google Identity Services ----
  useEffect(() => {
    if (!GOOGLE_CLIENT_ID) return;
    let cancelled = false;
    (async () => {
      const ok = await loadGsi();
      if (!ok || cancelled) return;
      const google = (window as unknown as {
        google?: {
          accounts: {
            id: {
              initialize: (o: Record<string, unknown>) => void;
              renderButton: (el: HTMLElement, o: Record<string, unknown>) => void;
            };
          };
        };
      }).google;
      if (!google || !googleBtnRef.current) return;
      google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: async (resp: { credential?: string }) => {
          if (!resp.credential) return;
          setBusy(true);
          try {
            const { data } = await api.post('/auth/google', { idToken: resp.credential });
            await finish(data);
          } catch {
            toast('Google sign-in failed.', 'error');
          } finally {
            setBusy(false);
          }
        },
      });
      google.accounts.id.renderButton(googleBtnRef.current, {
        theme: 'filled_black',
        size: 'large',
        width: 320,
        shape: 'pill',
        text: 'continue_with',
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [finish, toast]);

  const handlePassword = useCallback(async () => {
    if (!email || !password) {
      toast('Enter your email and password.', 'info');
      return;
    }
    setBusy(true);
    try {
      const path = tab === 'register' ? '/auth/register' : '/auth/login';
      const body =
        tab === 'register'
          ? { email, password, displayName: displayName || undefined }
          : { email, password };
      const { data } = await api.post(path, body);
      await finish(data);
    } catch (e: unknown) {
      const code =
        (e as { response?: { data?: { error?: string } } })?.response?.data?.error || '';
      const msg =
        code === 'email_in_use'
          ? 'That email is already registered. Try logging in.'
          : code === 'invalid_credentials'
            ? 'Incorrect email or password.'
            : tab === 'register'
              ? 'Could not create your account.'
              : 'Could not log you in.';
      toast(msg, 'error');
    } finally {
      setBusy(false);
    }
  }, [email, password, displayName, tab, finish, toast]);

  const requestOtp = useCallback(async () => {
    if (!email) {
      toast('Enter your email first.', 'info');
      return;
    }
    setBusy(true);
    try {
      await api.post('/auth/otp/request', { email });
      setOtpSent(true);
      toast('We sent a 6-digit code to your email.', 'success');
    } catch {
      toast('Could not send the code. Please retry.', 'error');
    } finally {
      setBusy(false);
    }
  }, [email, toast]);

  const verifyOtp = useCallback(async () => {
    if (code.length !== 6) {
      toast('Enter the 6-digit code.', 'info');
      return;
    }
    setBusy(true);
    try {
      const { data } = await api.post('/auth/otp/verify', { email, code });
      await finish(data);
    } catch {
      toast('Invalid or expired code.', 'error');
    } finally {
      setBusy(false);
    }
  }, [code, email, finish, toast]);

  const continueAsGuest = useCallback(async () => {
    setBusy(true);
    try {
      const { data } = await api.post('/auth/guest');
      await finish(data);
    } catch {
      toast('Could not start a guest session.', 'error');
    } finally {
      setBusy(false);
    }
  }, [finish, toast]);

  const tabBtn = (t: Tab, label: string) => (
    <button
      type="button"
      onClick={() => {
        setTab(t);
        setOtpSent(false);
        setCode('');
      }}
      className={`h-9 flex-1 rounded-lg text-sm font-medium transition ${
        tab === t ? 'bg-white/10 text-white' : 'text-white/50 hover:text-white/80'
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="relative flex min-h-screen flex-col">
      <Background />
      <header className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-4 sm:px-6">
        <Logo />
        <Link href="/" className="btn-ghost h-9 !py-2 text-sm">
          <ArrowLeft className="h-4 w-4" /> Home
        </Link>
      </header>

      <main className="flex flex-1 items-center justify-center px-4 py-8">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md rounded-3xl glass-strong p-7 shadow-glow-lg"
        >
          <h1 className="text-center font-display text-2xl font-bold text-white">
            Welcome to StrangerChat
          </h1>
          <p className="mt-1 text-center text-sm text-white/55">
            Log in to save preferences, go Premium, and sync across devices.
          </p>

          <div className="mt-6 flex gap-1 rounded-xl bg-white/[0.04] p-1">
            {tabBtn('login', 'Log in')}
            {tabBtn('register', 'Sign up')}
            {tabBtn('otp', 'Email code')}
          </div>

          <div className="mt-5 space-y-3">
            <label className="block">
              <span className="mb-1 block text-xs text-white/50">Email</span>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/35" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="input pl-10"
                  autoComplete="email"
                />
              </div>
            </label>

            {tab === 'register' && (
              <label className="block">
                <span className="mb-1 block text-xs text-white/50">Display name (optional)</span>
                <div className="relative">
                  <UserCircle2 className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/35" />
                  <input
                    type="text"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="How others see you"
                    maxLength={40}
                    className="input pl-10"
                  />
                </div>
              </label>
            )}

            {tab !== 'otp' && (
              <label className="block">
                <span className="mb-1 block text-xs text-white/50">Password</span>
                <div className="relative">
                  <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/35" />
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handlePassword()}
                    placeholder="••••••••"
                    className="input pl-10"
                    autoComplete={tab === 'register' ? 'new-password' : 'current-password'}
                  />
                </div>
              </label>
            )}

            {tab === 'otp' && otpSent && (
              <label className="block">
                <span className="mb-1 block text-xs text-white/50">6-digit code</span>
                <div className="relative">
                  <KeyRound className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/35" />
                  <input
                    inputMode="numeric"
                    value={code}
                    onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    onKeyDown={(e) => e.key === 'Enter' && verifyOtp()}
                    placeholder="123456"
                    className="input pl-10 tracking-[0.4em]"
                  />
                </div>
              </label>
            )}

            {tab === 'login' && (
              <button type="button" onClick={handlePassword} disabled={busy} className="btn-primary h-12 w-full">
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Log in'}
              </button>
            )}
            {tab === 'register' && (
              <button type="button" onClick={handlePassword} disabled={busy} className="btn-primary h-12 w-full">
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Create account'}
              </button>
            )}
            {tab === 'otp' && (
              <button
                type="button"
                onClick={otpSent ? verifyOtp : requestOtp}
                disabled={busy}
                className="btn-primary h-12 w-full"
              >
                {busy ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : otpSent ? (
                  'Verify & continue'
                ) : (
                  'Send code'
                )}
              </button>
            )}
            {tab === 'otp' && otpSent && (
              <button
                type="button"
                onClick={requestOtp}
                disabled={busy}
                className="w-full text-center text-xs text-white/45 hover:text-white/70"
              >
                Resend code
              </button>
            )}
          </div>

          <div className="my-5 flex items-center gap-3 text-xs text-white/30">
            <span className="h-px flex-1 bg-white/10" /> or <span className="h-px flex-1 bg-white/10" />
          </div>

          {GOOGLE_CLIENT_ID ? (
            <div ref={googleBtnRef} className="flex justify-center" />
          ) : (
            <p className="text-center text-xs text-white/35">
              Google sign-in isn’t configured on this deployment.
            </p>
          )}

          <button
            type="button"
            onClick={continueAsGuest}
            disabled={busy}
            className="btn-ghost mt-3 h-11 w-full text-sm"
          >
            Continue anonymously
          </button>

          <p className="mt-4 text-center text-[11px] leading-relaxed text-white/35">
            By continuing you agree to our Terms of Service and acknowledge our
            Privacy Policy. You must be 18 or older to use StrangerChat.
          </p>
        </motion.div>
      </main>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-ink-950" />}>
      <LoginInner />
    </Suspense>
  );
}
