import { Injectable, computed, effect, inject, signal } from '@angular/core';
import { AccountService } from './account.service';

export type Theme = 'dark' | 'light';

const STORAGE_KEY = 'obd-theme';

// Owns the active UI theme. Applies it to <html data-theme> so the whole app
// (all --obd-* variables) flips instantly. Precedence:
//   1. The signed-in user's saved account setting (authoritative when present).
//   2. localStorage (persists a guest's choice / avoids a flash before load).
//   3. OS preference (prefers-color-scheme), else dark.
// Changing the theme while signed in persists to the account; while signed out
// it persists to localStorage only.
@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly accountService = inject(AccountService);

  readonly theme = signal<Theme>(this.initialTheme());
  readonly isLight = computed(() => this.theme() === 'light');

  constructor() {
    // Keep the DOM attribute in sync with the theme signal for any change that
    // doesn't go through set() (e.g. the account-settings sync below). set()
    // itself writes the DOM synchronously so a user toggle paints immediately;
    // this effect is the backstop for signal-driven changes.
    effect(() => this.applyToDom(this.theme()));

    // When the account's settings load/refresh, adopt the saved theme. This is
    // the authoritative source once signed in (e.g. after logging in on a new
    // device where localStorage doesn't have their preference).
    effect(() => {
      const settings = this.accountService.settings();
      if (settings && settings.theme !== this.theme()) {
        this.theme.set(settings.theme);
        this.writeLocal(settings.theme);
      }
    });
  }

  toggle(): void {
    this.set(this.theme() === 'dark' ? 'light' : 'dark');
  }

  set(theme: Theme): void {
    if (theme === this.theme()) return;

    // Apply to the DOM SYNCHRONOUSLY, first, before touching any signal. Angular
    // effects are async-scheduled — they flush after the current change-detection
    // pass, which is heavier when signed in (sidebar, account menu, AI search all
    // subscribe to signals), so relying on the effect delays the repaint enough
    // to read as lag. Writing data-theme directly here makes the flip instant and
    // independent of auth state or CD load. The effect above stays as a backstop
    // for programmatic theme changes (the settings sync).
    this.applyToDom(theme);
    this.theme.set(theme);
    this.writeLocal(theme);

    // Persist to the account when signed in — fire-and-forget in a fresh
    // macrotask so the request setup never shares a frame with the paint above.
    if (this.accountService.settings()) {
      setTimeout(() => this.accountService.updateSettings({ theme }).subscribe(), 0);
    }
  }

  // Called once at bootstrap (before Angular paints) to avoid a theme flash.
  private initialTheme(): Theme {
    const stored = this.readLocal();
    if (stored) return stored;
    const prefersLight = window.matchMedia?.('(prefers-color-scheme: light)').matches;
    return prefersLight ? 'light' : 'dark';
  }

  private applyToDom(theme: Theme): void {
    document.documentElement.setAttribute('data-theme', theme);
  }

  private readLocal(): Theme | null {
    const v = localStorage.getItem(STORAGE_KEY);
    return v === 'dark' || v === 'light' ? v : null;
  }

  private writeLocal(theme: Theme): void {
    localStorage.setItem(STORAGE_KEY, theme);
  }
}
