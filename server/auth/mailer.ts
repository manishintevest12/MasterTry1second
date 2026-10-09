/**
 * Transactional email via Resend (https://resend.com).
 * Config: RESEND_API_KEY (secret), MAIL_FROM (optional, default Resend onboarding sender).
 * Delivery is only claimed when Resend returns an email id; errors are reported honestly.
 */
import { settings } from '../common/settings';
import { log } from '../common/logger';

export interface MailResult {
  ok: boolean;
  id?: string;
  error?: string;
}

export async function sendEmail(to: string, subject: string, html: string, text?: string): Promise<MailResult> {
  if (!settings.resendApiKey) return { ok: false, error: 'Email delivery is not configured (RESEND_API_KEY missing)' };
  if (!settings.mailFrom) return { ok: false, error: 'Email sender not configured (MAIL_FROM missing)' };
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${settings.resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ from: settings.mailFrom, to: [to], subject, html, text: text || html.replace(/<[^>]+>/g, ' ') }),
    });
    const body: any = await res.json().catch(() => ({}));
    if (!res.ok) {
      const err = typeof body === 'object' && body?.message ? String(body.message) : `HTTP ${res.status}`;
      log.warn('Mailer', `Resend send failed for ${to}: ${err}`);
      return { ok: false, error: err };
    }
    log.info('Mailer', `Email sent to ${to} (id: ${body?.id || 'unknown'})`);
    return { ok: true, id: body?.id };
  } catch (e: any) {
    log.warn('Mailer', `Resend request failed: ${e?.message || e}`);
    return { ok: false, error: e?.message || 'network failure' };
  }
}
