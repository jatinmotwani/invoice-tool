// Minimal static server for dist/ that mimics Cloudflare Pages: clean URLs (/page -> page.html),
// redirects from *.html, custom 404.html, headers from dist/_headers and brotli/gzip compression of text
// responses (Cloudflare compresses too, so Lighthouse sees realistic transfer sizes). Used by e2e tests and LHCI.
import { createReadStream, existsSync, readFileSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize } from 'node:path';
import { createBrotliCompress, createGzip } from 'node:zlib';

const ROOT = new URL('../dist/', import.meta.url).pathname;
const PORT = Number(process.env.PORT ?? 4321);

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.json': 'application/json',
  '.xml': 'application/xml',
  '.txt': 'text/plain; charset=utf-8',
  '.ttf': 'font/ttf',
  '.woff2': 'font/woff2',
  '.webmanifest': 'application/manifest+json',
};

/** Parse Cloudflare's `_headers` format: a URL pattern line followed by indented `Name: value` lines. */
export function parseHeadersFile(text) {
  const rules = [];
  let current = null;
  for (const raw of text.split('\n')) {
    if (!raw.trim() || raw.trim().startsWith('#')) continue;
    if (/^\s/.test(raw)) {
      const idx = raw.indexOf(':');
      if (current && idx > 0) current.headers.push([raw.slice(0, idx).trim(), raw.slice(idx + 1).trim()]);
    } else {
      current = { pattern: raw.trim(), headers: [] };
      rules.push(current);
    }
  }
  return rules;
}

export function patternMatches(pattern, path) {
  const re = new RegExp(
    '^' +
      pattern
        .split('*')
        .map((s) => s.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/:\w+/g, '[^/]+'))
        .join('.*') +
      '$',
  );
  return re.test(path);
}

function fileFor(pathname) {
  const clean = normalize(decodeURIComponent(pathname)).replace(/^(\.\.[/\\])+/, '');
  const candidates = pathname.endsWith('/')
    ? [join(clean, 'index.html')]
    : [clean, `${clean}.html`, join(clean, 'index.html')];
  for (const c of candidates) {
    const full = join(ROOT, c);
    if (full.startsWith(ROOT) && existsSync(full) && statSync(full).isFile()) return full;
  }
  return null;
}

function start() {
  const headersPath = join(ROOT, '_headers');
  const rules = existsSync(headersPath) ? parseHeadersFile(readFileSync(headersPath, 'utf8')) : [];

  createServer((req, res) => {
    const url = new URL(req.url ?? '/', 'http://localhost');
    const { pathname } = url;

    if (pathname.endsWith('.html')) {
      const target = pathname === '/index.html' ? '/' : pathname.replace(/(\/index)?\.html$/, '');
      res.writeHead(308, { Location: target || '/' }).end();
      return;
    }
    if (pathname !== '/' && pathname.endsWith('/') && !fileFor(pathname)) {
      res.writeHead(308, { Location: pathname.slice(0, -1) }).end();
      return;
    }

    let file = fileFor(pathname);
    let status = 200;
    if (!file) {
      file = join(ROOT, '404.html');
      status = 404;
    }
    for (const rule of rules) {
      if (patternMatches(rule.pattern, pathname)) {
        for (const [name, value] of rule.headers) res.setHeader(name, value);
      }
    }
    const type = TYPES[extname(file)] ?? 'application/octet-stream';
    res.setHeader('Content-Type', type);
    const accept = String(req.headers['accept-encoding'] ?? '');
    const compressible = /^(text\/|application\/(json|xml|manifest)|image\/svg)/.test(type);
    const encoding = !compressible
      ? null
      : /\bbr\b/.test(accept)
        ? 'br'
        : /\bgzip\b/.test(accept)
          ? 'gzip'
          : null;
    if (encoding) {
      res.setHeader('Content-Encoding', encoding);
      res.setHeader('Vary', 'Accept-Encoding');
    }
    res.writeHead(status);
    const body = createReadStream(file);
    if (encoding === 'br') body.pipe(createBrotliCompress()).pipe(res);
    else if (encoding === 'gzip') body.pipe(createGzip()).pipe(res);
    else body.pipe(res);
  }).listen(PORT, () => console.log(`Serving dist/ on http://localhost:${PORT}`));
}

if (import.meta.url === `file://${process.argv[1]}`) start();
