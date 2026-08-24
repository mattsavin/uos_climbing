import { defineConfig } from 'vite';
import { resolve } from 'path';
import tailwindcss from '@tailwindcss/vite';

const cleanRouteRewrites: Record<string, string> = {
  '/about': '/about.html',
  '/competitions': '/competitions.html',
  '/schedule': '/schedule.html',
  '/dashboard': '/dashboard.html',
  '/login': '/login.html',
  '/gear': '/gear.html',
  '/elections': '/elections.html',
  '/admin': '/admin.html',
  '/gallery': '/gallery.html',
  '/gallery-manager': '/gallery-manager.html',
  '/beginners': '/beginners.html',
  '/walls': '/walls.html',
  '/faq': '/faq.html',
  '/social-agm': '/social-post.html',
  '/dashboard/social-post': '/social-post.html',
  '/beta-gate': '/beta-gate.html',
  '/verify': '/verify.html',
  '/dashboard/elections': '/elections.html',
  '/dashboard/gear': '/gear.html',
  '/dashboard/admin': '/admin.html',
  '/dashboard/gallery-manager': '/gallery-manager.html',
};

function rewriteCleanRoute(url: string | undefined): string | undefined {
  if (!url) return url;

  const [path, query = ''] = url.split('?');
  if (path.startsWith('/verify/')) {
    return query ? `/verify.html?${query}` : '/verify.html';
  }

  const normalizedPath = path.endsWith('/') && path !== '/' ? path.slice(0, -1) : path;
  const rewrittenPath = cleanRouteRewrites[normalizedPath];
  if (!rewrittenPath) return url;

  return query ? `${rewrittenPath}?${query}` : rewrittenPath;
}

export default defineConfig({
  plugins: [
    {
      name: 'clean-route-rewrites',
      configureServer(server) {
        server.middlewares.use((req, _res, next) => {
          req.url = rewriteCleanRoute(req.url);
          next();
        });
      },
      configurePreviewServer(server) {
        server.middlewares.use((req, _res, next) => {
          req.url = rewriteCleanRoute(req.url);
          next();
        });
      },
    },
    tailwindcss(),
  ],
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
        schedule: resolve(__dirname, 'schedule.html'),
        dashboard: resolve(__dirname, 'dashboard.html'),
        gear: resolve(__dirname, 'gear.html'),
        login: resolve(__dirname, 'login.html'),
        elections: resolve(__dirname, 'elections.html'),
        admin: resolve(__dirname, 'admin.html'),
        beginners: resolve(__dirname, 'beginners.html'),
        faq: resolve(__dirname, 'faq.html'),
        walls: resolve(__dirname, 'walls.html'),
        gallery: resolve(__dirname, 'gallery.html'),
        galleryManager: resolve(__dirname, 'gallery-manager.html'),
        socialPost: resolve(__dirname, 'social-post.html'),
        verify: resolve(__dirname, 'verify.html'),
      },
    },
  },
});
