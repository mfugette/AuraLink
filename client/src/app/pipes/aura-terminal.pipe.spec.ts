import { TestBed } from '@angular/core/testing';
import { DomSanitizer } from '@angular/platform-browser';
import { AuraTerminalPipe } from './aura-terminal.pipe';

// This pipe feeds [innerHTML] on the assistant page, so its escaping IS the
// XSS boundary for model output. These tests pin that behavior down.
describe('AuraTerminalPipe', () => {
  let pipe: AuraTerminalPipe;
  let sanitizer: DomSanitizer;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    TestBed.runInInjectionContext(() => {
      pipe = new AuraTerminalPipe();
    });
    sanitizer = TestBed.inject(DomSanitizer);
  });

  function html(input: string | null | undefined): string {
    return String(sanitizer.sanitize(1 /* SecurityContext.HTML */, pipe.transform(input)) ?? '');
  }

  it('escapes HTML so model output cannot inject markup', () => {
    const out = html('<script>alert(1)</script> <img src=x onerror=alert(1)>');
    expect(out).not.toContain('<script>');
    expect(out).not.toContain('<img');
    expect(out).toContain('&lt;script&gt;');
  });

  it('escapes ampersands first (no double-escaping)', () => {
    expect(html('AT&T & <b>')).toContain('AT&amp;T &amp; &lt;b&gt;');
  });

  it('renders **bold** as a term-strong span', () => {
    expect(html('check the **oxygen sensor** first')).toContain('<strong class="term-strong">oxygen sensor</strong>');
  });

  it('highlights a leading [ safety ] tag', () => {
    expect(html('[ safety ] disconnect the battery')).toContain('<span class="term-safety">[ safety ]</span>');
  });

  it('renders a [ safety ] line as a whole-line danger color', () => {
    const out = html('[ safety ] Stop the vehicle immediately.');
    expect(out).toContain('class="term-line term-line--danger"');
    // The inner tag span is preserved inside the line wrapper.
    expect(out).toContain('<span class="term-safety">[ safety ]</span>');
  });

  it('colors danger-word lines red and advisory lines yellow', () => {
    expect(html('Do not restart the engine.')).toContain('term-line--danger');
    expect(html('Caution: check coolant level soon.')).toContain('term-line--warn');
    expect(html('Likely causes: parasitic drain.')).not.toContain('term-line--');
  });

  it('accents ▸ and → structure markers', () => {
    const out = html('▸ step one\n  → detail');
    expect(out).toContain('<span class="term-mark">▸</span>');
    expect(out).toContain('<span class="term-mark">→</span>');
  });

  it('handles null/undefined gracefully', () => {
    expect(html(null)).toBe('');
    expect(html(undefined)).toBe('');
  });

  it('does NOT convert markdown inside what looks like an attribute', () => {
    // Even if the model tries something clever, the escaped text stays inert.
    const out = html('"><script>**x**</script>');
    expect(out).not.toContain('<script>');
  });
});
