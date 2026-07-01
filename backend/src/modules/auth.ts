import { Router, Request, Response } from 'express';
import { randomUUID, randomBytes } from 'crypto';
import { z } from 'zod';
import { OAuth2Client } from 'google-auth-library';
import { prisma } from '../config/prisma';
import { env, isProd } from '../config/env';
import {
  signAccess, generateRefreshToken, hashToken, refreshExpiry,
} from '../utils/jwt';
import { hashPassword, verifyPassword } from '../utils/password';
import { generateOtp, hashOtp, OTP_TTL_MS, OTP_MAX_ATTEMPTS } from '../utils/otp';
import { sendMail } from '../utils/mailer';
import { asyncHandler, HttpError } from '../middleware/error';
import { requireAuth } from '../middleware/auth';
import { authLimiter, otpLimiter } from '../middleware/rateLimit';

export const authRouter = Router();
const google = env.GOOGLE_CLIENT_ID ? new OAuth2Client(env.GOOGLE_CLIENT_ID) : null;

/* ---------------- helpers ---------------- */
const REFRESH_COOKIE = 'refresh_token';

function setRefreshCookie(res: Response, token: string) {
  res.cookie(REFRESH_COOKIE, token, {
    httpOnly: true,
    secure: isProd,
    // Frontend (Netlify) and backend (Render) live on different hosts, so the
    // refresh cookie is cross-site and must be SameSite=None + Secure in prod.
    // (Lax in dev, where Secure can't be set over http://localhost.)
    sameSite: isProd ? 'none' : 'lax',
    domain: env.COOKIE_DOMAIN,
    path: '/api/auth',
    maxAge: env.REFRESH_TTL_DAYS * 24 * 60 * 60 * 1000,
  });
}
function clearRefreshCookie(res: Response) {
  res.clearCookie(REFRESH_COOKIE, { path: '/api/auth', domain: env.COOKIE_DOMAIN });
}

function publicUser(u: any) {
  return {
    id: u.id, email: u.email, displayName: u.displayName, avatarUrl: u.avatarUrl,
    role: u.role, gender: u.gender, age: u.age, countryCode: u.countryCode,
    languages: u.languages, relationship: u.relationship,
    isPremium: u.isPremium, isVerified: u.isVerified, isGuest: u.isGuest,
  };
}

async function issueTokens(user: any, req: Request, res: Response, family?: string) {
  const access = signAccess({
    sub: user.id, role: user.role, premium: user.isPremium, guest: user.isGuest,
  });
  const { token, hash } = generateRefreshToken();
  await prisma.refreshToken.create({
    data: {
      userId: user.id,
      tokenHash: hash,
      family: family ?? randomUUID(),
      userAgent: req.headers['user-agent']?.slice(0, 255),
      ip: req.ip,
      expiresAt: refreshExpiry(),
    },
  });
  setRefreshCookie(res, token);
  return access;
}

/* ---------------- schemas ---------------- */
const emailPw = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(128),
  displayName: z.string().min(1).max(40).optional(),
});

/* ---------------- routes ---------------- */

// Register (email + password)
authRouter.post('/register', authLimiter, asyncHandler(async (req, res) => {
  const { email, password, displayName } = emailPw.parse(req.body);
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) throw new HttpError(409, 'email_in_use');
  const user = await prisma.user.create({
    data: { email, passwordHash: await hashPassword(password), displayName, provider: 'EMAIL' },
  });
  const access = await issueTokens(user, req, res);
  res.status(201).json({ user: publicUser(user), accessToken: access });
}));

// Login (email + password)
authRouter.post('/login', authLimiter, asyncHandler(async (req, res) => {
  const { email, password } = emailPw.pick({ email: true, password: true }).parse(req.body);
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !user.passwordHash) throw new HttpError(401, 'invalid_credentials');
  if (user.isBanned) throw new HttpError(403, 'account_banned');
  if (!(await verifyPassword(password, user.passwordHash))) throw new HttpError(401, 'invalid_credentials');
  const access = await issueTokens(user, req, res);
  res.json({ user: publicUser(user), accessToken: access });
}));

// Request OTP (passwordless login)
authRouter.post('/otp/request', otpLimiter, asyncHandler(async (req, res) => {
  const { email } = z.object({ email: z.string().email() }).parse(req.body);
  const code = generateOtp();
  await prisma.otpCode.create({
    data: {
      email,
      codeHash: hashOtp(code),
      purpose: 'LOGIN',
      expiresAt: new Date(Date.now() + OTP_TTL_MS),
    },
  });
  await sendMail(email, 'Your StrangerChat code',
    `<p>Your login code is <b style="font-size:20px">${code}</b>. It expires in 10 minutes.</p>`);
  res.json({ ok: true });
}));

// Verify OTP -> login (auto-creates account if new)
authRouter.post('/otp/verify', authLimiter, asyncHandler(async (req, res) => {
  const { email, code } = z.object({ email: z.string().email(), code: z.string().length(6) }).parse(req.body);
  const otp = await prisma.otpCode.findFirst({
    where: { email, purpose: 'LOGIN', consumed: false, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: 'desc' },
  });
  if (!otp) throw new HttpError(400, 'otp_invalid_or_expired');
  if (otp.attempts >= OTP_MAX_ATTEMPTS) throw new HttpError(429, 'otp_too_many_attempts');
  if (otp.codeHash !== hashOtp(code)) {
    await prisma.otpCode.update({ where: { id: otp.id }, data: { attempts: { increment: 1 } } });
    throw new HttpError(400, 'otp_incorrect');
  }
  await prisma.otpCode.update({ where: { id: otp.id }, data: { consumed: true } });

  let user = await prisma.user.findUnique({ where: { email } });
  if (!user) user = await prisma.user.create({ data: { email, provider: 'EMAIL', isVerified: true } });
  if (user.isBanned) throw new HttpError(403, 'account_banned');
  const access = await issueTokens(user, req, res);
  res.json({ user: publicUser(user), accessToken: access });
}));

