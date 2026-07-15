import { Router, Request, Response } from 'express';
import twilio from 'twilio';
import { requireAuth } from '../middleware/auth';
import { notificationsStore } from '../data/notifications.store';

// SMS is sent via Twilio (server-to-server, Account SID + Auth Token). Email is
// still a stub (SendGrid/Nodemailer — a separate setup).
//
// SECURITY: this endpoint now requires a valid session (requireAuth) — real
// sending makes an open endpoint a spam-relay / cost-abuse vector, so every send
// must be attributable to a signed-in user. It's further protected by strict
// input validation below + the expensiveLimiter rate limit applied in index.ts.
//
// DELIVERY LOG: each outbound send is recorded in notification_deliveries (0004)
// via notificationsStore.logDelivery(req.userId, …) for audit — status 'sent' on
// success, 'failed' if the provider call throws.

export const notifyRouter = Router();

// Lazily construct the Twilio client so a missing key doesn't crash boot; SMS
// sends fail with a clear 503 instead. Reused across requests once built.
const TWILIO_SID = process.env.TWILIO_ACCOUNT_SID;
const TWILIO_TOKEN = process.env.TWILIO_AUTH_TOKEN;
const TWILIO_FROM = process.env.TWILIO_FROM;
const twilioClient =
  TWILIO_SID && TWILIO_TOKEN ? twilio(TWILIO_SID, TWILIO_TOKEN) : null;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^\+?[0-9\s\-().]{7,20}$/;
const MAX_ITEMS = 100;

// Coerce a possibly-untrusted value to a safe display string, capped in length.
function str(v: unknown, max = 200): string {
  return typeof v === 'string' ? v.slice(0, max) : '';
}

notifyRouter.post('/', requireAuth, async (req: Request, res: Response) => {
  const userId = req.userId!; // guaranteed by requireAuth
  const { recipient, type, items } = req.body as {
    recipient?: unknown;
    type?: unknown;
    items?: unknown;
  };

  // Validate type, recipient, and items shape up front.
  if (type !== 'sms' && type !== 'email') {
    res.status(400).json({ success: false, message: 'type must be "sms" or "email".' });
    return;
  }
  if (typeof recipient !== 'string' ||
      (type === 'email' ? !EMAIL_RE.test(recipient) : !PHONE_RE.test(recipient))) {
    res.status(400).json({ success: false, message: `Invalid ${type} recipient.` });
    return;
  }
  if (!Array.isArray(items) || items.length === 0 || items.length > MAX_ITEMS) {
    res.status(400).json({ success: false, message: 'items must be a non-empty array (max 100).' });
    return;
  }

  // Post-validation: pin to concrete types so they narrow inside the log closure.
  const channel: 'sms' | 'email' = type;
  const to: string = recipient;

  // Build the message defensively — never trust field types from the client.
  const selected = (items as Array<Record<string, unknown>>).filter(i => i && i['selected']);
  const lines = selected.map(i => {
    const part = (i['part'] ?? {}) as Record<string, unknown>;
    const store = (part['store'] ?? {}) as Record<string, unknown>;
    const price = Number(part['price']);
    const priceStr = Number.isFinite(price) ? price.toFixed(2) : '0.00';
    return `• ${str(part['name'])} (${str(part['partNumber'], 60)}) — $${priceStr} @ ${str(store['name'])} — ${str(store['address'])}`;
  });
  const total = selected.reduce((s, i) => {
    const price = Number(((i['part'] ?? {}) as Record<string, unknown>)['price']);
    return s + (Number.isFinite(price) ? price : 0);
  }, 0);
  const body = `AuraLink Parts List\n${'─'.repeat(30)}\n${lines.join('\n')}\n${'─'.repeat(30)}\nEstimated Total: $${total.toFixed(2)}`;

  // Record the delivery attempt (best-effort audit) with the given status; never
  // let a logging failure break the send response.
  async function log(status: 'sent' | 'failed' | 'stub'): Promise<void> {
    try {
      await notificationsStore.logDelivery(userId, { channel, recipient: to, body, status });
    } catch (err) {
      console.error('logDelivery failed:', err);
    }
  }

  if (type === 'sms') {
    if (!twilioClient || !TWILIO_FROM) {
      res.status(503).json({ success: false, message: 'SMS is not configured on the server.' });
      return;
    }
    try {
      await twilioClient.messages.create({ body, from: TWILIO_FROM, to });
      await log('sent');
      res.json({ success: true, message: 'SMS sent.' });
    } catch (err) {
      console.error('Twilio send error:', err);
      await log('failed');
      res.status(502).json({ success: false, message: 'Failed to send SMS.' });
    }
    return;
  }

  if (type === 'email') {
    // TODO: Replace stub with Nodemailer / SendGrid
    // const transporter = nodemailer.createTransport({ ... });
    // await transporter.sendMail({ from: process.env.SMTP_FROM, to: recipient, subject: 'Your AuraLink Parts List', text: body });
    console.log(`[EMAIL STUB] To: ${recipient}\n${body}`);
    await log('stub');
    res.json({ success: true, message: 'Email sent (stub).' });
    return;
  }

  res.status(400).json({ success: false, message: 'Unknown notification type.' });
});
