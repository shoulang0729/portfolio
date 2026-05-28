// ESLint flat config (ESLint v9+)
import globals from 'globals';
import importPlugin from 'eslint-plugin-import';

export default [
  {
    ignores: ['src/_disabled/**', 'tests/spec_validation.test.js', 'dist/**'],
  },
  {
    files: ['src/**/*.js', 'worker/src/**/*.js'],
    plugins: {
      import: importPlugin,
    },
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
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      'import/order': ['warn', {
        groups: ['builtin', 'external', 'internal', 'parent', 'sibling', 'index'],
        'newlines-between': 'always',
      }],
      'import/no-duplicates': 'error',
      'import/newline-after-import': 'warn',
    },
  },
];
