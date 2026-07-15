import {
  Component, ElementRef, ViewChild, inject, signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AssistantService } from '../../services/assistant.service';
import { MatIconModule } from '@angular/material/icon';

// Compact top-bar entry point for the AI assistant. Clicking it opens a centered,
// AI-focused overlay (hero + suggestion chips). Submitting a query closes the
// overlay and navigates to the dedicated /assistant page, where the whole page
// becomes the conversation. The query is queued and auto-sent on that page.
@Component({
  selector: 'app-ai-search',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule],
  templateUrl: './ai-search.component.html',
  styleUrl: './ai-search.component.scss',
})
export class AiSearchComponent {
  private readonly router = inject(Router);
  private readonly assistant = inject(AssistantService);

  @ViewChild('overlayInput') overlayInputRef?: ElementRef<HTMLInputElement>;

  active = signal(false);
  input = '';

  readonly suggestions = this.assistant.suggestions;

  // Below this width the trigger is icon-only (see .ai-trigger-text's
  // breakpoint) and skips the overlay entirely — on a small screen the full
  // hero overlay is cramped, so tapping the icon just goes straight to the
  // dedicated /assistant page instead.
  private readonly mobileBreakpoint = 520;

  activate(): void {
    if (window.innerWidth <= this.mobileBreakpoint) {
      this.router.navigate(['/assistant']);
      return;
    }
    if (this.active()) return;
    this.active.set(true);
    document.documentElement.style.overflow = 'hidden';
    setTimeout(() => this.overlayInputRef?.nativeElement.focus(), 120);
  }

  close(): void {
    this.active.set(false);
    document.documentElement.style.overflow = '';
  }

  useSuggestion(text: string): void {
    this.submit(text);
  }

  send(): void {
    this.submit(this.input);
  }

  // Queue the query, close the overlay, and hand off to the full /assistant page.
  private submit(text: string): void {
    const query = text.trim();
    if (!query) return;
    this.assistant.queue(query);
    this.input = '';
    this.close();
    this.router.navigate(['/assistant']);
  }
}
