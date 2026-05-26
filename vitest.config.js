import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.js'],
    // spec_validation.test.js uses Node built-in test runner (CJS) — run via `npm run test:spec`
    exclude: ['tests/spec_validation.test.js'],
  },
});
