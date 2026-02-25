import { defineConfig } from 'vite';
import { resolve } from 'path';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [tailwindcss()],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      }
    }
  },
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        about: resolve(__dirname, 'about.html'),
        competitions: resolve(__dirname, 'competitions.html'),
        join: resolve(__dirname, 'join.html'),
        dashboard: resolve(__dirname, 'dashboard.html'),
        gear: resolve(__dirname, 'gear.html'),
      },
    },
  },
});
