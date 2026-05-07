import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  // Base path для развертывания на Tomcat.
  // DPA: /dpa_card/  |  PHA: /pha_card/  |  PPV: /ppv_card/
  // Задать при сборке: VITE_APP_BASE=/pha_card/ npm run build:pha
  // PPV: ссылка «Ответ» на карту результата рассмотрения — VITE_REVIEW_RESULT_CARD_BASE (путь или URL без завершающего /)
  base: process.env.VITE_APP_BASE || '/dpa_card/',
  // Директория для сборки (будет скопирована в WAR)
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    // Генерировать source maps для production (опционально)
    sourcemap: false,
    // Оптимизация для production
    minify: 'esbuild',
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom'],
          'antd-vendor': ['antd'],
        },
      },
    },
  },
  server: {
    port: 3000,
    open: true,
  },
})


