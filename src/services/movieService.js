/**
 * services/movieService.js
 * Public API used by controllers — completely vendor-agnostic.
 *
 * Selects the right adapter (real TMDB, mock, or proxy) based on VITE_TMDB_MODE.
 * Controllers and the UI never import the adapters directly.
 *
 * Also applies caching: if the same search is in the LRU cache and hasn't
 * expired, the adapter call is skipped entirely.
 */

import { TMDB_MODE } from '../config.js';
import { createCache } from './cache.js';

// ─── Adapter selection ────────────────────────────────────────────────────

// Also check the URL search param ?mock=1 for quick switching in the browser.
const urlMock = typeof window !== 'undefined'
  && new URLSearchParams(window.location.search).get('mock') === '1';

const useMock = urlMock || TMDB_MODE === 'mock';

/** Lazily import the right adapter to avoid bundling both. */
let _adapter = null;

async function getAdapter() {
  if (_adapter) return _adapter;
  if (useMock) {
    _adapter = await import('./mockAdapter.js');
  } else {
    _adapter = await import('./tmdbAdapter.js');
  }
  return _adapter;
}

// ─── Cache ────────────────────────────────────────────────────────────────

const cache = createCache();

/**
 * Build the cache key for a search.
 * @param {{ query: string, page: number, year?: string|null }} params
 * @returns {string}
 */
function cacheKey({ query, page, year }) {
  return `search:${query.toLowerCase()}|${year ?? ''}|${page}`;
}

// ─── Public API ───────────────────────────────────────────────────────────

/**
 * Search for movies.
 * Checks the cache first; falls back to the adapter.
 *
 * @param {{ query: string, page?: number, year?: string|null }} params
 * @param {AbortSignal | null} signal
 * @returns {Promise<{ page, totalPages, totalResults, items }>}
 */
export async function search(params, signal = null) {
  const { query, page = 1, year = null } = params;
  const key = cacheKey({ query, page, year });

  // Cache hit: return immediately without hitting the network.
  const cached = cache.get(key);
  if (cached) return cached;

  const adapter = await getAdapter();
  const result = await adapter.search({ query, page, year }, signal);

  // Cache the result for future identical searches.
  cache.set(key, result);
  return result;
}

/**
 * Fetch trending movies (home page). Not cached (trending changes daily).
 *
 * @param {{ window?: 'day'|'week', page?: number }} [params]
 * @param {AbortSignal | null} signal
 * @returns {Promise<{ page, totalPages, totalResults, items }>}
 */
export async function trending(params = {}, signal = null) {
  const adapter = await getAdapter();
  return adapter.trending(params, signal);
}

/**
 * Fetch movie details.
 *
 * @param {number} id
 * @param {AbortSignal | null} signal
 * @returns {Promise<object>}
 */
export async function details(id, signal = null) {
  const adapter = await getAdapter();
  return adapter.details(id, signal);
}

/**
 * Discover movies (browse mode without text query).
 *
 * @param {object} params
 * @param {AbortSignal | null} signal
 * @returns {Promise<{ page, totalPages, totalResults, items }>}
 */
export async function discover(params = {}, signal = null) {
  const adapter = await getAdapter();
  return adapter.discover(params, signal);
}

/**
 * Fetch genre id to name map. Cached in memory.
 *
 * @param {AbortSignal | null} signal
 * @returns {Promise<Map<number, string>>}
 */
export async function genres(signal = null) {
  const key = 'genres:map';
  const cached = cache.get(key);
  if (cached) return cached;

  const adapter = await getAdapter();
  const map = await adapter.genres(signal);
  cache.set(key, map);
  return map;
}

/** Expose cache for testing / diagnostics. */
export { cache };
