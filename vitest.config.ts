import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  test: {
    globals: true,
    exclude: ['e2e/**', '.next/**', 'node_modules/**'],
  },
  resolve: { alias: { '@': path.resolve(__dirname) } },
})
