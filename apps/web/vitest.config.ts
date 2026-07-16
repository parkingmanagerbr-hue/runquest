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
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    exclude: ['tests/**', 'node_modules/**', '.next/**', 'dist/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text-summary', 'text'],
      // Cobertura mede a LÓGICA PURA (motores testáveis). Hooks de efeito
      // colateral (BLE/GPS/speech/push), o cliente HTTP e i18n são integração,
      // não unidade pura — ficam de fora do alvo (seriam ruído no número).
      include: [
        'src/lib/trainingPaces.ts', 'src/lib/adaptivePlan.ts', 'src/lib/ghostRace.ts',
        'src/lib/runCard.ts', 'src/lib/fitnessTrend.ts', 'src/lib/routePlanner.ts',
        'src/lib/workoutTemplates.ts', 'src/lib/geo.ts', 'src/lib/pricing.ts',
        'src/lib/runPersistence.ts', 'src/lib/bluetooth.ts', 'src/lib/vo2max.ts',
        'src/lib/gpsTrack.ts', 'src/lib/calories.ts', 'src/lib/dateKey.ts',
        'src/lib/parsePace.ts',
      ],
      // Piso de cobertura — o build FALHA se cair abaixo (atual ~99% stmts).
      // Ninguém adiciona lógica pura sem testar. Margem p/ pequenas flutuações.
      thresholds: { statements: 95, branches: 80, functions: 95, lines: 95 },
    },
  },
});
