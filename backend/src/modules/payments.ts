import { Router } from 'express';
import crypto from 'crypto';
import Razorpay from 'razorpay';
import QRCode from 'qrcode';
import { z } from 'zod';
import { prisma } from '../config/prisma';
import { redis } from '../config/redis';
import { env } from '../config/env';
import { logger } from '../utils/logger';
import { asyncHandler, HttpError } from '../middleware/error';
import { requireAuth } from '../middleware/auth';
import { paymentLimiter } from '../middleware/rateLimit';

export const paymentRouter = Router();
export const webhookRouter = Router(); // mounted with express.raw in app.ts

const razorpay =
  env.RAZORPAY_KEY_ID && env.RAZORPAY_KEY_SECRET
    ? new Razorpay({ key_id: env.RAZORPAY_KEY_ID, key_secret: env.RAZORPAY_KEY_SECRET })
    : null;

/* ---------- helpers ---------- */
function gstSplit(totalInr: number) {
  // prices are GST-inclusive; split 18% out for the invoice
  const tax = Math.round((totalInr * 18) / 118);
  return { amountInr: totalInr - tax, taxInr: tax, totalInr };
}

async function nextInvoiceNumber(): Promise<string> {
  const seq = await redis.incr('invoice:seq');
  return `INV-${new Date().getFullYear()}-${String(seq).padStart(6, '0')}`;
}

/**
 * Activates a subscription for a SUCCESS payment, idempotently.
 * Sets the user premium, creates the Subscription + Invoice.
 */
async function activate(paymentId: string) {
  const payment = await prisma.payment.findUnique({ where: { id: paymentId }, include: { plan: true } });
  if (!payment || !payment.plan) throw new HttpError(400, 'payment_or_plan_missing');
  if (payment.subscriptionId) return payment; // already activated

  const expiresAt = new Date(Date.now() + payment.plan.durationDays * 86_400_000);
  const split = gstSplit(payment.amountInr);

  return prisma.$transaction(async (tx) => {
    const sub = await tx.subscription.create({
      data: {
        userId: payment.userId, planId: payment.planId!,
        status: 'ACTIVE', startedAt: new Date(), expiresAt,
      },
    });
    const updated = await tx.payment.update({
      where: { id: payment.id },
      data: { status: 'SUCCESS', subscriptionId: sub.id },
      include: { plan: true },
    });
    await tx.user.update({ where: { id: payment.userId }, data: { isPremium: true } });
    await tx.invoice.create({
      data: {
        number: await nextInvoiceNumber(),
        userId: payment.userId, paymentId: payment.id,
        amountInr: split.amountInr, taxInr: split.taxInr, totalInr: split.totalInr,
      },
    });
    await tx.analyticsEvent.create({
      data: { userId: payment.userId, name: 'payment_success', props: { planId: payment.planId, amount: payment.amountInr } },
    });
    logger.info('subscription activated', { userId: payment.userId, sub: sub.id, expiresAt });
    return updated;
  });
}

/* ---------- public/plan routes ---------- */
paymentRouter.get('/plans', asyncHandler(async (_req, res) => {
  const plans = await prisma.plan.findMany({ where: { active: true }, orderBy: { priceInr: 'asc' } });
  res.json({ plans });
}));

paymentRouter.get('/config', (_req, res) => {
  res.json({ razorpayKeyId: env.RAZORPAY_KEY_ID ?? null, upiId: env.UPI_ID, upiName: env.UPI_NAME });
});

/* ---------- Razorpay checkout (fully auto-verified) ---------- */
paymentRouter.post('/order', requireAuth, paymentLimiter, asyncHandler(async (req, res) => {
  if (!razorpay) throw new HttpError(503, 'razorpay_not_configured');
  const { planId } = z.object({ planId: z.string() }).parse(req.body);
  const plan = await prisma.plan.findUnique({ where: { id: planId } });
  if (!plan || !plan.active) throw new HttpError(404, 'plan_not_found');

  const order = await razorpay.orders.create({
    amount: plan.priceInr * 100, // paise
    currency: 'INR',
    receipt: `sc_${req.user!.sub.slice(0, 8)}_${Date.now()}`,
    notes: { userId: req.user!.sub, planId: plan.id },
  });

  await prisma.payment.create({
    data: {
      userId: req.user!.sub, planId: plan.id, method: 'RAZORPAY',
      status: 'CREATED', amountInr: plan.priceInr, razorpayOrderId: order.id,
    },
  });

  res.json({
    orderId: order.id, amount: order.amount, currency: order.currency,
    keyId: env.RAZORPAY_KEY_ID, planId: plan.id, planName: plan.name,
  });
}));

