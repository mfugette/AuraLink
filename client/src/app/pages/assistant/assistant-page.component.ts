import {
  AfterViewInit, Component, ElementRef, ViewChild, effect, inject, signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { AssistantService } from '../../services/assistant.service';
import { AccountService } from '../../services/account.service';
import { AuraMarkdownPipe } from '../../pipes/aura-markdown.pipe';

// Greeting pool for the empty-state hero. `{name}` is swapped for the user's
// first name when we have one, and dropped cleanly (with any leading comma/space)
// when we don't — so every line reads naturally signed-in or as a guest.
const GREETINGS: readonly string[] = [
  "Hey{name}, what's your car up to today?",
  "Good to see you{name}. What are we diagnosing?",
  "Hi{name} — pop the hood, I'm listening.",
  "What's rattling, {name}?",
  "Ready when you are{name}. What's going on with the car?",
  "Let's get you back on the road{name}.",
  "Hey{name}, throw a code or a symptom my way.",
  "What can I help you figure out{name}?",
  "Car acting up{name}? Let's sort it out.",
  "Welcome back{name}. Where should we start?",
  "Tell me what you're hearing{name}.",
  "I've got your back{name}. What's the trouble?",
];

// Full-page AI assistant. Before any conversation it shows a centered hero with
// suggestion chips; once messages exist the whole page becomes the chat, with a
// compact chip strip kept above the input for quick common questions. A query
// queued from the top-bar trigger is auto-sent on load. Backed by Gemini via
// AssistantService (see server/src/routes/assistant.route.ts).
@Component({
  selector: 'app-assistant-page',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule, AuraMarkdownPipe],
  templateUrl: './assistant-page.component.html',
  styleUrl: './assistant-page.component.scss',
})
export class AssistantPageComponent implements AfterViewInit {
  private readonly assistant = inject(AssistantService);
  private readonly accountService = inject(AccountService);

  @ViewChild('inputEl') inputRef?: ElementRef<HTMLInputElement>;
  @ViewChild('thread') threadRef?: ElementRef<HTMLElement>;

  readonly messages = this.assistant.messages;
  readonly thinking = this.assistant.thinking;
  readonly suggestions = this.assistant.suggestions;
  readonly maxInputChars = this.assistant.maxInputChars;

  // Pick one greeting per page mount (not per render) so it stays stable while
  // the hero is on screen, and picks a fresh one each time the user returns.
  readonly greeting = this.pickGreeting();

  input = signal('');

  constructor() {
    // Auto-scroll the thread to the newest message whenever it changes.
    effect(() => {
      this.messages();
      this.thinking();
      queueMicrotask(() => {
        const el = this.threadRef?.nativeElement;
        if (el) el.scrollTop = el.scrollHeight;
      });
    });
  }

  ngAfterViewInit(): void {
    const pending = this.assistant.takePending();
    if (pending) {
      this.assistant.send(pending);
    }
    setTimeout(() => this.inputRef?.nativeElement.focus(), 60);
  }

  useSuggestion(text: string): void {
    this.assistant.send(text);
    setTimeout(() => this.inputRef?.nativeElement.focus());
  }

  send(): void {
    const text = this.input().trim();
    if (!text || this.thinking()) return;
    this.assistant.send(text);
    this.input.set('');
    setTimeout(() => this.inputRef?.nativeElement.focus());
  }

  newChat(): void {
    this.assistant.reset();
    this.input.set('');
    setTimeout(() => this.inputRef?.nativeElement.focus());
  }

  // Choose a random greeting and personalize it with the user's first name.
  // Returns HTML: the name is wrapped in the same `.hero-accent` gradient span
  // the Home hero uses, so it's stylized identically. When there's no name
  // (guest / not loaded) we strip the `{name}` slot along with any leading comma
  // so lines like "Hey{name}," become "Hey". The name is HTML-escaped first —
  // `displayName` is user-controlled and this string is bound via [innerHTML].
  private pickGreeting(): string {
    const template = GREETINGS[Math.floor(Math.random() * GREETINGS.length)];
    const first = this.accountService.account()?.displayName?.trim().split(/\s+/)[0] ?? '';
    return first
      ? template.replace('{name}', ` <span class="hero-accent">${this.escapeHtml(first)}</span>`)
      : template.replace(/,?\s*\{name\}/, '');
  }

  private escapeHtml(s: string): string {
    return s
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }
}
