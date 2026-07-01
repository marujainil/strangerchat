import nodemailer from 'nodemailer';
import { env } from '../config/env';
import { logger } from './logger';

const transporter =
  env.SMTP_HOST && env.SMTP_USER
    ? nodemailer.createTransport({
        host: env.SMTP_HOST,
        port: env.SMTP_PORT ?? 587,
        secure: (env.SMTP_PORT ?? 587) === 465,
        auth: { user: env.SMTP_USER, pass: env.SMTP_PASS },
      })
    : null;

/**
 * Sends mail when SMTP is configured; otherwise logs the message
 * (so OTP/reset flows are usable in local dev without an SMTP server).
 */
export async function sendMail(to: string, subject: string, html: string) {
  if (!transporter) {
    logger.info('[mailer:dev] email suppressed (no SMTP configured)', { to, subject, html });
    return;
  }
  await transporter.sendMail({ from: env.MAIL_FROM, to, subject, html });
}
