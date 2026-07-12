import { Pipe, PipeTransform, inject } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';

// Renders Aura's reply as TERMINAL OUTPUT for the assistant page's console view.
// Keeps the raw line structure — the container is white-space: pre-wrap, so
// indentation and Aura's "▸"/"  →" markers land exactly as written, like real
// console output. It only transforms **bold** and highlights a leading
// "[ safety ]" tag. Input is HTML-escaped FIRST so model output can't inject
// markup; only the spans we generate here are ever produced. This is the XSS
// boundary for model output — pinned down by aura-terminal.pipe.spec.ts.
@Pipe({ name: 'auraTerminal', standalone: true })
export class AuraTerminalPipe implements PipeTransform {
  private readonly sanitizer = inject(DomSanitizer);

  transform(value: string | null | undefined): SafeHtml {
    const escaped = (value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    const html = escaped
      // A leading "[ safety ]" tag on a line → highlighted danger token.
      .replace(/^(\s*)\[ ?safety ?\]/gim, '$1<span class="term-safety">[ safety ]</span>')
      // The ▸ / → markers get a dimmed accent so structure reads at a glance.
      .replace(/(^|\n)(\s*)(▸)/g, '$1$2<span class="term-mark">$3</span>')
      .replace(/(\s)(→)(\s)/g, '$1<span class="term-mark">$2</span>$3')
      // **bold** → key terms (codes, part names).
      .replace(/\*\*([^*]+)\*\*/g, '<strong class="term-strong">$1</strong>');

    return this.sanitizer.bypassSecurityTrustHtml(html);
  }
}
