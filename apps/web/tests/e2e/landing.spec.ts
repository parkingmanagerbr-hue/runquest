import { test, expect } from '@playwright/test';

/**
 * A landing é i18n (10 idiomas) e o preço é detectado pela região do navegador
 * (`navigator.languages`). O teste antigo tinha strings pt-BR fixas sem declarar
 * locale nenhum — sob o padrão do Playwright (en-US) ele renderiza inglês, então
 * a asserção já estava quebrada. Ninguém viu, porque a suíte e2e nunca rodava
 * (o playwright.config não tinha webServer). Agora cada teste declara o locale
 * que exercita — e assim o próprio i18n passa a ser testado.
 */

test.describe('landing em pt-BR', () => {
  test.use({ locale: 'pt-BR' });

  test('renderiza o hero, CTA e preço em BRL', async ({ page }) => {
    await page.goto('/');
    // level: 1 — sem isso, /Conquiste/ casa também com o h3 "Conquiste território".
    await expect(page.getByRole('heading', { level: 1, name: /Conquiste/ })).toBeVisible();
    await expect(page.getByRole('link', { name: /Criar conta/i })).toBeVisible();
    await expect(page.getByText('R$ 19,90').first()).toBeVisible();
  });
});

test.describe('landing em inglês (padrão do navegador)', () => {
  test.use({ locale: 'en-US' });

  test('renderiza o hero traduzido', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1, name: /Conquer/ })).toBeVisible();
    await expect(page.getByRole('link', { name: /Create account/i })).toBeVisible();
  });
});

test('manifesto PWA disponível', async ({ page }) => {
  const res = await page.request.get('/manifest.webmanifest');
  expect(res.status()).toBe(200);
  const json = await res.json();
  expect(json.short_name).toBe('RunQuest');
});
