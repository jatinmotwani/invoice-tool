// Fails when the JavaScript a page loads up front (gzip) exceeds its budget.
// Counts module scripts, island component/renderer URLs, inline scripts and every static import they pull in.
// Dynamic `import()` chunks (e.g. the PDF renderer) are excluded by design.
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join, posix, relative } from 'node:path';
import { gzipSync } from 'node:zlib';

const DIST = new URL('../dist/', import.meta.url).pathname;
const KB = 1024;
export const BUDGETS = { content: 50 * KB, tool: 150 * KB };
/** Pages with an interactive tool above the fold. Everything else is a content page. */
export const TOOL_PAGES = new Set([
  '/',
  '/invoice-without-gst',
  '/gst-invoice-generator',
  '/export-invoice-lut',
  '/tds-calculator',
  '/amount-in-words',
  '/gst-calculator',
  '/upi-qr-generator',
  '/gstin-validator',
]);

/** Script URLs a page loads eagerly, plus the bodies of inline scripts. */
export function scriptsInHtml(html) {
  const urls = new Set();
  const inline = [];
  for (const m of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)) {
    const attrs = m[1] ?? '';
    const src = /\bsrc=["']([^"']+)["']/.exec(attrs)?.[1];
    if (src) urls.add(src);
    else if (!/type=["']application\/(ld\+)?json["']/.test(attrs) && m[2]?.trim()) inline.push(m[2]);
  }
  for (const m of html.matchAll(/\b(?:component-url|renderer-url|before-hydration-url)=["']([^"']+)["']/g)) {
    if (m[1]) urls.add(m[1]);
  }
  return { urls: [...urls], inline };
}

/** Static import/export specifiers in (minified) ESM. `import("x")` is dynamic and ignored. */
export function staticImports(code) {
  const specs = new Set();
  const re = /(?:^|[;\s}])(?:import|export)\s*(?:[\w*${}\s,]+?\s*from\s*)?["']([^"']+)["']/g;
  for (const m of code.matchAll(re)) if (m[1]) specs.add(m[1]);
  return [...specs];
}

function gz(text) {
  return gzipSync(text, { level: 9 }).length;
}

function collect(url, fromFile, seen) {
  if (/^https?:/.test(url)) return; // third-party (analytics) is measured by Lighthouse, not here
  const path = url.startsWith('/') ? join(DIST, url) : join(dirname(fromFile), url);
  if (seen.has(path) || !existsSync(path)) return;
  seen.add(path);
  for (const spec of staticImports(readFileSync(path, 'utf8'))) {
    if (spec.startsWith('.') || spec.startsWith('/')) collect(spec, path, seen);
  }
}

function htmlFiles(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? htmlFiles(join(dir, e.name)) : e.name.endsWith('.html') ? [join(dir, e.name)] : [],
  );
}

export function routeFor(file) {
  const route =
    '/' +
    relative(DIST, file)
      .split('\\')
      .join(posix.sep)
      .replace(/(^|\/)index\.html$/, '')
      .replace(/\.html$/, '');
  return route.length > 1 ? route.replace(/\/$/, '') : '/';
}

function main() {
  let failed = false;
  const rows = [];
  for (const file of htmlFiles(DIST)) {
    const route = routeFor(file);
    const { urls, inline } = scriptsInHtml(readFileSync(file, 'utf8'));
    const seen = new Set();
    for (const url of urls) collect(url, file, seen);
    const bytes =
      [...seen].reduce((sum, p) => sum + gz(readFileSync(p)), 0) + inline.reduce((s, c) => s + gz(c), 0);
    const kind = TOOL_PAGES.has(route) ? 'tool' : 'content';
    const ok = bytes <= BUDGETS[kind];
    failed ||= !ok;
    rows.push({
      route,
      kind,
      'JS gz (KB)': (bytes / KB).toFixed(1),
      budget: BUDGETS[kind] / KB,
      ok: ok ? '✓' : '✗ OVER',
    });
  }
  console.table(rows.sort((a, b) => a.route.localeCompare(b.route)));
  if (failed) {
    console.error('JS budget exceeded.');
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) main();
