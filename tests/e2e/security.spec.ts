import { editorReady } from './helpers';
import { expect, test } from '@playwright/test';

const PAGES = ['/', '/does-not-exist'];

for (const path of PAGES) {
  test(`no CSP violations on ${path}`, async ({ page }) => {
    const violations: string[] = [];
    page.on('console', (msg) => {
      if (/Content Security Policy/i.test(msg.text())) violations.push(msg.text());
    });
    await page.goto(path);
    await page.waitForLoadState('networkidle');
    expect(violations).toEqual([]);
  });
}

test('the editor island hydrates under the strict CSP', async ({ page }) => {
  await page.goto('/');
  await editorReady(page);
  const csp = await page.locator('meta[http-equiv="content-security-policy"]').getAttribute('content');
  expect(csp).toContain("script-src 'self'");
  expect(csp).not.toContain('unsafe-inline');
});

test('security headers from _headers are served', async ({ request }) => {
  const res = await request.get('/');
  const headers = res.headers();
  expect(headers['content-security-policy']).toContain("frame-ancestors 'none'");
  expect(headers['x-content-type-options']).toBe('nosniff');
  expect(headers['referrer-policy']).toBe('strict-origin-when-cross-origin');
});
