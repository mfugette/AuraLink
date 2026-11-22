import { Pipe, PipeTransform, inject } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';

// Renders Aura's reply as TERMINAL OUTPUT for the assistant page's console view.
// Keeps the raw line structure — the container is white-space: pre-wrap, so
// indentation and Aura's "▸"/"  →" markers land exactly as written, like real
// console output. It transforms **bold**, highlights a leading "[ safety ]" tag,
// and color-codes whole lines by SEVERITY: a "[ safety ]" line (or one with
// danger words like "stop"/"immediately") renders red, a "caution"/"warning"
// line renders yellow; everything else stays the default blue. Input is
// HTML-escaped FIRST so model output can't inject markup; only the spans we
// generate here are ever produced. This is the XSS boundary for model output —
// pinned down by aura-terminal.pipe.spec.ts.
@Pipe({ name: 'auraTerminal', standalone: true })
export class AuraTerminalPipe implements PipeTransform {
  private readonly sanitizer = inject(DomSanitizer);

  // Words that, on a line, mark it as a critical/danger readout (rendered red).
  private static readonly DANGER = /\bstop\b|\bimmediately\b|severe|do not|don't|hazard|danger|critical|overheat/i;
  // Softer advisories → yellow.
  private static readonly WARNING = /\bcaution\b|\bwarning\b|soon|monitor|recommend|should|check\b/i;

  transform(value: string | null | undefined): SafeHtml {
    const escaped = (value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    // Classify each line by severity and wrap it, so the whole line takes the
    // severity color (not just the "[ safety ]" tag). Done per-line before the
    // inline transforms so markers/bold still render inside the wrapper.
    const html = escaped
      .split('\n')
      .map((line) => {
        const hasSafety = /^\s*\[ ?safety ?\]/i.test(line);
        const severity = hasSafety || AuraTerminalPipe.DANGER.test(line)
          ? 'danger'
          : AuraTerminalPipe.WARNING.test(line)
            ? 'warn'
            : null;
        return severity ? `<span class="term-line term-line--${severity}">${line}</span>` : line;
      })
      .join('\n')
      // A leading "[ safety ]" tag on a line → highlighted danger token.
      .replace(/(^|>)(\s*)\[ ?safety ?\]/gim, '$1$2<span class="term-safety">[ safety ]</span>')
      // The ▸ / → markers get a dimmed accent so structure reads at a glance.
      .replace(/(^|\n|>)(\s*)(▸)/g, '$1$2<span class="term-mark">$3</span>')
      .replace(/(\s)(→)(\s)/g, '$1<span class="term-mark">$2</span>$3')
      // **bold** → key terms (codes, part names).
      .replace(/\*\*([^*]+)\*\*/g, '<strong class="term-strong">$1</strong>');

    return this.sanitizer.bypassSecurityTrustHtml(html);
  }
}
