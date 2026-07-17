import { defineConfig } from '@playwright/test';

const baseURL = process.env.E2E_BASE_URL ?? 'http://localhost:3000';

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30_000,
  use: { baseURL, headless: true },
  reporter: [['list']],
  // Sem isto a suíte e2e era letra morta: não havia webServer, então `pnpm
  // test:e2e` só funcionava se alguém subisse o app à mão — na prática nunca
  // rodava (ERR_CONNECTION_REFUSED). Agora o Playwright sobe o app sozinho.
  // Quando E2E_BASE_URL aponta p/ um ambiente já no ar, não sobe nada.
  ...(process.env.E2E_BASE_URL
    ? {}
    : {
        webServer: {
          command: 'npm run dev',
          url: 'http://localhost:3000',
          reuseExistingServer: !process.env.CI,
          timeout: 120_000,
        },
      }),
});
