import { expect, type Page, test } from '@playwright/test';

const GSTIN_MH = '27AAPFU0939F1ZV'; // valid checksum, Maharashtra

async function open(page: Page) {
  const errors: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/');
  await expect(page.getByRole('group', { name: 'Invoice editor' })).toBeEnabled();
  return errors;
}

/** The preview is always in the DOM; on mobile it's behind the Preview toggle. */
async function showPreview(page: Page) {
  const toggle = page.getByRole('button', { name: 'Preview', exact: true });
  if (await toggle.isVisible()) await toggle.click();
  return page.locator('.invoice-paper');
}

async function showEditor(page: Page) {
  const toggle = page.getByRole('button', { name: 'Edit', exact: true });
  if (await toggle.isVisible()) await toggle.click();
}

test('not GST-registered: plain invoice with UPI QR, saved across reloads', async ({ page }) => {
  const errors = await open(page);
  await page.getByLabel('Your name or business name').fill('Asha Rao');
  await page.getByLabel('Your state').selectOption('27');
  await page.getByLabel('Client name').fill('Acme Pvt Ltd');
  await page.getByLabel('Description').first().fill('Logo design');
  await page.getByLabel('Rate', { exact: true }).first().fill('25000');
  await page.getByLabel('UPI ID').fill('asha@okaxis');

  const paper = await showPreview(page);
  await expect(paper.getByRole('heading', { level: 2 })).toHaveText('Invoice');
  await expect(paper).toContainText('Not registered under GST');
  await expect(paper).toContainText('₹25,000.00');
  await expect(paper).toContainText('Rupees Twenty-Five Thousand Only');
  await expect(paper.getByRole('img', { name: /UPI QR code/ })).toBeVisible();

  await expect(page.getByText('Saved on this device', { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('group', { name: 'Invoice editor' })).toBeEnabled();
  await showEditor(page);
  await expect(page.getByLabel('Client name')).toHaveValue('Acme Pvt Ltd');
  expect(errors).toEqual([]);
});

test('GST-registered, other state: tax invoice with IGST', async ({ page }) => {
  await open(page);
  await page.getByText('Yes', { exact: true }).click();
  await page.getByLabel('Your GSTIN').fill(GSTIN_MH);
  await expect(page.getByText('Maharashtra · PAN AAPFU0939F')).toBeVisible();
  await page.getByLabel('Client name').fill('Beta LLP');
  await page.getByLabel("Client's state").selectOption('29');
  await page.getByLabel('Rate', { exact: true }).first().fill('10000');
  await expect(page.getByRole('status').first()).toContainText('IGST');

  const paper = await showPreview(page);
  await expect(paper.getByRole('heading', { level: 2 })).toHaveText('Tax Invoice');
  await expect(paper).toContainText('29 - Karnataka');
  await expect(paper).toContainText('IGST @ 18%');
  await expect(paper).toContainText('₹11,800.00');

  await showEditor(page);
  await page.getByLabel("Client's state").selectOption('27');
  await showPreview(page);
  await expect(paper).toContainText('CGST @ 9%');
  await expect(paper).toContainText('SGST @ 9%');
});

test('export under LUT: foreign currency, IGST 0% and endorsement', async ({ page }) => {
  await open(page);
  await page.getByText('Yes', { exact: true }).click();
  await page.getByLabel('Your GSTIN').fill(GSTIN_MH);
  await page.getByLabel('Client name').fill('Globex Inc.');
  await page.getByLabel('Country').selectOption('US');
  await page.getByLabel('LUT ARN').fill('AD270326000123X');
  await page.getByLabel(/Exchange rate/).fill('83.25');
  await page.getByLabel('Rate', { exact: true }).first().fill('1200');

  const paper = await showPreview(page);
  await expect(paper).toContainText('96 - Other Countries');
  await expect(paper).toContainText('IGST @ 0%');
  await expect(paper).toContainText('$1,200.00');
  await expect(paper).toContainText('One Thousand Two Hundred US Dollars Only');
  await expect(paper).toContainText('INR equivalent: ₹99,900.00');
  await expect(paper).toContainText('LETTER OF UNDERTAKING WITHOUT PAYMENT OF INTEGRATED TAX');
});

test('invoice numbers follow the GST rules', async ({ page }) => {
  await open(page);
  const number = page.getByLabel('Invoice number');
  await expect(number).toHaveAttribute('maxlength', '16');
  await number.fill('INV 001');
  await expect(page.getByText('Use only letters, numbers, “-” and “/”.')).toBeVisible();
});
