import { defineConfig } from 'vite';
import { resolve } from 'path';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [tailwindcss()],
  server: {
    proxy: {
      '/api': {
        target: process.env.VITE_PROXY_TARGET || 'http://127.0.0.1:3000',
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
        login: resolve(__dirname, 'login.html'),
        elections: resolve(__dirname, 'elections.html'),
        admin: resolve(__dirname, 'admin.html'),
        beginners: resolve(__dirname, 'beginners.html'),
        faq: resolve(__dirname, 'faq.html'),
        walls: resolve(__dirname, 'walls.html'),
        gallery: resolve(__dirname, 'gallery.html'),
        verify: resolve(__dirname, 'verify.html'),
      },
    },
  },
});
