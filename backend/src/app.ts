import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { env } from './config/env';
import { globalLimiter } from './middleware/rateLimit';
import { errorHandler, notFound } from './middleware/error';
import { authRouter } from './modules/auth';
import { userRouter } from './modules/users';
import { paymentRouter, webhookRouter } from './modules/payments';
import { adminRouter } from './modules/admin';

export function createApp() {
  const app = express();
  app.set('trust proxy', 1); // behind Nginx

  app.use(helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    contentSecurityPolicy: env.NODE_ENV === 'production' ? undefined : false,
  }));
  // CORS — allow the configured client URL(s), ANY *.netlify.app site, and localhost.
  // This way the app keeps working even if CLIENT_URL isn't set perfectly on the server.
  const allowList = env.CLIENT_URL.split(',').map((s) => s.trim()).filter(Boolean);
  app.use(
    cors({
      origin(origin, cb) {
        if (!origin) return cb(null, true); // mobile apps / curl / same-origin
        if (allowList.includes(origin)) return cb(null, true);
        try {
          const host = new URL(origin).hostname;
          if (host.endsWith('.netlify.app') || host === 'localhost' || host === '127.0.0.1') {
            return cb(null, true);
          }
        } catch {
          /* malformed origin -> deny below */
        }
        return cb(null, false);
      },
      credentials: true,
    }),
  );
  app.use(cookieParser());

  // Razorpay webhook needs the raw body for signature verification.
  app.use('/api/payments/webhook', express.raw({ type: '*/*' }), webhookRouter);

  // capture raw body on the JSON parser too (useful for any other HMAC needs)
  app.use(express.json({
    limit: '1mb',
    verify: (req, _res, buf) => { (req as any).rawBody = buf; },
  }));
  app.use(express.urlencoded({ extended: true }));

  app.use(globalLimiter);

  app.get('/api/health', (_req, res) => res.json({ ok: true, t: Date.now() }));

  app.use('/api/auth', authRouter);
  app.use('/api/users', userRouter);
  app.use('/api/payments', paymentRouter);
  app.use('/api/admin', adminRouter);

  app.use(notFound);
  app.use(errorHandler);
  return app;
}
