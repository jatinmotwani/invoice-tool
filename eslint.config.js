import js from '@eslint/js';
import astro from 'eslint-plugin-astro';
import jsxA11y from 'eslint-plugin-jsx-a11y-x';
import reactHooks from 'eslint-plugin-react-hooks';
import { defineConfig, globalIgnores } from 'eslint/config';
import tseslint from 'typescript-eslint';

export default defineConfig(
  globalIgnores(['dist/', '.astro/', 'coverage/', 'playwright-report/', 'test-results/', '.lighthouseci/']),
  js.configs.recommended,
  tseslint.configs.strict,
  astro.configs.recommended,
  {
    files: ['**/*.tsx'],
    extends: [jsxA11y.configs.recommended, reactHooks.configs.flat.recommended],
  },
  {
    files: ['**/*.{js,mjs}'],
    languageOptions: {
      globals: { console: 'readonly', process: 'readonly', URL: 'readonly' },
    },
  },
  {
    files: ['**/*.cjs'],
    languageOptions: {
      sourceType: 'commonjs',
      globals: { require: 'readonly', module: 'writable', __dirname: 'readonly' },
    },
    rules: { '@typescript-eslint/no-require-imports': 'off' },
  },
  {
    rules: {
      // Money maths must be explicit: no silent float coercion via `==`.
      eqeqeq: ['error', 'always'],
      '@typescript-eslint/consistent-type-imports': 'error',
      // `import { type X }` leaves a side-effect import behind (verbatimModuleSyntax), which can drag zod
      // into the editor bundle. Require `import type { X }` instead.
      '@typescript-eslint/no-import-type-side-effects': 'error',
    },
  },
);