// Client-side handler signature verification -> instant activation
paymentRouter.post('/verify', requireAuth, asyncHandler(async (req, res) => {
  if (!env.RAZORPAY_KEY_SECRET) throw new HttpError(503, 'razorpay_not_configured');
  const { razorpayOrderId, razorpayPaymentId, razorpaySignature } = z.object({
    razorpayOrderId: z.string(), razorpayPaymentId: z.string(), razorpaySignature: z.string(),
  }).parse(req.body);

  const expected = crypto
    .createHmac('sha256', env.RAZORPAY_KEY_SECRET)
    .update(`${razorpayOrderId}|${razorpayPaymentId}`)
    .digest('hex');
  if (!crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(razorpaySignature))) {
    throw new HttpError(400, 'signature_mismatch');
  }

  const payment = await prisma.payment.findUnique({ where: { razorpayOrderId } });
  if (!payment || payment.userId !== req.user!.sub) throw new HttpError(404, 'payment_not_found');

  await prisma.payment.update({
    where: { id: payment.id },
    data: { razorpayPaymentId, razorpaySignature, status: 'PENDING' },
  });
  const activated = await activate(payment.id);
  const sub = await prisma.subscription.findUnique({ where: { id: activated.subscriptionId! } });
  res.json({ ok: true, subscription: sub });
}));

/* ---------- Dynamic UPI QR ----------
 * Generates a UPI intent QR for the configured VPA. NOTE: a static-VPA UPI
 * deep link has no payment callback, so it cannot be programmatically
 * auto-verified. For automatic verification + instant activation use the
 * Razorpay flow above (Razorpay also renders a UPI QR inside checkout and
 * fires the webhook below). This endpoint is provided for direct-UPI flows;
 * confirmation comes via /upi/confirm (admin/PSP) or status polling.
 */
paymentRouter.post('/upi-qr', requireAuth, paymentLimiter, asyncHandler(async (req, res) => {
  const { planId } = z.object({ planId: z.string() }).parse(req.body);
  const plan = await prisma.plan.findUnique({ where: { id: planId } });
  if (!plan || !plan.active) throw new HttpError(404, 'plan_not_found');

  const payment = await prisma.payment.create({
    data: { userId: req.user!.sub, planId: plan.id, method: 'UPI_QR', status: 'PENDING', amountInr: plan.priceInr },
  });

  const txnRef = `SC${payment.id.slice(-12).toUpperCase()}`;
  const params = new URLSearchParams({
    pa: env.UPI_ID,
    pn: env.UPI_NAME,
    am: String(plan.priceInr),
    cu: 'INR',
    tn: `${env.UPI_NAME} ${plan.name}`,
    tr: txnRef,
  });
  const upiString = `upi://pay?${params.toString()}`;
  await prisma.payment.update({ where: { id: payment.id }, data: { upiString } });

  const qr = await QRCode.toDataURL(upiString, { errorCorrectionLevel: 'M', margin: 1, width: 320 });
  res.json({ paymentId: payment.id, qr, upiString, amount: plan.priceInr, txnRef });
}));

// Poll a UPI payment status (frontend polls until SUCCESS)
paymentRouter.get('/:id/status', requireAuth, asyncHandler(async (req, res) => {
  const p = await prisma.payment.findUnique({ where: { id: req.params.id } });
  if (!p || p.userId !== req.user!.sub) throw new HttpError(404, 'not_found');

  // Direct UPI-QR payments have no bank callback. With UPI_AUTO_APPROVE on, treat
  // the payment as received a few seconds after the QR was shown, so the user's
  // premium activates. For real money set UPI_AUTO_APPROVE=false and confirm via
  // /upi/confirm (admin) or use the Razorpay flow above.
  if (
    env.UPI_AUTO_APPROVE &&
    p.method === 'UPI_QR' &&
    p.status === 'PENDING' &&
    Date.now() - p.createdAt.getTime() >= env.UPI_AUTO_APPROVE_DELAY_SEC * 1000
  ) {
    await activate(p.id);
    return res.json({ status: 'SUCCESS' });
  }

  res.json({ status: p.status });
}));

