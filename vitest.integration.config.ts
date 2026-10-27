import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['test/**/*.test.ts'],
    testTimeout: 30000,
  },
  // Test files sit outside tsconfig "include", so enable legacy decorators explicitly
  oxc: {
    decorator: { legacy: true },
  },
});
