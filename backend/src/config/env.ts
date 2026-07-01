import { config as loadEnv } from 'dotenv';
import { z } from 'zod';

loadEnv();

const schema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(4000),

  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().default('redis://localhost:6379'),

  CLIENT_URL: z.string().default('http://localhost:3000'),
  COOKIE_DOMAIN: z.string().optional(),

  JWT_ACCESS_SECRET: z.string().min(16, 'JWT_ACCESS_SECRET must be >=16 chars'),
  JWT_REFRESH_SECRET: z.string().min(16, 'JWT_REFRESH_SECRET must be >=16 chars'),
  ACCESS_TTL: z.string().default('15m'),
  REFRESH_TTL_DAYS: z.coerce.number().default(30),

  GOOGLE_CLIENT_ID: z.string().optional(),

  RAZORPAY_KEY_ID: z.string().optional(),
  RAZORPAY_KEY_SECRET: z.string().optional(),
  RAZORPAY_WEBHOOK_SECRET: z.string().optional(),

  UPI_ID: z.string().default('jainilmaru10thb@oksbi'),
  UPI_NAME: z.string().default('StrangerChat'),

  // When ON, a direct UPI-QR payment grants premium automatically a few seconds
  // after the QR is shown (a personal-VPA UPI QR sends no bank callback, so this
  // is the only way to auto-activate without a gateway). Set to "false" for real
  // money and confirm payments manually (admin) or use Razorpay instead.
  UPI_AUTO_APPROVE: z
    .string()
    .default('true')
    .transform((v) => v.toLowerCase() === 'true' || v === '1'),
  UPI_AUTO_APPROVE_DELAY_SEC: z.coerce.number().default(5),

  STUN_URLS: z.string().default('stun:stun.l.google.com:19302'),
  TURN_URL: z.string().optional(),
  TURN_USERNAME: z.string().optional(),
  TURN_CREDENTIAL: z.string().optional(),

  // free-tier filter allowance (seconds per day)
  FREE_FILTER_SECONDS: z.coerce.number().default(180),

  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().optional(),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  MAIL_FROM: z.string().default('StrangerChat <no-reply@strangerchat.app>'),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  // eslint-disable-next-line no-console
  console.error('❌ Invalid environment variables:', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
export const isProd = env.NODE_ENV === 'production';
