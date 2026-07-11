import {
  AfterViewInit, Component, ElementRef, ViewChild, computed, effect, inject, signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { AssistantService } from '../../services/assistant.service';
import { AccountService } from '../../services/account.service';
import { AuraTerminalPipe } from '../../pipes/aura-terminal.pipe';

// Small ASCII wordmark printed as the boot banner of the terminal.
const BANNER = String.raw`
  ▄▀█ █░█ █▀█ ▄▀█   ▶ diagnostic shell
  █▀█ █▄█ █▀▄ █▀█   v1.0`;

// Full-page AI assistant, styled as a TERMINAL. The user "types commands" at a
// shell prompt (auralink.vin/account/<name>>) and Aura's reply is printed as
// console output directly beneath — a classic single-stream shell session that
// grows top-down. Backed by Gemini via AssistantService (which now instructs
// Aura to format replies as terminal output; see server assistant.route.ts).
@Component({
  selector: 'app-assistant-page',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule, AuraTerminalPipe],
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

  readonly banner = BANNER;

  input = signal('');

  // The signed-in user's first name (or 'guest'), used in the shell prompt.
  readonly userName = computed(() => {
    const name = this.accountService.account()?.displayName?.trim().split(/\s+/)[0];
    return name || 'guest';
  });

  // The shell prompt path — e.g. "auralink.vin/account/Max".
  // readonly promptPath = computed(() => `auralink.vin/account/${this.userName()}`);
  readonly promptPath = computed(() => `${this.userName().toLowerCase()}@auralink.vin:~/aura`);

  constructor() {
    // Auto-scroll the console to the newest line whenever it changes.
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
    setTimeout(() => this.focusInput(), 60);
  }

  focusInput(): void {
    this.inputRef?.nativeElement.focus();
  }

  useSuggestion(text: string): void {
    this.assistant.send(text);
    setTimeout(() => this.focusInput());
  }

  send(): void {
    const text = this.input().trim();
    if (!text || this.thinking()) return;
    this.assistant.send(text);
    this.input.set('');
    setTimeout(() => this.focusInput());
  }

  newChat(): void {
    this.assistant.reset();
    this.input.set('');
    setTimeout(() => this.focusInput());
  }
}
