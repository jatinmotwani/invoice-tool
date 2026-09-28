import { readFileSync } from 'node:fs';
import { inflateSync } from 'node:zlib';
import { expect, test } from '@playwright/test';

/** Decompress every FlateDecode stream in a PDF and return them as text. */
function pdfStreams(pdf: Buffer): string {
  const out: string[] = [];
  const text = pdf.toString('latin1');
  for (const m of text.matchAll(/stream\r?\n/g)) {
    const start = (m.index ?? 0) + m[0].length;
    const end = text.indexOf('endstream', start);
    try {
      out.push(inflateSync(pdf.subarray(start, end)).toString('latin1'));
    } catch {
      // not a Flate stream (e.g. font program)
    }
  }
  return out.join('\n');
}

test('downloads an A4 PDF with embedded font and selectable ₹', async ({ page }) => {
  const violations: string[] = [];
  page.on('console', (m) => {
    if (/Content Security Policy|Refused/.test(m.text())) violations.push(m.text());
  });
  await page.goto('/');
  await expect(page.getByRole('group', { name: 'Invoice editor' })).toBeEnabled();
  await page.getByLabel('Your name or business name').fill('Asha Rao');
  await page.getByLabel('Client name').fill('Acme Pvt Ltd');
  await page.getByLabel('Description').first().fill('Logo design');
  await page.getByLabel('Rate', { exact: true }).first().fill('25000');
  await page.getByLabel('UPI ID').fill('asha@okaxis');

  const [download] = await Promise.all([
    page.waitForEvent('download', { timeout: 30_000 }),
    page.getByRole('button', { name: 'Download PDF' }).click(),
  ]);
  expect(download.suggestedFilename()).toBe('Invoice-INV-26-27-001.pdf');
  const pdf = readFileSync(await download.path());
  expect(pdf.subarray(0, 5).toString()).toBe('%PDF-');
  const raw = pdf.toString('latin1');
  expect(raw).toMatch(/\/MediaBox \[0 0 595\.2[0-9]* 841\.8[0-9]*\]/); // A4 in points
  expect(raw).toContain('/FontFile2'); // embedded TrueType subset
  const streams = pdfStreams(pdf);
  expect(streams).toMatch(/<20[bB]9>/); // ToUnicode maps a glyph to ₹, so the text is selectable/searchable
  expect(violations).toEqual([]);
});
