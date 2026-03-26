import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5174,
    proxy: {
      '/api': {
        target: 'http://localhost:3002',
        changeOrigin: true,
        secure: true,
        maxBodySize: 10 * 1024 * 1024, // 10MB to handle large base64 restore payloads
      }
    }
  }
})
