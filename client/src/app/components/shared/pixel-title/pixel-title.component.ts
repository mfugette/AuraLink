import { Component, Input, computed, signal } from '@angular/core';
import { blockFiglet } from '../../vehicle-terminal/block-figlet';

// The app-wide page-title wordmark: renders a short label as a pixel-block figlet
// (via blockFiglet — the same 5-row glyph set used by the vehicle terminal banner),
// with an optional ▶ tagline and a muted sub line beside it. This is the single
// source of truth for the blocky page header seen on the Vehicle Summary page;
// data pages use it in place of a plain text .page-title so every header reads as
// the same unicode-block wordmark.
@Component({
  selector: 'app-pixel-title',
  standalone: true,
  templateUrl: './pixel-title.component.html',
  styleUrl: './pixel-title.component.scss',
})
export class PixelTitleComponent {
  // The label rendered as block letters. Falls back to `fallback` when empty so
  // the wordmark never collapses (matching blockFiglet's own empty-string guard).
  @Input() set text(value: string) {
    this._text.set(value ?? '');
  }
  @Input() fallback = 'AURALINK';
  // Optional lines beside the wordmark: a ▶ tagline (e.g. "2026 SUBARU WRX") and a
  // muted sub line (e.g. "vin: —"). Omit either to hide it.
  @Input() tagline: string | null = null;
  @Input() sub: string | null = null;

  private readonly _text = signal('');

  readonly banner = computed(() => blockFiglet(this._text() || this.fallback));
}