// Google sign-in (ID token from Google Identity Services)
authRouter.post('/google', authLimiter, asyncHandler(async (req, res) => {
  if (!google) throw new HttpError(503, 'google_not_configured');
  const { idToken } = z.object({ idToken: z.string() }).parse(req.body);
  const ticket = await google.verifyIdToken({ idToken, audience: env.GOOGLE_CLIENT_ID });
  const p = ticket.getPayload();
  if (!p?.sub || !p.email) throw new HttpError(401, 'google_invalid');

  let user = await prisma.user.findFirst({ where: { OR: [{ googleId: p.sub }, { email: p.email }] } });
  if (!user) {
    user = await prisma.user.create({
      data: {
        email: p.email, googleId: p.sub, provider: 'GOOGLE',
        displayName: p.name, avatarUrl: p.picture, isVerified: Boolean(p.email_verified),
      },
    });
  } else if (!user.googleId) {
    user = await prisma.user.update({ where: { id: user.id }, data: { googleId: p.sub, provider: 'GOOGLE' } });
  }
  if (user.isBanned) throw new HttpError(403, 'account_banned');
  const access = await issueTokens(user, req, res);
  res.json({ user: publicUser(user), accessToken: access });
}));

// Anonymous guest session (enables free anonymous chat without an account)
authRouter.post('/guest', asyncHandler(async (req, res) => {
  const user = await prisma.user.create({
    data: { provider: 'GUEST', isGuest: true, displayName: `Guest-${randomBytes(3).toString('hex')}` },
  });
  const access = await issueTokens(user, req, res);
  res.status(201).json({ user: publicUser(user), accessToken: access });
}));

// Refresh access token with rotation + reuse detection
authRouter.post('/refresh', asyncHandler(async (req, res) => {
  const presented = req.cookies?.[REFRESH_COOKIE];
  if (!presented) throw new HttpError(401, 'no_refresh_token');
  const tokenHash = hashToken(presented);
  const record = await prisma.refreshToken.findUnique({ where: { tokenHash }, include: { user: true } });

  if (!record) throw new HttpError(401, 'invalid_refresh_token');
  if (record.revoked || record.expiresAt < new Date()) {
    // token reuse / replay -> nuke the whole family
    await prisma.refreshToken.updateMany({ where: { family: record.family }, data: { revoked: true } });
    clearRefreshCookie(res);
    throw new HttpError(401, 'refresh_reuse_detected');
  }
  if (record.user.isBanned) throw new HttpError(403, 'account_banned');

  // rotate: revoke old, mint new within the same family
  await prisma.refreshToken.update({ where: { id: record.id }, data: { revoked: true } });
  const access = await issueTokens(record.user, req, res, record.family);
  res.json({ user: publicUser(record.user), accessToken: access });
}));

// Logout (revoke current refresh token)
authRouter.post('/logout', asyncHandler(async (req, res) => {
  const presented = req.cookies?.[REFRESH_COOKIE];
  if (presented) {
    await prisma.refreshToken.updateMany({ where: { tokenHash: hashToken(presented) }, data: { revoked: true } });
  }
  clearRefreshCookie(res);
  res.json({ ok: true });
}));

// Forgot password -> emailed reset link
authRouter.post('/forgot', otpLimiter, asyncHandler(async (req, res) => {
  const { email } = z.object({ email: z.string().email() }).parse(req.body);
  const user = await prisma.user.findUnique({ where: { email } });
  // always respond ok (don't leak which emails exist)
  if (user) {
    const token = randomBytes(32).toString('hex');
    await prisma.otpCode.create({
      data: { userId: user.id, email, codeHash: hashOtp(token), purpose: 'RESET',
        expiresAt: new Date(Date.now() + 30 * 60 * 1000) },
    });
    const link = `${env.CLIENT_URL}/reset?token=${token}&email=${encodeURIComponent(email)}`;
    await sendMail(email, 'Reset your StrangerChat password',
      `<p>Reset your password: <a href="${link}">${link}</a> (valid 30 min).</p>`);
  }
  res.json({ ok: true });
}));

// Reset password using token
authRouter.post('/reset', asyncHandler(async (req, res) => {
  const { email, token, password } = z.object({
    email: z.string().email(), token: z.string().min(32), password: z.string().min(8).max(128),
  }).parse(req.body);
  const rec = await prisma.otpCode.findFirst({
    where: { email, purpose: 'RESET', consumed: false, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: 'desc' },
  });
  if (!rec || rec.codeHash !== hashOtp(token)) throw new HttpError(400, 'reset_invalid');
  await prisma.$transaction([
    prisma.otpCode.update({ where: { id: rec.id }, data: { consumed: true } }),
    prisma.user.update({ where: { email }, data: { passwordHash: await hashPassword(password) } }),
    // revoke all sessions on password reset
    prisma.refreshToken.updateMany({ where: { userId: rec.userId ?? undefined }, data: { revoked: true } }),
  ]);
  res.json({ ok: true });
}));

// Current session bootstrap
authRouter.get('/me', requireAuth, asyncHandler(async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.user!.sub } });
  if (!user) throw new HttpError(404, 'not_found');
  res.json({ user: publicUser(user) });
}));
