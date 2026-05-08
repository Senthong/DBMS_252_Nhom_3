import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// base: '/concurrency/' so prod nginx serves the SPA from /concurrency/
// without breaking asset paths.
export default defineConfig({
  base: '/concurrency/',
  plugins: [react()],
  server: {
    port: 3004,
    proxy: { '/api': 'http://localhost:8004' }
  },
  build: { outDir: 'dist' }
})
