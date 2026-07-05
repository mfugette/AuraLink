import { Router, Request, Response } from 'express';

// TODO: Wire up Twilio for SMS and Nodemailer/SendGrid for email.
// Credentials should go in .env — see .env.example at the project root.
//
// SECURITY: this endpoint is intentionally left open (no requireAuth) because
// the parts-list feature is part of the free/guest Home pipeline. It's a stub
// today. **Before wiring real SMS/email (Twilio/SendGrid), add requireAuth or a
// strict per-recipient/day cap** — an open send endpoint is a spam-relay and
// cost-abuse vector. For now it's protected by strict input validation below +
// the expensiveLimiter rate limit applied in index.ts.

export const notifyRouter = Router();

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^\+?[0-9\s\-().]{7,20}$/;
const MAX_ITEMS = 100;

// Coerce a possibly-untrusted value to a safe display string, capped in length.
function str(v: unknown, max = 200): string {
  return typeof v === 'string' ? v.slice(0, max) : '';
}

notifyRouter.post('/', async (req: Request, res: Response) => {
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

  if (type === 'sms') {
    // TODO: Replace stub with Twilio
    // const twilio = require('twilio')(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
    // await twilio.messages.create({ body, from: process.env.TWILIO_FROM, to: recipient });
    console.log(`[SMS STUB] To: ${recipient}\n${body}`);
    res.json({ success: true, message: 'SMS sent (stub).' });
    return;
  }

  if (type === 'email') {
    // TODO: Replace stub with Nodemailer / SendGrid
    // const transporter = nodemailer.createTransport({ ... });
    // await transporter.sendMail({ from: process.env.SMTP_FROM, to: recipient, subject: 'Your AuraLink Parts List', text: body });
    console.log(`[EMAIL STUB] To: ${recipient}\n${body}`);
    res.json({ success: true, message: 'Email sent (stub).' });
    return;
  }

  res.status(400).json({ success: false, message: 'Unknown notification type.' });
});
