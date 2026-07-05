import { Pipe, PipeTransform, inject } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';

// Renders the small subset of Markdown that Aura emits — **bold**, *italic*,
// `code`, "- " / "* " bullet lists, and line breaks — as themed HTML. Input is
// HTML-escaped FIRST, so model output can never inject markup; only the tags we
// generate here are ever produced. Intentionally minimal: not a full Markdown
// engine, just enough to make replies read well without a dependency.
@Pipe({ name: 'auraMarkdown', standalone: true })
export class AuraMarkdownPipe implements PipeTransform {
  private readonly sanitizer = inject(DomSanitizer);

  transform(value: string | null | undefined): SafeHtml {
    const raw = value ?? '';
    const escaped = raw
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    const lines = escaped.split('\n');
    const html: string[] = [];
    let inList = false;

    const inline = (s: string): string =>
      s
        // `code` — before bold/italic so backticked asterisks aren't touched.
        .replace(/`([^`]+)`/g, '<code class="md-code">$1</code>')
        // **bold**
        .replace(/\*\*([^*]+)\*\*/g, '<strong class="md-strong">$1</strong>')
        // *italic* (single asterisk, not part of a ** pair)
        .replace(/(^|[^*])\*(?!\*)([^*]+)\*(?!\*)/g, '$1<em>$2</em>');

    for (const line of lines) {
      const bullet = line.match(/^\s*[-*]\s+(.*)$/);
      if (bullet) {
        if (!inList) { html.push('<ul class="md-list">'); inList = true; }
        html.push(`<li>${inline(bullet[1])}</li>`);
        continue;
      }
      if (inList) { html.push('</ul>'); inList = false; }
      if (line.trim() === '') { html.push('<br>'); continue; }
      html.push(`<p class="md-p">${inline(line)}</p>`);
    }
    if (inList) html.push('</ul>');

    return this.sanitizer.bypassSecurityTrustHtml(html.join(''));
  }
}
