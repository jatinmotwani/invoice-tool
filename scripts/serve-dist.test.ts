import { describe, expect, it } from 'vitest';
import { parseHeadersFile, patternMatches } from './serve-dist.mjs';

describe('_headers parsing', () => {
  it('reads patterns with indented headers and skips comments', () => {
    const rules = parseHeadersFile('# c\n/*\n  X-Frame-Options: DENY\n  CSP: a; b:c\n/fonts/*\n  Cache: 1\n');
    expect(rules).toEqual([
      {
        pattern: '/*',
        headers: [
          ['X-Frame-Options', 'DENY'],
          ['CSP', 'a; b:c'],
        ],
      },
      { pattern: '/fonts/*', headers: [['Cache', '1']] },
    ]);
  });

  it('matches splats and placeholders like Cloudflare Pages', () => {
    expect(patternMatches('/*', '/')).toBe(true);
    expect(patternMatches('/*', '/a/b')).toBe(true);
    expect(patternMatches('/fonts/*', '/fonts/x.ttf')).toBe(true);
    expect(patternMatches('/fonts/*', '/other')).toBe(false);
    expect(patternMatches('/guides/:slug', '/guides/tds')).toBe(true);
    expect(patternMatches('/guides/:slug', '/guides/a/b')).toBe(false);
  });
});
