import { Injectable, signal } from '@angular/core';

export type ToastKind = 'success' | 'error' | 'info';

export interface Toast {
  id: number;
  kind: ToastKind;
  text: string;
}

// Lightweight, app-wide toast notifications. Signal-backed so the host component
// renders reactively. Toasts auto-dismiss after a timeout (errors linger a bit
// longer) and can be dismissed manually. This is the single user-visible surface
// for transient feedback and for the global HTTP error interceptor.
@Injectable({ providedIn: 'root' })
export class ToastService {
  readonly toasts = signal<Toast[]>([]);
  private nextId = 1;

  // Tracks the network state for a persistent offline banner. Initialized from
  // navigator.onLine and kept in sync by listeners wired in the host component.
  readonly offline = signal(typeof navigator !== 'undefined' ? !navigator.onLine : false);

  show(text: string, kind: ToastKind = 'info', durationMs = 4500): number {
    const id = this.nextId++;
    this.toasts.update(list => [...list, { id, kind, text }]);
    if (durationMs > 0) {
      setTimeout(() => this.dismiss(id), durationMs);
    }
    return id;
  }

  success(text: string, durationMs = 3500): number { return this.show(text, 'success', durationMs); }
  error(text: string, durationMs = 6000): number { return this.show(text, 'error', durationMs); }
  info(text: string, durationMs = 4500): number { return this.show(text, 'info', durationMs); }

  dismiss(id: number): void {
    this.toasts.update(list => list.filter(t => t.id !== id));
  }

  clear(): void {
    this.toasts.set([]);
  }
}
