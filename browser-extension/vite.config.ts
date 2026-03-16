import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        popup: resolve(__dirname, 'src/popup/index.html'),
        'service-worker': resolve(__dirname, 'src/background/service-worker.ts'),
        taobao: resolve(__dirname, 'src/content-scripts/taobao.ts'),
        alibaba1688: resolve(__dirname, 'src/content-scripts/alibaba1688.ts'),
      },
      output: {
        entryFileNames: (chunkInfo) => {
          if (chunkInfo.name === 'service-worker') {
            return 'src/background/[name].js';
          }
          if (chunkInfo.name === 'taobao' || chunkInfo.name === 'alibaba1688') {
            return 'src/content-scripts/[name].js';
          }
          return 'src/popup/[name].js';
        },
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: (assetInfo) => {
          if (assetInfo.name?.endsWith('.css')) {
            return 'src/content-scripts/shared/floating-button.css';
          }
          return 'assets/[name]-[hash][extname]';
        },
      },
    },
    // Content scripts should not use code splitting
    cssCodeSplit: false,
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
});
