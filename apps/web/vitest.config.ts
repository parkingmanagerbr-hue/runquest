import { defineConfig } from 'vitest/config';

/**
 * Escopo do vitest = testes unitários em `src/**`.
 * Os testes e2e do Playwright (`tests/e2e/**`) NÃO devem ser coletados pelo
 * vitest — o `test()` do Playwright quebra sob o runner do vitest. Eles rodam
 * pelo `pnpm test:e2e` (playwright test), não pelo `pnpm test` (vitest run).
 */
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.{test,spec}.ts'],
    exclude: ['tests/**', 'node_modules/**', '.next/**', 'dist/**'],
  },
});
