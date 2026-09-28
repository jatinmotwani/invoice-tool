import { expect, test } from '@playwright/test';

test('home page renders static content with one H1', async ({ page }) => {
  const errors: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  page.on('pageerror', (err) => errors.push(err.message));

  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('lang', 'en-IN');
  await expect(page.locator('h1')).toHaveCount(1);
  await expect(page.locator('link[rel="canonical"]')).toHaveCount(1);
  expect(errors).toEqual([]);
});

test('unknown routes show the custom 404', async ({ page }) => {
  await page.goto('/does-not-exist');
  await expect(page.locator('h1')).toHaveText('Page not found');
});
