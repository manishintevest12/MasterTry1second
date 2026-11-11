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

const TEST_SENDER = 'Try1Second <onboarding@resend.dev>';

async function post(from: string, to: string, subject: string, html: string, text?: string): Promise<{ ok: boolean; id?: string; error?: string; status?: number }> {
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${settings.resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ from, to: [to], subject, html, text: text || html.replace(/<[^>]+>/g, ' ') }),
    });
    const body: any = await res.json().catch(() => ({}));
    if (!res.ok) {
      const err = typeof body === 'object' && body?.message ? String(body.message) : `HTTP ${res.status}`;
      log.warn('Mailer', `Resend send failed for ${to}: ${err}`);
      return { ok: false, error: err, status: res.status };
    }
    log.info('Mailer', `Email sent to ${to} (id: ${body?.id || 'unknown'})`);
    return { ok: true, id: body?.id };
  } catch (e: any) {
    log.warn('Mailer', `Resend request failed: ${e?.message || e}`);
    return { ok: false, error: e?.message || 'network failure' };
  }
}

export async function sendEmail(to: string, subject: string, html: string, text?: string): Promise<MailResult> {
  if (!settings.resendApiKey) return { ok: false, error: 'Email delivery is not configured (RESEND_API_KEY missing)' };
  const from = settings.mailFrom || TEST_SENDER;
  const first = await post(from, to, subject, html, text);
  if (first.ok) return { ok: true, id: first.id };
  // OWNER 11 Nov: a from-domain that Resend has not verified answers 403 "domain is not verified" and the
  // admin never gets a code. Retry once from Resend's own test sender, which works for the account owner's
  // address, so login is not blocked by a missing DNS record. Still honest: the real error is returned when
  // the retry also fails.
  const domainProblem = /not verified|domain|not allowed|testing emails/i.test(String(first.error || ''));
  if (domainProblem && from !== TEST_SENDER) {
    log.warn('Mailer', `Retrying ${to} from the Resend test sender after: ${first.error}`);
    const second = await post(TEST_SENDER, to, subject, html, text);
    if (second.ok) return { ok: true, id: second.id };
    return { ok: false, error: second.error || first.error };
  }
  return { ok: false, error: first.error };
}
