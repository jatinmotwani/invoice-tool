import { expect, type Page } from '@playwright/test';

/** Wait until the editor island has hydrated and loaded (its <fieldset> drops `disabled`). */
export async function editorReady(page: Page) {
  await expect(page.locator('.editor fieldset[disabled]')).toHaveCount(0);
  await expect(page.getByLabel('Your name or business name')).toBeEnabled();
}

/** The "Saved on this device" status (rendered once for phones, once for larger screens). */
export async function expectSaved(page: Page) {
  await expect(
    page.getByText('Saved on this device', { exact: true }).filter({ visible: true }),
  ).toBeVisible();
}

/** Click a secondary action (Print, Duplicate, New): in the "More" menu on phones, inline on larger screens. */
export async function clickAction(page: Page, name: 'Print' | 'Duplicate' | 'New') {
  const more = page.locator('summary', { hasText: 'More' });
  if (await more.isVisible()) await more.click();
  await page
    .getByRole('button', { name: name === 'New' ? /^New( invoice)?$/ : name, exact: name !== 'New' })
    .filter({ visible: true })
    .click();
}
