import { readFileSync } from 'node:fs';
import { crc32, deflateSync } from 'node:zlib';
import { editorReady } from './helpers';
import { expect, type Page, test } from '@playwright/test';

/** Minimal valid RGBA PNG of a solid colour. */
function png(width: number, height: number): Buffer {
  const chunk = (type: string, data: Buffer) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const body = Buffer.concat([Buffer.from(type), data]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(body));
    return Buffer.concat([len, body, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr.set([8, 6, 0, 0, 0], 8); // 8-bit RGBA
  const row = Buffer.concat([Buffer.from([0]), Buffer.alloc(width * 4, Buffer.from([29, 78, 216, 255]))]);
  const raw = Buffer.concat(Array.from({ length: height }, () => row));
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

async function open(page: Page) {
  await page.goto('/');
  await editorReady(page);
}

async function fillBasics(page: Page, client = 'Acme Pvt Ltd') {
  await page.getByLabel('Your name or business name').fill('Asha Rao');
  await page.getByLabel('Client name').fill(client);
  await page.getByLabel('Description').first().fill('Logo design');
  await page.getByLabel('Rate', { exact: true }).first().fill('25000');
  await expect(page.getByText('Saved on this device', { exact: true })).toBeVisible();
}

test('logo is resized on-device and shown on the invoice', async ({ page }) => {
  await open(page);
  const input = page.getByLabel('Logo (optional)');
  await input.setInputFiles({ name: 'logo.png', mimeType: 'image/png', buffer: png(1200, 400) });
  const logo = page.locator('.invoice-paper img').first();
  await expect(logo).toHaveAttribute('src', /^data:image\/png;base64,/);
  // Resized to fit 600×240 and kept well under 200 KB.
  const [w, h, chars] = await logo.evaluate((img: HTMLImageElement) => [
    img.naturalWidth,
    img.naturalHeight,
    img.src.length,
  ]);
  expect([w, h]).toEqual([600, 200]);
  expect(chars).toBeLessThan(200 * 1024 * 1.37);

  await input.setInputFiles({ name: 'x.gif', mimeType: 'image/gif', buffer: Buffer.from('GIF89a') });
  await expect(page.getByText('Use a PNG, JPG or WebP image.')).toBeVisible();
});

test('Duplicate and New take the next number in the series', async ({ page }) => {
  await open(page);
  await fillBasics(page);
  await expect(page.getByLabel('Invoice number')).toHaveValue('INV/26-27/001');
  await page.getByRole('button', { name: 'Duplicate' }).click();
  await expect(page.getByLabel('Invoice number')).toHaveValue('INV/26-27/002');
  await expect(page.getByLabel('Client name')).toHaveValue('Acme Pvt Ltd');
  await page.getByLabel('Description').first().fill('Revisions');
  await expect(page.getByText('Saved on this device', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'New', exact: true }).click();
  await expect(page.getByLabel('Invoice number')).toHaveValue('INV/26-27/003');
  await expect(page.getByLabel('Client name')).toHaveValue('');
  // Saved client is offered for the next invoice.
  await page.getByLabel('Saved clients').selectOption({ label: 'Acme Pvt Ltd' });
  await expect(page.getByLabel('Client name')).toHaveValue('Acme Pvt Ltd');
});

test('Share falls back to download + WhatsApp link when files can’t be shared', async ({ page }) => {
  await open(page);
  await page.evaluate(() => {
    // Simulate a browser without file sharing.
    Object.defineProperty(navigator, 'canShare', { value: undefined, configurable: true });
  });
  await fillBasics(page);
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Share' }).click(),
  ]);
  expect(download.suggestedFilename()).toMatch(/\.pdf$/);
  const link = page.getByRole('link', { name: 'Open WhatsApp' });
  await expect(link).toHaveAttribute('href', /^https:\/\/wa\.me\/\?text=Hi%20Acme%20Pvt%20Ltd%2C/);
});

test('backup exports JSON and restores it after data is lost', async ({ page }) => {
  await open(page);
  await fillBasics(page, 'Backup Client');
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Export backup' }).first().click(),
  ]);
  const json = readFileSync(await download.path(), 'utf8');
  expect(JSON.parse(json)).toMatchObject({ format: 'invoice-tool-backup', version: 1 });
  await expect(page.getByText(/Last backup:/)).not.toContainText('never');

  // Lose everything, then restore.
  await page.evaluate(
    () =>
      new Promise((resolve) => {
        const req = indexedDB.deleteDatabase('invoice-tool');
        req.onsuccess = req.onerror = req.onblocked = () => resolve(null);
      }),
  );
  await page.reload();
  await editorReady(page);
  await page
    .getByLabel('Import backup')
    .setInputFiles({ name: 'b.json', mimeType: 'application/json', buffer: Buffer.from(json) });
  await page.getByRole('button', { name: 'Replace everything' }).click();
  await page.waitForLoadState('load');
  await editorReady(page);
  await expect(page.getByLabel('Saved clients')).toContainText('Backup Client');
});
