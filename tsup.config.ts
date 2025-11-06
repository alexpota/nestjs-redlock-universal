import { defineConfig } from 'tsup';

export default defineConfig({
  // Entry points
  entry: ['src/index.ts'],

  // Output formats
  format: ['esm', 'cjs'],

  // Output options
  outDir: 'dist',
  clean: true,

  // Code generation
  target: 'es2022',
  minify: false, // Keep readable for debugging
  sourcemap: false, // Following redlock-universal best practice

  // TypeScript
  dts: true, // Generate .d.ts files
  splitting: false, // Keep simple for library

  // Bundling
  treeshake: true,
  external: [
    // Peer dependencies should be external
    '@nestjs/common',
    '@nestjs/core',
    'redlock-universal',
    'reflect-metadata',
  ],

  // Banner for CJS compatibility
  banner: {
    js: `
/**
 * nestjs-redlock-universal
 * NestJS integration for redlock-universal
 */`.trim(),
  },

  // Platform
  platform: 'node',

  // esbuild options
  esbuildOptions(options) {
    options.conditions = ['node'];
    options.mainFields = ['module', 'main'];
  },
});
