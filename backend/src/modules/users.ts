import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../config/prisma';
import { redis } from '../config/redis';
import { matchingEngine } from '../matching/queue';
import { asyncHandler, HttpError } from '../middleware/error';
import { requireAuth } from '../middleware/auth';

export const userRouter = Router();

function publicUser(u: any) {
  return {
    id: u.id, email: u.email, displayName: u.displayName, avatarUrl: u.avatarUrl, bio: u.bio,
    role: u.role, gender: u.gender, age: u.age, countryCode: u.countryCode, city: u.city,
    languages: u.languages, relationship: u.relationship,
    isPremium: u.isPremium, isVerified: u.isVerified, isGuest: u.isGuest,
    interests: (u.interests ?? []).map((ui: any) => ui.interest?.slug ?? ui.interestId),
  };
}

userRouter.get('/me', requireAuth, asyncHandler(async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.user!.sub },
    include: { interests: { include: { interest: true } } },
  });
  if (!user) throw new HttpError(404, 'not_found');
  res.json({ user: publicUser(user) });
}));

const profileSchema = z.object({
  displayName: z.string().min(1).max(40).optional(),
  bio: z.string().max(300).optional(),
  gender: z.enum(['MALE', 'FEMALE', 'NONBINARY', 'UNKNOWN']).optional(),
  age: z.number().int().min(18).max(120).optional(),
  countryCode: z.string().length(2).optional(),
  city: z.string().max(80).optional(),
  languages: z.array(z.string()).max(10).optional(),
  relationship: z.enum(['SINGLE', 'TAKEN', 'COMPLICATED', 'PREFER_NOT']).optional(),
  interests: z.array(z.string()).max(20).optional(), // interest slugs
});

userRouter.patch('/me', requireAuth, asyncHandler(async (req, res) => {
  const data = profileSchema.parse(req.body);
  const { interests, ...rest } = data;

  await prisma.user.update({ where: { id: req.user!.sub }, data: rest as any });

  if (interests) {
    const found = await prisma.interest.findMany({ where: { slug: { in: interests } } });
    await prisma.$transaction([
      prisma.userInterest.deleteMany({ where: { userId: req.user!.sub } }),
      prisma.userInterest.createMany({
        data: found.map((i) => ({ userId: req.user!.sub, interestId: i.id })),
        skipDuplicates: true,
      }),
    ]);
  }

  const user = await prisma.user.findUnique({
    where: { id: req.user!.sub }, include: { interests: { include: { interest: true } } },
  });
  res.json({ user: publicUser(user) });
}));

userRouter.post('/report', requireAuth, asyncHandler(async (req, res) => {
  const { targetId, reason, details, connectionId } = z.object({
    targetId: z.string(),
    reason: z.enum(['NUDITY', 'HARASSMENT', 'SPAM', 'UNDERAGE', 'HATE', 'VIOLENCE', 'OTHER']),
    details: z.string().max(1000).optional(),
    connectionId: z.string().optional(),
  }).parse(req.body);
  if (targetId === req.user!.sub) throw new HttpError(400, 'cannot_report_self');

  await prisma.$transaction([
    prisma.report.create({ data: { reporterId: req.user!.sub, reportedId: targetId, reason, details, connectionId } }),
    prisma.user.update({ where: { id: targetId }, data: { reportCount: { increment: 1 } } }),
  ]);
  res.json({ ok: true });
}));

userRouter.post('/block', requireAuth, asyncHandler(async (req, res) => {
  const { targetId } = z.object({ targetId: z.string() }).parse(req.body);
  if (targetId === req.user!.sub) throw new HttpError(400, 'cannot_block_self');
  await prisma.blockedUser.upsert({
    where: { blockerId_blockedId: { blockerId: req.user!.sub, blockedId: targetId } },
    create: { blockerId: req.user!.sub, blockedId: targetId },
    update: {},
  });
  res.json({ ok: true });
}));

userRouter.delete('/block/:targetId', requireAuth, asyncHandler(async (req, res) => {
  await prisma.blockedUser.deleteMany({ where: { blockerId: req.user!.sub, blockedId: req.params.targetId } });
  res.json({ ok: true });
}));

userRouter.get('/blocks', requireAuth, asyncHandler(async (req, res) => {
  const blocks = await prisma.blockedUser.findMany({
    where: { blockerId: req.user!.sub },
    include: { blocked: { select: { id: true, displayName: true, countryCode: true } } },
  });
  res.json({ blocks });
}));

userRouter.get('/online', asyncHandler(async (_req, res) => {
  const online = Number((await redis.get('online:count')) ?? 0);
  const waiting = await matchingEngine.waitingCount();
  res.json({ online: Math.max(0, online), waiting });
}));

/* lightweight public reference data */
userRouter.get('/countries', asyncHandler(async (_req, res) => {
  const countries = await prisma.country.findMany({ where: { enabled: true }, orderBy: { name: 'asc' } });
  res.json({ countries });
}));

userRouter.get('/interests', asyncHandler(async (_req, res) => {
  const interests = await prisma.interest.findMany({ where: { enabled: true }, orderBy: { label: 'asc' } });
  res.json({ interests });
}));
