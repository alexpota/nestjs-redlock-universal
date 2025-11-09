import { defineConfig } from 'tsup';

export default defineConfig({
  // Entry points
  entry: ['src/index.ts'],

  // Output formats - Build both formats for proper metadata
  format: ['cjs', 'esm'],

  // TypeScript - Generate declaration files
  dts: true,

  // Build configuration
  splitting: false,
  sourcemap: true,
  clean: true,

  // CRITICAL: Preserve decorator metadata
  keepNames: true,

  // Explicitly use tsconfig for decorator settings
  tsconfig: './tsconfig.json',

  // External dependencies - don't bundle peer deps
  external: ['@nestjs/common', '@nestjs/core', 'redlock-universal', 'reflect-metadata'],
});
