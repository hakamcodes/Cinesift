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
export const TMDB_MODE = import.meta.env.VITE_TMDB_MODE || 'mock';

/**
 * Bearer token for 'direct' mode.
 * NEVER log this value or include it in error messages.
 */
export const TMDB_TOKEN = import.meta.env.VITE_TMDB_TOKEN || '';

/**
 * Alternative API key (query param) for 'direct' mode.
 * Used only if TMDB_TOKEN is empty.
 */
export const TMDB_API_KEY = import.meta.env.VITE_TMDB_API_KEY || '';

/** Maximum page number TMDB allows for search/discover. */
export const MAX_PAGE = 500;

/** Number of skeleton cards shown while loading. */
export const SKELETON_COUNT = 12;
