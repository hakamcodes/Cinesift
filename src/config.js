/**
 * src/config.js
 * Single source of truth for all app constants.
 */

export const DEBOUNCE_MS = 300;
export const MIN_QUERY = 2;
export const MAX_QUERY = 100;
export const TIMEOUT_MS = 10_000;
export const CACHE_MAX = 30;
export const CACHE_TTL_MS = 5 * 60 * 1_000;
export const IMG_BASE = 'https://image.tmdb.org/t/p';

const getEnv = (key, def) => {
  if (typeof process !== 'undefined' && process.env && process.env[key] !== undefined) return process.env[key];
  if (typeof import.meta !== 'undefined' && import.meta.env) return import.meta.env[key] || def;
  return def;
};

export const TMDB_MODE = getEnv('VITE_TMDB_MODE', 'mock');
export const TMDB_TOKEN = getEnv('VITE_TMDB_TOKEN', '');
export const TMDB_API_KEY = getEnv('VITE_TMDB_API_KEY', '');

export const TMDB_BASE = TMDB_MODE === 'proxy' ? '/api/tmdb' : 'https://api.themoviedb.org/3';

export const MAX_PAGE = 500;
export const SKELETON_COUNT = 12;
