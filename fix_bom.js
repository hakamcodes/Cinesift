import fs from 'fs';

const vercelJson = {
  rewrites: [
    { source: '/api/tmdb/:path*', destination: 'https://api.themoviedb.org/3/:path*' },
    { source: '/(.*)', destination: '/index.html' }
  ]
};
fs.writeFileSync('vercel.json', JSON.stringify(vercelJson, null, 2));

const viteConf = `import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    proxy: {
      '/api/tmdb': {
        target: 'https://api.themoviedb.org/3',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\\/api\\/tmdb/, '')
      }
    }
  },
  test: {
    environment: 'jsdom',
    globals: true,
  },
});
`;
fs.writeFileSync('vite.config.js', viteConf);
console.log("Fixed BOM");
