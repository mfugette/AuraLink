// A tiny 5-row block-letter figlet — renders a short label (a vehicle nickname)
// as pixel-style ASCII, matching the Aura boot banner's blocky wordmark. Uses the
// half-block glyphs █ ▀ ▄ so a 5-row grid reads as chunky pixels in JetBrains Mono.
//
// Only the characters a vehicle name realistically needs are covered (A–Z, 0–9,
// space, and a few separators); anything unknown falls back to a filled block so
// the banner never breaks. Case-insensitive (names are upper-cased first).

// Each glyph is 5 rows tall. Rows use '#' for an "on" pixel and ' ' for "off";
// they're translated to full-height blocks at render time. Width varies per glyph.
const GLYPHS: Record<string, string[]> = {
  A: ['####', '#  #', '####', '#  #', '#  #'],
  B: ['### ', '#  #', '### ', '#  #', '### '],
  C: ['####', '#   ', '#   ', '#   ', '####'],
  D: ['### ', '#  #', '#  #', '#  #', '### '],
  E: ['####', '#   ', '### ', '#   ', '####'],
  F: ['####', '#   ', '### ', '#   ', '#   '],
  G: ['####', '#   ', '# ##', '#  #', '####'],
  H: ['#  #', '#  #', '####', '#  #', '#  #'],
  I: ['###', ' # ', ' # ', ' # ', '###'],
  J: ['####', '   #', '   #', '#  #', '####'],
  K: ['#  #', '# # ', '##  ', '# # ', '#  #'],
  L: ['#   ', '#   ', '#   ', '#   ', '####'],
  M: ['#   #', '## ##', '# # #', '#   #', '#   #'],
  N: ['#  #', '## #', '# ##', '#  #', '#  #'],
  O: ['####', '#  #', '#  #', '#  #', '####'],
  P: ['####', '#  #', '####', '#   ', '#   '],
  Q: ['####', '#  #', '#  #', '# ##', '####'],
  R: ['### ', '#  #', '### ', '# # ', '#  #'],
  S: ['####', '#   ', '####', '   #', '####'],
  T: ['#####', '  #  ', '  #  ', '  #  ', '  #  '],
  U: ['#  #', '#  #', '#  #', '#  #', '####'],
  V: ['#   #', '#   #', '#   #', ' # # ', '  #  '],
  W: ['#   #', '#   #', '# # #', '## ##', '#   #'],
  X: ['#  #', ' ## ', ' ## ', ' ## ', '#  #'],
  Y: ['#   #', ' # # ', '  #  ', '  #  ', '  #  '],
  Z: ['####', '  # ', ' #  ', '#   ', '####'],
  '0': ['####', '#  #', '#  #', '#  #', '####'],
  '1': [' # ', '## ', ' # ', ' # ', '###'],
  '2': ['### ', '   #', ' ## ', '#   ', '####'],
  '3': ['####', '   #', ' ###', '   #', '####'],
  '4': ['#  #', '#  #', '####', '   #', '   #'],
  '5': ['####', '#   ', '####', '   #', '####'],
  '6': ['####', '#   ', '####', '#  #', '####'],
  '7': ['####', '   #', '  # ', ' #  ', ' #  '],
  '8': ['####', '#  #', '####', '#  #', '####'],
  '9': ['####', '#  #', '####', '   #', '####'],
  '-': ['    ', '    ', '####', '    ', '    '],
  '.': ['  ', '  ', '  ', '  ', '# '],
  "'": ['# ', '# ', '  ', '  ', '  '],
  ' ': ['  ', '  ', '  ', '  ', '  '],
};

const FALLBACK = ['####', '####', '####', '####', '####'];
const GAP = ' '; // one blank column between glyphs

// Translate a raw '#'/' ' glyph grid into chunky block pixels. A lit cell becomes
// a full block; unlit stays blank. Kept simple (no half-block antialiasing) so the
// result is crisp and unmistakably pixel-art, matching the app's icon language.
function blockify(rows: string[]): string[] {
  return rows.map(r => r.replace(/#/g, '█'));
}

/**
 * Render `label` as a 5-line block-letter banner string (newline-separated).
 * Names longer than `maxChars` are truncated with a trailing '…' represented as
 * dots. Returns '' for an empty label so the caller can fall back to a default.
 */
export function blockFiglet(label: string, maxChars = 12): string {
  const text = (label ?? '').trim().toUpperCase();
  if (!text) return '';

  const chars = [...text].slice(0, maxChars);
  const glyphs = chars.map(c => blockify(GLYPHS[c] ?? FALLBACK));

  const lines: string[] = [];
  for (let row = 0; row < 5; row++) {
    lines.push(glyphs.map(g => g[row]).join(GAP));
  }
  return lines.join('\n');
}
