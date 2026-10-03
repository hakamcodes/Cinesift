/**
 * src/config.js
 * Single source of truth for all app constants.
 * Import this wherever you need a constant — never write the number inline.
 */

/** Debounce delay in milliseconds. AC-DB-3: must be exactly 300. */
export const DEBOUNCE_MS = 300;

/** Minimum valid query length (inclusive). */
export const MIN_QUERY = 2;

/** Maximum valid query length (inclusive). */
export const MAX_QUERY = 100;

/** Network timeout per request in milliseconds (10 s). */
export const TIMEOUT_MS = 10_000;

/** LRU cache capacity (number of entries). */
export const CACHE_MAX = 30;

/** Cache TTL in milliseconds (5 minutes). */
export const CACHE_TTL_MS = 5 * 60 * 1_000;

/** TMDB image base URL (hardcoded; also available via /configuration endpoint). */
export const IMG_BASE = 'https://image.tmdb.org/t/p';

/** TMDB API base URL for direct mode. */
export const TMDB_BASE = 'https://api.themoviedb.org/3';

/**
 * TMDB mode: 'direct' | 'mock' | 'proxy'
 * Injected by Vite from .env.local at build time.
 * Default to 'mock' so the app works even without credentials.
 */
const getEnv = (key, def) => {
  if (typeof process !== 'undefined' && process.env && process.env[key] !== undefined) return process.env[key];
  if (typeof import.meta !== 'undefined' && import.meta.env) return import.meta.env[key] || def;
  return def;
};

export const TMDB_MODE = getEnv('VITE_TMDB_MODE', 'mock');
export const TMDB_TOKEN = getEnv('VITE_TMDB_TOKEN', '');
export const TMDB_API_KEY = getEnv('VITE_TMDB_API_KEY', '');


/** Maximum page number TMDB allows for search/discover. */
export const MAX_PAGE = 500;

/** Number of skeleton cards shown while loading. */
export const SKELETON_COUNT = 12;
