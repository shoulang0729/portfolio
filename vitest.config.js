import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    setupFiles: ['./tests/setup.js'],
    include: ['tests/**/*.test.js'],
    // spec_validation.test.cjs uses Node built-in test runner (CJS) — run via `npm run test:spec`
    // .cjs files are already excluded by the include pattern above
    coverage: {
      provider: 'v8',
      include: ['src/**/*.js'],
      exclude: ['src/_disabled/**'],
      reporter: ['text', 'html'],
    },
  },
});
