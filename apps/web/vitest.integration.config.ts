import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./src/__tests__/integration/setup.ts'],
    include: ['src/__tests__/integration/**/*.test.ts'],
    exclude: ['node_modules', '.next'],
    testTimeout: 30000,
    hookTimeout: 30000,
    // Run serially to avoid DB race conditions
    sequence: {
      concurrent: false,
    },
    fileParallelism: false,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
