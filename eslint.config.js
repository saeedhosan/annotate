import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
    {
        ignores: ['dist/**', 'release/**', 'build/**', 'node_modules/**', 'assets/**'],
    },
    {
        name: 'node / electron main',
        files: ['src/main/**/*.ts', 'scripts/**/*.mjs', '*.config.{js,mjs}'],
        languageOptions: { globals: globals.node },
    },
    {
        name: 'renderer (browser)',
        files: ['src/renderer/**/*.ts'],
        languageOptions: { globals: globals.browser },
    },
    {
        name: 'service worker',
        files: ['src/renderer/public/sw.js'],
        languageOptions: { globals: globals.worker },
    },
    js.configs.recommended,
    ...tseslint.configs.recommended,
    {
        name: 'typescript overrides',
        files: ['**/*.ts'],
        rules: {
            '@typescript-eslint/no-unused-vars': [
                'error',
                { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
            ],
        },
    },
);
