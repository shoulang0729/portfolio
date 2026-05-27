// ESLint flat config (ESLint v9+)
import globals from 'globals';

export default [
  {
    ignores: ['src/_disabled/**', 'tests/spec_validation.test.js', 'dist/**'],
  },
  {
    files: ['src/**/*.js', 'worker/src/**/*.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        ...globals.browser,
        d3: 'readonly',
      },
    },
    rules: {
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      'no-undef': 'error',
      'no-var': 'error',
      'prefer-const': 'warn',
      'eqeqeq': ['error', 'always', { null: 'ignore' }],
    },
  },
];
