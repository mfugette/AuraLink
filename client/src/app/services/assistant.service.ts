import { Injectable, inject, signal } from '@angular/core';
import { environment } from '../../environments/environment';
import { AuthService } from './auth.service';
import { AccountService } from './account.service';
import { TierService } from './tier.service';
import { SavedVehicle } from '../models/account.model';
import { ISSUE_HISTORY } from '../data/issue-history';

export interface ChatMessage {
  role: 'user' | 'assistant';
  text: string;
}

// Shared state for the AI assistant. The compact top-bar trigger writes the
// user's first query here and navigates to /assistant; the assistant page reads
// it, sends it, and owns the ongoing conversation. Aura is backed by Gemini
// (see server/src/routes/assistant.route.ts) and streams its reply in via a
// plain fetch() ReadableStream — Angular's HttpClient doesn't stream text well.
@Injectable({ providedIn: 'root' })
export class AssistantService {
  private readonly auth = inject(AuthService);
  private readonly account = inject(AccountService);
  private readonly tier = inject(TierService);

  readonly messages = signal<ChatMessage[]>([]);
  readonly thinking = signal(false);

  // Max characters per message — a UX/cost guard mirrored on the server (which
  // is the real enforcement; see server/src/routes/assistant.route.ts).
  readonly maxInputChars = 2000;

  // A query queued from the top bar, consumed once by the assistant page.
  private pendingQuery: string | null = null;

  readonly suggestions = [
    'My car is making a strange noise',
    'My check engine light is on',
    'What does code P0420 mean?',
    'How often should I change my oil?',
    'My car won’t start',
  ];

  /** Queue a query to be sent as soon as the assistant page loads. */
  queue(query: string): void {
    this.pendingQuery = query.trim() || null;
  }

  /** Consume a queued query (returns it once, then clears it). */
  takePending(): string | null {
    const q = this.pendingQuery;
    this.pendingQuery = null;
    return q;
  }

  reset(): void {
    this.messages.set([]);
    this.thinking.set(false);
  }

  // Build a compact summary of the user's primary vehicle + its issue history to
  // send as context, so Aura can reason about *their* car. Returns '' when there
  // are no saved vehicles (Aura then answers generically). Vehicle + issue data
  // are client-side for now; the server folds this into the system prompt.
  private buildContext(): string {
    const vehicles = this.account.vehicles();
    if (vehicles.length === 0) return '';

    const primary = vehicles.find(v => v.isPrimary) ?? vehicles[0];
    const lines: string[] = [];
    lines.push(`Primary vehicle: ${this.describeVehicle(primary)}.`);

    if (vehicles.length > 1) {
      const others = vehicles.filter(v => v.id !== primary.id).map(v => this.describeVehicle(v));
      lines.push(`Other saved vehicles: ${others.join('; ')}.`);
    }

    const issues = ISSUE_HISTORY
      .filter(i => i.vehicleId === primary.id)
      .sort((a, b) => b.date.localeCompare(a.date));
    if (issues.length > 0) {
      lines.push('');
      lines.push('Issue history for the primary vehicle (most recent first):');
      for (const i of issues) {
        lines.push(`- ${i.date} — ${i.code} ${i.title} [${i.status}, ${i.severity}]: ${i.notes}`);
      }
    } else {
      lines.push('No logged issue history for the primary vehicle yet.');
    }

    return lines.join('\n');
  }

  private describeVehicle(v: SavedVehicle): string {
    const core = [v.year, v.make, v.model, v.subModel].filter(Boolean).join(' ') || 'Unknown vehicle';
    const extras = [
      v.nickname ? `"${v.nickname}"` : null,
      v.engine,
      v.transmission,
      v.mileage != null ? `${v.mileage.toLocaleString()} mi` : null,
    ].filter(Boolean);
    return extras.length ? `${core} (${extras.join(', ')})` : core;
  }

  async send(text: string): Promise<void> {
    const clean = text.trim().slice(0, this.maxInputChars);
    if (!clean || this.thinking()) return;

    // Enforce the tier's daily Aura quota (client-side soft cap for now; a real
    // limit belongs server-side once billing exists).
    if (this.tier.aiMessagesRemaining() <= 0) {
      this.messages.update(m => [
        ...m,
        { role: 'user', text: clean },
        {
          role: 'assistant',
          text: `You've reached your daily Aura message limit on the ${this.tier.def().name} plan. Upgrade for more — visit **Plans** in the header to see your options.`,
        },
      ]);
      return;
    }

    const history = [...this.messages(), { role: 'user' as const, text: clean }];
    this.messages.set(history);
    this.thinking.set(true);
    this.tier.recordAiMessage();

    try {
      const res = await fetch(`${environment.apiUrl}/api/assistant/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(this.auth.accessToken ? { Authorization: `Bearer ${this.auth.accessToken}` } : {}),
        },
        body: JSON.stringify({ messages: history, context: this.buildContext() }),
      });

      if (!res.ok) {
        // Server sends a JSON { error } for pre-stream failures (e.g. a 429
        // rate limit). Surface that message rather than a generic one.
        const detail = await res.json().catch(() => null) as { error?: string } | null;
        this.messages.update(m => [...m, {
          role: 'assistant',
          text: detail?.error ?? 'Sorry, Aura ran into a problem answering that. Please try again.',
        }]);
        return;
      }
      if (!res.body) {
        throw new Error('Aura returned an empty response.');
      }

      // Append a placeholder assistant message and grow it as chunks arrive.
      let reply = '';
      this.messages.update(m => [...m, { role: 'assistant', text: '' }]);

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        reply += decoder.decode(value, { stream: true });
        this.messages.update(m => {
          const copy = m.slice();
          copy[copy.length - 1] = { role: 'assistant', text: reply };
          return copy;
        });
      }
    } catch (err) {
      console.error('Aura chat error:', err);
      this.messages.update(m => [...m, { role: 'assistant', text: 'Sorry, Aura ran into a problem answering that. Please try again.' }]);
    } finally {
      this.thinking.set(false);
    }
  }
}
