module.exports = {
  parser: '@typescript-eslint/parser',
  parserOptions: {
    project: 'tsconfig.json',
    sourceType: 'module',
  },
  plugins: ['@typescript-eslint', 'prettier'],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:prettier/recommended',
  ],
  root: true,
  env: {
    node: true,
  },
  ignorePatterns: ['*.spec.ts', '*.test.ts', 'dist', 'node_modules', '*.cjs', '*.config.ts'],
  rules: {
    '@typescript-eslint/no-explicit-any': 'error',

    // Reasonable defaults
    '@typescript-eslint/explicit-function-return-type': 'off',
    '@typescript-eslint/explicit-module-boundary-types': 'off',
    '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],

    // Consistent code style
    'no-console': 'warn',
    'prefer-const': 'error',
  },
};
