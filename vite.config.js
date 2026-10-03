import { defineConfig } from 'vite';

export default defineConfig({
  // Vitest config lives here too — no separate file needed
  test: {
    environment: 'jsdom',   // gives window, localStorage, AbortController, etc.
    globals: true,           // so tests can call describe/it/expect without importing
  },
});
