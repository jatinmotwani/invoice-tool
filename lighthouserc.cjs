// Lighthouse CI, mobile preset (Lighthouse default). Runs against dist/ served like Cloudflare Pages.
// Budgets from docs/SPEC.md. Lab runs cannot measure INP, so TBT is the lab proxy; field INP comes
// from Cloudflare Web Analytics.
const { readdirSync } = require('node:fs');
const { join, relative } = require('node:path');

const PORT = 4322;
const DIST = join(__dirname, 'dist');

function routes(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    if (e.isDirectory()) return routes(join(dir, e.name));
    if (!e.name.endsWith('.html') || e.name === '404.html') return [];
    const route =
      '/' +
      relative(DIST, join(dir, e.name))
        .replace(/(^|\/)index\.html$/, '')
        .replace(/\.html$/, '');
    return [route];
  });
}

module.exports = {
  ci: {
    collect: {
      startServerCommand: `PORT=${PORT} node scripts/serve-dist.mjs`,
      startServerReadyPattern: 'Serving dist',
      url: routes(DIST).map((r) => `http://localhost:${PORT}${r}`),
      numberOfRuns: 3,
      settings: { chromeFlags: '--no-sandbox --headless=new' },
    },
    assert: {
      assertions: {
        'largest-contentful-paint': ['error', { maxNumericValue: 2000, aggregationMethod: 'median-run' }],
        'cumulative-layout-shift': ['error', { maxNumericValue: 0.05, aggregationMethod: 'median-run' }],
        'total-blocking-time': ['error', { maxNumericValue: 200, aggregationMethod: 'median-run' }],
        'categories:accessibility': ['error', { minScore: 0.95 }],
        'categories:best-practices': ['error', { minScore: 0.95 }],
        'categories:seo': ['error', { minScore: 0.95 }],
      },
    },
    upload: { target: 'filesystem', outputDir: '.lighthouseci/reports' },
  },
};
