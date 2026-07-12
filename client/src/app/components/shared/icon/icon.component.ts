import { Component, Input, computed, signal } from '@angular/core';

import { resolveIcon } from './icon-registry';

// AuraLink pixel-art icon — a drop-in for <mat-icon>. Give it a name (the same
// Material name the app already used, e.g. "directions_car") and it renders the
// matching pixelarticons glyph as an inline SVG that inherits currentColor.
//
// Sizing mirrors <mat-icon>: the SVG is 1em × 1em, so it scales with the host's
// font-size. That means every existing SCSS rule that sized icons via
// `mat-icon { font-size: Npx }` (or width/height) keeps working after the swap —
// the host below defaults to 20px and honors an inherited font-size otherwise.
// Pass [size]="N" to force a pixel size regardless of CSS.
//
//   <app-icon name="history" />
//   <app-icon name="warning" [size]="16" />
@Component({
  selector: 'app-icon',
  standalone: true,
  template: `
    @if (path()) {
      <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false">
        <path [attr.d]="path()" />
      </svg>
    }
  `,
  styles: [`
    :host {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      /* Default matches the app's common 20px nav icon; any inherited/explicit
         font-size on the host (from existing SCSS) overrides this. */
      font-size: 20px;
      line-height: 0;
      color: inherit;
      vertical-align: middle;
      width: 1em;
      height: 1em;
      flex-shrink: 0;
    }
    :host[data-sized] { width: auto; height: auto; }
    svg { width: 1em; height: 1em; display: block; shape-rendering: crispEdges; }
  `],
  host: {
    '[style.font-size.px]': 'size ?? null',
    '[attr.data-sized]': 'size != null ? "" : null',
  },
})
export class IconComponent {
  private readonly _name = signal<string>('');

  @Input({ required: true }) set name(value: string) {
    this._name.set(value ?? '');
  }

  // Explicit pixel size. When unset, the icon sizes to the host's font-size
  // (default 20px, or whatever CSS sets) — the mat-icon-compatible behavior.
  @Input() size: number | null = null;

  readonly path = computed(() => {
    const p = resolveIcon(this._name());
    if (!p && this._name()) {
      console.warn(`[app-icon] no glyph registered for "${this._name()}"`);
    }
    return p;
  });
}
