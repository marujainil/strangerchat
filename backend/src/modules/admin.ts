import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../config/prisma';
import { redis } from '../config/redis';
import { matchingEngine } from '../matching/queue';
import { asyncHandler, HttpError } from '../middleware/error';
import { requireAuth, requireRole } from '../middleware/auth';

export const adminRouter = Router();
adminRouter.use(requireAuth, requireRole('ADMIN', 'MODERATOR'));

/* ---------- dashboard ---------- */
adminRouter.get('/stats', asyncHandler(async (_req, res) => {
  const [users, premium, banned, activeSubs, openReports, payments, revenueAgg] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { isPremium: true } }),
    prisma.user.count({ where: { isBanned: true } }),
    prisma.subscription.count({ where: { status: 'ACTIVE', expiresAt: { gt: new Date() } } }),
    prisma.report.count({ where: { resolved: false } }),
    prisma.payment.count({ where: { status: 'SUCCESS' } }),
    prisma.payment.aggregate({ _sum: { amountInr: true }, where: { status: 'SUCCESS' } }),
  ]);
  const online = Number((await redis.get('online:count')) ?? 0);
  const waiting = await matchingEngine.waitingCount();
  res.json({
    users, premium, banned, activeSubs, openReports, payments,
    revenueInr: revenueAgg._sum.amountInr ?? 0,
    online: Math.max(0, online), waiting,
  });
}));

// payments-per-day + revenue-per-day (last 30d)
adminRouter.get('/analytics/revenue', asyncHandler(async (_req, res) => {
  const rows = await prisma.$queryRaw<{ day: string; count: bigint; revenue: bigint }[]>`
    SELECT to_char(date_trunc('day', "createdAt"), 'YYYY-MM-DD') AS day,
           count(*) AS count, COALESCE(sum("amountInr"),0) AS revenue
    FROM "Payment" WHERE "status" = 'SUCCESS' AND "createdAt" > now() - interval '30 days'
    GROUP BY 1 ORDER BY 1`;
  res.json({ series: rows.map((r) => ({ day: r.day, count: Number(r.count), revenue: Number(r.revenue) })) });
}));

// usage heatmap: connections by weekday/hour
adminRouter.get('/analytics/heatmap', asyncHandler(async (_req, res) => {
  const rows = await prisma.$queryRaw<{ dow: number; hour: number; count: bigint }[]>`
    SELECT extract(dow from "startedAt")::int AS dow,
           extract(hour from "startedAt")::int AS hour, count(*) AS count
    FROM "Connection" WHERE "startedAt" > now() - interval '30 days'
    GROUP BY 1,2 ORDER BY 1,2`;
  res.json({ cells: rows.map((r) => ({ dow: r.dow, hour: r.hour, count: Number(r.count) })) });
}));

/* ---------- users / moderation ---------- */
adminRouter.get('/users', asyncHandler(async (req, res) => {
  const { q, page = '1', banned } = req.query as Record<string, string>;
  const take = 25; const skip = (Number(page) - 1) * take;
  const where: any = {};
  if (q) where.OR = [{ email: { contains: q, mode: 'insensitive' } }, { displayName: { contains: q, mode: 'insensitive' } }, { id: q }];
  if (banned === 'true') where.isBanned = true;
  const [items, total] = await Promise.all([
    prisma.user.findMany({ where, take, skip, orderBy: { createdAt: 'desc' },
      select: { id: true, email: true, displayName: true, isPremium: true, isBanned: true, reportCount: true, countryCode: true, createdAt: true, lastSeenAt: true } }),
    prisma.user.count({ where }),
  ]);
  res.json({ items, total, page: Number(page), pages: Math.ceil(total / take) });
}));

adminRouter.post('/users/:id/ban', requireRole('ADMIN'), asyncHandler(async (req, res) => {
  const { reason, until } = z.object({ reason: z.string().max(200).optional(), until: z.string().datetime().optional() }).parse(req.body);
  await prisma.user.update({ where: { id: req.params.id }, data: { isBanned: true, banReason: reason, bannedUntil: until ? new Date(until) : null } });
  await prisma.refreshToken.updateMany({ where: { userId: req.params.id }, data: { revoked: true } });
  res.json({ ok: true });
}));

