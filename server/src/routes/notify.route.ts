import { Router, Request, Response } from 'express';

// TODO: Wire up Twilio for SMS and Nodemailer/SendGrid for email.
// Credentials should go in .env — see .env.example at the project root.

export const notifyRouter = Router();

notifyRouter.post('/', async (req: Request, res: Response) => {
  const { recipient, type, items } = req.body as {
    recipient: string;
    type: 'sms' | 'email';
    items: Array<{ part: { name: string; partNumber: string; price: number; store: { name: string; address: string } }; selected: boolean }>;
  };

  if (!recipient || !type || !items) {
    res.status(400).json({ success: false, message: 'Missing required fields.' });
    return;
  }

  const selected = items.filter(i => i.selected);
  const lines = selected.map(
    i => `• ${i.part.name} (${i.part.partNumber}) — $${i.part.price.toFixed(2)} @ ${i.part.store.name} — ${i.part.store.address}`
  );
  const total = selected.reduce((s, i) => s + i.part.price, 0);
  const body = `OpenOBD Parts List\n${'─'.repeat(30)}\n${lines.join('\n')}\n${'─'.repeat(30)}\nEstimated Total: $${total.toFixed(2)}`;

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
    // await transporter.sendMail({ from: process.env.SMTP_FROM, to: recipient, subject: 'Your OpenOBD Parts List', text: body });
    console.log(`[EMAIL STUB] To: ${recipient}\n${body}`);
    res.json({ success: true, message: 'Email sent (stub).' });
    return;
  }

  res.status(400).json({ success: false, message: 'Unknown notification type.' });
});
