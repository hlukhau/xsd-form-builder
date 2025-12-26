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
  // Base path для развертывания на Tomcat
  // Если приложение будет развернуто в корне контекста, используйте '/'
  // Если в подпути (например /xsd-form-builder), используйте '/xsd-form-builder/'
  base: '/xsd_form_builder/',
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


