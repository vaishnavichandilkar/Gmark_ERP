import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig({
  plugins: [
    tailwindcss(),
    react()
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      'html2canvas': 'html2canvas-pro'
    },
    dedupe: ['react', 'react-dom', 'react-i18next', 'i18next']
  },
  optimizeDeps: {
    include: ['react', 'react-dom', 'react-i18next', 'i18next']
  },
  server: {
    host: true,
    port: 5174,
    allowedHosts: true,
    proxy: {
      '/api': {
        target: 'http://localhost:3002',
        changeOrigin: true,
        secure: false,
      },
    },
  },
})