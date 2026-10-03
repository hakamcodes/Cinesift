import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    proxy: {
      '/api/tmdb': {
        target: 'https://api.themoviedb.org/3',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/tmdb/, '')
      }
    }
  },
  test: {
    environment: 'jsdom',
    globals: true,
  },
});
