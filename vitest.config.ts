import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    // Default environment for React component tests
    environment: 'jsdom',
    // Setup file runs before each test suite
    setupFiles: ['./src/test-setup.ts'],
    // Use node environment for all backend tests
    environmentMatchGlobs: [
      ['server/**', 'node'],
    ],
    coverage: {
      provider: 'v8',
      // Generate reports for CI (lcov for SonarQube, text for terminal, html for humans)
      reporter: ['text', 'lcov', 'html', 'json-summary'],
      include: ['src/**/*.{ts,tsx}', 'server/**/*.js'],
      exclude: [
        '**/__tests__/**',
        '**/test-setup.ts',
        '**/node_modules/**',
        '**/dist/**',
        'src/main.tsx',
      ],
      // Threshold set at 40% — raise progressively as tests are added
      // Components making API calls (MenuSection, LocationSection) need fetch mocking to test
      thresholds: {
        lines: 40,
        functions: 40,
        branches: 40,
        statements: 40,
      },
    },
  },
});
