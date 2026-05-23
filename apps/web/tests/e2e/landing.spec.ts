import { test, expect } from '@playwright/test';

test('landing renderiza hero e CTAs', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /Conquiste/ })).toBeVisible();
  await expect(page.getByRole('link', { name: /Começar grátis/i })).toBeVisible();
  await expect(page.getByText('R$ 19,90')).toBeVisible();
  await expect(page.getByText('Personal Trainer IA')).toBeVisible();
});

test('manifesto PWA disponível', async ({ page }) => {
  const res = await page.request.get('/manifest.webmanifest');
  expect(res.status()).toBe(200);
  const json = await res.json();
  expect(json.short_name).toBe('RunQuest');
});
