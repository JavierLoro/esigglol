import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  test: {
    globals: true,
    // Route wrappers use the real competition repository even when handlers are mocked.
    // A plain `npm test` must never open or migrate the application database.
    env: { DB_PATH: ':memory:' },
    exclude: ['e2e/**', '.next/**', '.next-e2e/**', '.next-valorant-sandbox/**', '.tmp/**', 'node_modules/**'],
  },
  resolve: { alias: { '@': path.resolve(__dirname) } },
})