// User taps "I've paid" on the UPI QR screen. With UPI_AUTO_APPROVE on this
// activates premium immediately; otherwise it flags the payment for review.
paymentRouter.post('/upi/claim', requireAuth, asyncHandler(async (req, res) => {
  const { paymentId } = z.object({ paymentId: z.string(), utr: z.string().optional() }).parse(req.body);
  const p = await prisma.payment.findUnique({ where: { id: paymentId } });
  if (!p || p.userId !== req.user!.sub) throw new HttpError(404, 'not_found');
  if (p.status === 'SUCCESS') return res.json({ ok: true, status: 'SUCCESS' });

  if (env.UPI_AUTO_APPROVE) {
    await activate(p.id);
    return res.json({ ok: true, status: 'SUCCESS' });
  }
  res.json({ ok: true, status: 'PENDING', message: 'Payment submitted for verification.' });
}));

// Admin/PSP confirmation for a direct-UPI payment (until a PSP webhook is wired)
paymentRouter.post('/upi/confirm', requireAuth, asyncHandler(async (req, res) => {
  if (req.user!.role !== 'ADMIN') throw new HttpError(403, 'forbidden');
  const { paymentId, utr } = z.object({ paymentId: z.string(), utr: z.string().optional() }).parse(req.body);
  const p = await prisma.payment.findUnique({ where: { id: paymentId } });
  if (!p) throw new HttpError(404, 'not_found');
  if (p.status === 'SUCCESS') return res.json({ ok: true });
  await prisma.payment.update({ where: { id: p.id }, data: { razorpayPaymentId: utr ?? `UPI_${Date.now()}` } });
  await activate(p.id);
  res.json({ ok: true });
}));

/* ---------- user history ---------- */
paymentRouter.get('/invoices', requireAuth, asyncHandler(async (req, res) => {
  const invoices = await prisma.invoice.findMany({
    where: { userId: req.user!.sub },
    include: { payment: { include: { plan: true } } },
    orderBy: { issuedAt: 'desc' },
  });
  res.json({ invoices });
}));

paymentRouter.get('/subscription', requireAuth, asyncHandler(async (req, res) => {
  const sub = await prisma.subscription.findFirst({
    where: { userId: req.user!.sub, status: 'ACTIVE', expiresAt: { gt: new Date() } },
    include: { plan: true }, orderBy: { expiresAt: 'desc' },
  });
  res.json({ subscription: sub });
}));

/* ---------- Razorpay webhook (raw body, HMAC verified, idempotent) ---------- */
webhookRouter.post('/', asyncHandler(async (req, res) => {
  if (!env.RAZORPAY_WEBHOOK_SECRET) return res.status(503).json({ error: 'webhook_not_configured' });
  const signature = req.headers['x-razorpay-signature'] as string | undefined;
  const raw = (req as any).body as Buffer; // express.raw
  if (!signature || !Buffer.isBuffer(raw)) return res.status(400).json({ error: 'bad_request' });

  const expected = crypto.createHmac('sha256', env.RAZORPAY_WEBHOOK_SECRET).update(raw).digest('hex');
  if (!crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature))) {
    return res.status(401).json({ error: 'invalid_signature' });
  }

  const event = JSON.parse(raw.toString('utf8'));
  const eventId = (req.headers['x-razorpay-event-id'] as string) ?? event.id ?? crypto.randomUUID();

  // idempotency guard
  const fresh = await redis.set(`webhook:seen:${eventId}`, '1', 'EX', 86_400, 'NX');
  if (fresh !== 'OK') return res.json({ ok: true, duplicate: true });

  try {
    const type = event.event as string;
    if (type === 'payment.captured' || type === 'order.paid') {
      const orderId = event.payload?.payment?.entity?.order_id ?? event.payload?.order?.entity?.id;
      const paymentEntityId = event.payload?.payment?.entity?.id;
      if (orderId) {
        const payment = await prisma.payment.findUnique({ where: { razorpayOrderId: orderId } });
        if (payment && payment.status !== 'SUCCESS') {
          await prisma.payment.update({ where: { id: payment.id }, data: { razorpayPaymentId: paymentEntityId } });
          await activate(payment.id);
        }
      }
    } else if (type === 'payment.failed') {
      const orderId = event.payload?.payment?.entity?.order_id;
      if (orderId) {
        await prisma.payment.updateMany({
          where: { razorpayOrderId: orderId, status: { not: 'SUCCESS' } },
          data: { status: 'FAILED', failureReason: event.payload?.payment?.entity?.error_description ?? 'failed' },
        });
      }
    }
  } catch (e) {
    logger.error('webhook handler error', { e: (e as Error).message });
    // still 200 so Razorpay doesn't hammer retries on our internal bug; we logged it
  }
  res.json({ ok: true });
}));
