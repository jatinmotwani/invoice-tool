import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts', 'scripts/**/*.test.ts'],
    coverage: {
      include: ['src/lib/invoice/**/*.ts', 'src/lib/db/**/*.ts'],
      exclude: ['src/lib/**/*.test.ts', 'src/lib/invoice/fixtures.ts'],
      thresholds: { statements: 95, lines: 95, functions: 95, branches: 90 },
    },
  },
});
