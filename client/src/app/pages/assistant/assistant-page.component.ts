import {
  AfterViewInit, Component, ElementRef, ViewChild, effect, inject, signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { AssistantService } from '../../services/assistant.service';
import { AuraMarkdownPipe } from '../../pipes/aura-markdown.pipe';

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

  @ViewChild('inputEl') inputRef?: ElementRef<HTMLInputElement>;
  @ViewChild('thread') threadRef?: ElementRef<HTMLElement>;

  readonly messages = this.assistant.messages;
  readonly thinking = this.assistant.thinking;
  readonly suggestions = this.assistant.suggestions;
  readonly maxInputChars = this.assistant.maxInputChars;

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
}