adminRouter.post('/users/:id/unban', requireRole('ADMIN'), asyncHandler(async (req, res) => {
  await prisma.user.update({ where: { id: req.params.id }, data: { isBanned: false, banReason: null, bannedUntil: null } });
  res.json({ ok: true });
}));

/* ---------- reports ---------- */
adminRouter.get('/reports', asyncHandler(async (req, res) => {
  const resolved = (req.query.resolved as string) === 'true';
  const reports = await prisma.report.findMany({
    where: { resolved }, orderBy: { createdAt: 'desc' }, take: 100,
    include: {
      reporter: { select: { id: true, displayName: true } },
      reported: { select: { id: true, displayName: true, reportCount: true, isBanned: true } },
    },
  });
  res.json({ reports });
}));

adminRouter.post('/reports/:id/resolve', asyncHandler(async (req, res) => {
  await prisma.report.update({ where: { id: req.params.id }, data: { resolved: true } });
  res.json({ ok: true });
}));

/* ---------- payments ---------- */
adminRouter.get('/payments', asyncHandler(async (req, res) => {
  const page = Number((req.query.page as string) ?? 1); const take = 25;
  const [items, total] = await Promise.all([
    prisma.payment.findMany({ take, skip: (page - 1) * take, orderBy: { createdAt: 'desc' },
      include: { user: { select: { id: true, email: true } }, plan: true } }),
    prisma.payment.count(),
  ]);
  res.json({ items, total, page, pages: Math.ceil(total / take) });
}));

/* ---------- plan management ---------- */
const planSchema = z.object({
  code: z.string(), name: z.string(),
  interval: z.enum(['MONTHLY', 'HALF_YEARLY', 'YEARLY']),
  priceInr: z.number().int().positive(), durationDays: z.number().int().positive(),
  features: z.array(z.string()).optional(), active: z.boolean().optional(),
});
adminRouter.post('/plans', requireRole('ADMIN'), asyncHandler(async (req, res) => {
  const data = planSchema.parse(req.body);
  res.json({ plan: await prisma.plan.create({ data: { ...data, features: data.features ?? [] } }) });
}));
adminRouter.patch('/plans/:id', requireRole('ADMIN'), asyncHandler(async (req, res) => {
  res.json({ plan: await prisma.plan.update({ where: { id: req.params.id }, data: planSchema.partial().parse(req.body) }) });
}));

/* ---------- country / interest management ---------- */
adminRouter.post('/countries', requireRole('ADMIN'), asyncHandler(async (req, res) => {
  const data = z.object({ code: z.string().length(2), name: z.string(), dialCode: z.string().optional(), flagEmoji: z.string().optional(), enabled: z.boolean().optional() }).parse(req.body);
  res.json({ country: await prisma.country.upsert({ where: { code: data.code }, create: data, update: data }) });
}));
adminRouter.post('/interests', requireRole('ADMIN'), asyncHandler(async (req, res) => {
  const data = z.object({ slug: z.string(), label: z.string(), enabled: z.boolean().optional() }).parse(req.body);
  res.json({ interest: await prisma.interest.upsert({ where: { slug: data.slug }, create: data, update: data }) });
}));

/* ---------- logs & settings ---------- */
adminRouter.get('/logs', asyncHandler(async (req, res) => {
  const page = Number((req.query.page as string) ?? 1); const take = 50;
  const items = await prisma.log.findMany({ take, skip: (page - 1) * take, orderBy: { createdAt: 'desc' } });
  res.json({ items });
}));

adminRouter.get('/settings/:key', asyncHandler(async (req, res) => {
  const s = await prisma.adminSetting.findUnique({ where: { key: req.params.key } });
  if (!s) throw new HttpError(404, 'not_found');
  res.json({ setting: s });
}));
adminRouter.put('/settings/:key', requireRole('ADMIN'), asyncHandler(async (req, res) => {
  const { value } = z.object({ value: z.any() }).parse(req.body);
  const s = await prisma.adminSetting.upsert({ where: { key: req.params.key }, create: { key: req.params.key, value }, update: { value } });
  res.json({ setting: s });
}));
