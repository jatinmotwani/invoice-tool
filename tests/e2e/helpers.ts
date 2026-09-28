import { expect, type Page } from '@playwright/test';

/** Wait until the editor island has hydrated and loaded (its <fieldset> drops `disabled`). */
export async function editorReady(page: Page) {
  await expect(page.locator('.editor fieldset[disabled]')).toHaveCount(0);
  await expect(page.getByLabel('Your name or business name')).toBeEnabled();
}
