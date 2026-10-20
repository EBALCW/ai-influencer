import { expect, test } from '@playwright/test';

test('home page explains the studio is being prepared', async ({ page }) => {
  await page.goto('/');
  await expect(
    page.getByRole('heading', { name: /Fikirden yayına/i }),
  ).toBeVisible();
  await expect(page.getByText('Geliştirme ortamı')).toBeVisible();
});
