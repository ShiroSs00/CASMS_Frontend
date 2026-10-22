import { fileURLToPath, URL } from 'node:url'

import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const apiTarget = env.CASMS_API_PROXY_TARGET || 'http://127.0.0.1:8080'
  const target = new URL(apiTarget)
  if (!['http:', 'https:'].includes(target.protocol) || target.username || target.password || target.pathname !== '/' || target.search || target.hash) throw new Error('CASMS_API_PROXY_TARGET must be an HTTP(S) origin without credentials or a path.')
  return {
  plugins: [react()],
  server: {
    proxy: {
      '/api': { target: apiTarget, changeOrigin: true },
    },
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  }
})
