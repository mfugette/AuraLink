import { Router, Request, Response } from 'express';
import { GoogleGenAI } from '@google/genai';
import { requireAuth } from '../middleware/auth';

// Aura, the AuraLink AI assistant. Signed-in only (mirrors the client route
// guard — see client/src/app/app.routes.ts). Stateless: the client resends
// the full message history each turn; we don't persist conversations here.

const SYSTEM_PROMPT = `You are Aura, the friendly AI assistant built into AuraLink — a vehicle diagnostics and management app.

Voice: warm, conversational, and to the point — like a knowledgeable friend who happens to be a mechanic. Talk like a person, not a manual.

Rules:
- Keep it SHORT. A couple of sentences or a few quick bullets. Lead with the most useful thing; don't pad.
- Only go into detail if the user actually asks for it. Offer to say more rather than dumping everything up front.
- Flag anything safety-critical (brakes, steering, airbags, active misfire, overheating) clearly and early.
- If the user gives a fault code, say what it means in one line before anything else.
- When you have the user's vehicle and history, use it — reference their specific car and past issues instead of speaking generically.
- Use light Markdown: **bold** for key terms, and simple bullet lists when listing things. Don't over-format.`;

const MODEL = 'gemini-3.1-flash-lite';

// Cost guardrails. Aura is a concise chat assistant, so we bound both ends:
//   • MAX_OUTPUT_TOKENS caps each reply (the biggest cost lever).
//   • MAX_HISTORY caps how many turns we resend — history grows cost every turn.
//   • MAX_INPUT_CHARS rejects pasted walls of text (mirrored on the client).
//   • MAX_CONTEXT_CHARS bounds the vehicle/history context the client sends.
const MAX_OUTPUT_TOKENS = 400;
const MAX_HISTORY = 12;
const MAX_INPUT_CHARS = 2000;
const MAX_CONTEXT_CHARS = 4000;

let client: GoogleGenAI | null = null;
function getClient(): GoogleGenAI {
  if (!client) {
    const apiKey = process.env['GEMINI_API_KEY'];
    if (!apiKey) throw new Error('GEMINI_API_KEY must be set in .env');
    client = new GoogleGenAI({ apiKey });
  }
  return client;
}

interface ChatMessage {
  role: 'user' | 'assistant';
  text: string;
}

// The Gemini SDK throws errors carrying an HTTP status (as `.status`, and often
// embedded in the message). Pull it out so we can give a useful reply — a 429
// (rate limit / depleted quota) is the one users on the free tier will hit.
function statusFromError(err: unknown): number | null {
  if (err && typeof err === 'object' && 'status' in err) {
    const s = (err as { status?: unknown }).status;
    if (typeof s === 'number') return s;
  }
  const msg = err instanceof Error ? err.message : String(err);
  const m = msg.match(/"code":\s*(\d{3})/) ?? msg.match(/\b(\d{3})\b/);
  return m ? Number(m[1]) : null;
}

function messageForStatus(status: number | null): string {
  if (status === 429) return 'Aura is getting a lot of requests right now. Please wait a moment and try again.';
  return 'Aura is unavailable right now.';
}

export const assistantRouter = Router();

assistantRouter.use(requireAuth);

// POST /api/assistant/chat  { messages: ChatMessage[] }
// Streams the assistant's reply as plain-text chunks (SSE-ish: just raw text
// over a chunked response — the client reads it as a stream).
assistantRouter.post('/chat', async (req: Request, res: Response) => {
  const { messages, context } = req.body as { messages?: ChatMessage[]; context?: string };

  if (!Array.isArray(messages) || messages.length === 0) {
    res.status(400).json({ error: 'messages must be a non-empty array.' });
    return;
  }

  // Optional per-request context: the client sends a compact summary of the
  // user's primary vehicle + its issue history (built from client-side data —
  // the server stays stateless). Bounded so it can't blow up token cost.
  const vehicleContext =
    typeof context === 'string' && context.trim()
      ? context.trim().slice(0, MAX_CONTEXT_CHARS)
      : '';
  const systemInstruction = vehicleContext
    ? `${SYSTEM_PROMPT}\n\n--- The user's vehicle context ---\n${vehicleContext}`
    : SYSTEM_PROMPT;

  // Reject over-long input (mirrors the client cap, but the server is the real
  // enforcement — the client limit is just UX). Guards against pasted walls of
  // text inflating token cost.
  const latest = messages[messages.length - 1];
  if (latest && latest.text.length > MAX_INPUT_CHARS) {
    res.status(413).json({ error: `Message is too long (max ${MAX_INPUT_CHARS} characters).` });
    return;
  }

  // Only resend the most recent turns — full-history resends grow cost every
  // turn. The system prompt (sent separately) keeps Aura's behavior consistent.
  const trimmed = messages.slice(-MAX_HISTORY);

  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('X-Accel-Buffering', 'no');

  try {
    const stream = await getClient().models.generateContentStream({
      model: MODEL,
      config: {
        systemInstruction,
        maxOutputTokens: MAX_OUTPUT_TOKENS,
      },
      contents: trimmed.map(m => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.text }],
      })),
    });

    for await (const chunk of stream) {
      if (chunk.text) res.write(chunk.text);
    }
    res.end();
  } catch (err) {
    console.error('Assistant chat error:', err);
    const status = statusFromError(err);
    const friendly = messageForStatus(status);
    if (!res.headersSent) {
      // Nothing streamed yet — send a normal JSON error the client surfaces.
      res.status(status === 429 ? 429 : 500).json({ error: friendly });
    } else {
      // Mid-stream failure: the client is reading plain text, so append the
      // message inline (on its own line) rather than a JSON body it can't parse.
      res.write(`\n\n${friendly}`);
      res.end();
    }
  }
});
