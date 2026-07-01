'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowLeft, CreditCard, QrCode, ShieldCheck, X } from 'lucide-react';
import { api, setAccessToken, getAccessToken } from '@/lib/api';
import { useAuth, useToast } from '@/app/providers';
import { Background } from '@/components/Background';
import { Logo } from '@/components/Logo';
import { PlanCard } from '@/components/PlanCard';
import type { Plan } from '@/lib/types';

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => { open: () => void };
  }
}

interface PayConfig {
  razorpayKeyId: string | null;
  upiId: string;
  upiName: string;
}

interface UpiSession {
  paymentId: string;
  qr: string;
  upiString: string;
  amount: number;
  txnRef: string;
  planName: string;
}

function loadRazorpay(): Promise<boolean> {
  return new Promise((resolve) => {
    if (window.Razorpay) return resolve(true);
    const s = document.createElement('script');
    s.src = 'https://checkout.razorpay.com/v1/checkout.js';
    s.onload = () => resolve(true);
    s.onerror = () => resolve(false);
    document.body.appendChild(s);
  });
}

export default function PremiumPage() {
  const router = useRouter();
  const { user, setUser, refreshMe } = useAuth();
  const { toast } = useToast();

  const [plans, setPlans] = useState<Plan[]>([]);
  const [config, setConfig] = useState<PayConfig | null>(null);
  const [method, setMethod] = useState<'razorpay' | 'upi'>('razorpay');
  const [busyPlan, setBusyPlan] = useState<string | null>(null);
  const [upi, setUpi] = useState<UpiSession | null>(null);

  // Ensure a session exists so payment endpoints (which require auth) work.
  useEffect(() => {
    if (getAccessToken() || user) return;
    (async () => {
      try {
        const { data } = await api.post('/auth/guest');
        setAccessToken(data.accessToken);
        setUser(data.user);
      } catch {
        /* ignore — handled on action */
      }
    })();
  }, [user, setUser]);

  useEffect(() => {
    Promise.all([
      api.get('/payments/plans').catch(() => ({ data: { plans: [] } })),
      api.get('/payments/config').catch(() => ({ data: null })),
    ]).then(([p, c]) => {
      setPlans(p.data.plans ?? []);
      setConfig(c.data ?? null);
      if (c.data && !c.data.razorpayKeyId) setMethod('upi');
    });
  }, []);

  const payWithRazorpay = useCallback(
    async (plan: Plan) => {
      setBusyPlan(plan.id);
      try {
        const ok = await loadRazorpay();
        if (!ok) {
          toast('Could not load the payment SDK. Try the UPI QR option.', 'error');
          return;
        }
        const { data: order } = await api.post('/payments/order', { planId: plan.id });
        const keyId = order.keyId || config?.razorpayKeyId;
        if (!keyId) {
          toast('Card payments are not configured. Use the UPI QR option.', 'error');
          return;
        }
        const rzp = new window.Razorpay!({
          key: keyId,
          amount: order.amount,
          currency: order.currency,
          name: 'StrangerChat',
          description: `${order.planName} subscription`,
          order_id: order.orderId,
          theme: { color: '#7c3aed' },
          prefill: user?.email ? { email: user.email } : undefined,
          handler: async (resp: Record<string, string>) => {
            try {
              await api.post('/payments/verify', {
                razorpayOrderId: resp.razorpay_order_id,
                razorpayPaymentId: resp.razorpay_payment_id,
                razorpaySignature: resp.razorpay_signature,
              });
              await refreshMe();
              router.push('/payment/success');
            } catch {
              router.push('/payment/failed');
            }
          },
          modal: {
            ondismiss: () => toast('Payment cancelled.', 'info'),
          },
        });
        rzp.open();
      } catch (e: unknown) {
        const msg =
          (e as { response?: { data?: { error?: string } } })?.response?.data?.error ||
          'Could not start checkout.';
        toast(msg, 'error');
      } finally {
        setBusyPlan(null);
      }
    },
    [config, user, refreshMe, router, toast]
  );

  const payWithUpi = useCallback(
    async (plan: Plan) => {
      setBusyPlan(plan.id);
      try {
        const { data } = await api.post('/payments/upi-qr', { planId: plan.id });
        setUpi({ ...data, planName: plan.name });
      } catch {
        toast('Could not generate a UPI QR. Please retry.', 'error');
      } finally {
        setBusyPlan(null);
      }
    },
    [toast]
  );

  const onSelect = useCallback(
    (plan: Plan) => (method === 'razorpay' ? payWithRazorpay(plan) : payWithUpi(plan)),
    [method, payWithRazorpay, payWithUpi]
  );

  // Poll the UPI payment status while the QR modal is open.
  useEffect(() => {
    if (!upi) return;
    const id = setInterval(async () => {
      try {
        const { data } = await api.get(`/payments/${upi.paymentId}/status`);
        if (data.status === 'SUCCESS') {
          clearInterval(id);
          await refreshMe();
          router.push('/payment/success');
        }
      } catch {
        /* keep polling */
      }
    }, 4000);
    return () => clearInterval(id);
  }, [upi, refreshMe, router]);

  const popularCode = plans.find((p) => p.interval === 'YEARLY')?.code;

  return (
    <div className="relative min-h-screen">
      <Background />
      <header className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Logo />
        <Link href="/chat" className="btn-ghost h-9 !py-2 text-sm">
          <ArrowLeft className="h-4 w-4" /> Back to chat
        </Link>
      </header>

      <main className="mx-auto w-full max-w-6xl px-4 pb-16 pt-6 sm:px-6">
        <div className="mx-auto max-w-2xl text-center">
          <span className="chip border-violet/30 text-violet-glow">
            <ShieldCheck className="h-3.5 w-3.5" /> Cancel anytime
          </span>
          <h1 className="mt-4 font-display text-4xl font-bold text-white sm:text-5xl">
            Meet exactly who you <span className="gradient-text">want</span>
          </h1>
          <p className="mt-3 text-white/60">
            Free random chat is always unlimited. Premium unlocks unlimited
            filtering — gender, country, language, interests and more — with
            priority matching and an ad-free experience.
          </p>
        </div>

        {/* Payment method switch */}
        <div className="mx-auto mt-8 flex w-full max-w-xs items-center rounded-2xl glass p-1">
          <button
            type="button"
            onClick={() => setMethod('razorpay')}
            disabled={!config?.razorpayKeyId}
            className={`flex h-10 flex-1 items-center justify-center gap-2 rounded-xl text-sm font-medium transition disabled:opacity-40 ${
              method === 'razorpay' ? 'bg-violet-grad text-white shadow-glow' : 'text-white/60'
            }`}
          >
            <CreditCard className="h-4 w-4" /> Card / UPI
          </button>
          <button
            type="button"
            onClick={() => setMethod('upi')}
            className={`flex h-10 flex-1 items-center justify-center gap-2 rounded-xl text-sm font-medium transition ${
              method === 'upi' ? 'bg-violet-grad text-white shadow-glow' : 'text-white/60'
            }`}
          >
            <QrCode className="h-4 w-4" /> UPI QR
          </button>
        </div>
        {method === 'razorpay' && !config?.razorpayKeyId && (
          <p className="mt-3 text-center text-xs text-amber-300/80">
            Razorpay keys aren’t configured on this server — use the UPI QR option.
          </p>
        )}

        <div className="mt-10 grid grid-cols-1 gap-5 md:grid-cols-3">
          {plans.length === 0
            ? [0, 1, 2].map((i) => (
                <div key={i} className="h-80 rounded-3xl shimmer" />
              ))
            : plans.map((plan) => (
                <PlanCard
                  key={plan.id}
                  plan={plan}
                  popular={plan.code === popularCode}
                  loading={busyPlan === plan.id}
                  onSelect={onSelect}
                />
              ))}
        </div>

        <p className="mt-8 text-center text-xs text-white/40">
          Payments are processed securely. By subscribing you agree to our Terms
          and Privacy Policy. Prices in INR, inclusive of applicable taxes.
        </p>
      </main>

      {/* UPI QR modal */}
      <AnimatePresence>
        {upi && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setUpi(null)}
            className="fixed inset-0 z-[95] flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.94, y: 16, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0.94, y: 16, opacity: 0 }}
              transition={{ type: 'spring', damping: 24, stiffness: 280 }}
              onClick={(e) => e.stopPropagation()}
              className="relative w-full max-w-sm overflow-hidden rounded-3xl glass-strong p-6 text-center shadow-glow-lg"
            >
              <button
                type="button"
                onClick={() => setUpi(null)}
                aria-label="Close"
                className="absolute right-4 top-4 text-white/40 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
              <h2 className="font-display text-xl font-bold text-white">
                Scan to pay ₹{upi.amount}
              </h2>
              <p className="mt-1 text-sm text-white/60">{upi.planName} plan</p>
              <div className="mx-auto mt-5 w-fit rounded-2xl bg-white p-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={upi.qr} alt="UPI payment QR code" className="h-56 w-56" />
              </div>
              <p className="mt-4 break-all text-xs text-white/50">
                UPI ID: <span className="text-white/80">{config?.upiId}</span>
              </p>
              <p className="mt-1 text-xs text-white/40">Ref: {upi.txnRef}</p>
              <div className="mt-4 flex items-center justify-center gap-2 text-sm text-violet-glow">
                <span className="h-2 w-2 animate-pulse rounded-full bg-violet-glow" />
                Waiting for payment confirmation…
              </div>
              <p className="mt-3 text-[11px] leading-relaxed text-white/40">
                Open any UPI app, scan this code and pay. Direct-UPI payments are
                confirmed once the transaction is verified. For instant
                activation, use the Card / UPI (Razorpay) option.
              </p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
