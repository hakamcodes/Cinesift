/**
 * services/cache.js
 * Small LRU (Least Recently Used) cache with a TTL (time-to-live).
 *
 * Used by movieService to avoid re-fetching the same query within 5 minutes.
 * Capacity: 30 entries. Oldest entries are evicted when the cache is full.
 *
 * The cache does NOT replace the race guard — cached responses still go
 * through the same requestId flow in searchController.
 */

import { CACHE_MAX, CACHE_TTL_MS } from '../config.js';

/**
 * Create a new LRU cache.
 *
 * @param {{ max?: number, ttl?: number }} [opts]
 * @returns {{ get: Function, set: Function, has: Function, clear: Function }}
 */
export function createCache(opts = {}) {
  const MAX = opts.max ?? CACHE_MAX;
  const TTL = opts.ttl ?? CACHE_TTL_MS;

  // JS Map preserves insertion order and lets us iterate from oldest to newest.
  // We move accessed keys to the end so the front = LRU candidate.
  /** @type {Map<string, { value: any, expires: number }>} */
  const store = new Map();

  /**
   * Retrieve a value from the cache.
   * Returns undefined if the key doesn't exist or the entry has expired.
   *
   * @param {string} key
   * @returns {any | undefined}
   */
  function get(key) {
    const entry = store.get(key);
    if (!entry) return undefined;

    // Check TTL — remove stale entries.
    if (Date.now() > entry.expires) {
      store.delete(key);
      return undefined;
    }

    // LRU: re-insert at the end (most recently used).
    store.delete(key);
    store.set(key, entry);
    return entry.value;
  }

  /**
   * Store a value in the cache.
   * If the cache is full, the least recently used entry is evicted.
   *
   * @param {string} key
   * @param {any} value
   */
  function set(key, value) {
    // If key already exists, refresh it (delete first so re-insertion goes to end).
    if (store.has(key)) store.delete(key);

    // Evict the oldest entry when at capacity.
    if (store.size >= MAX) {
      const oldest = store.keys().next().value; // first key = oldest
      store.delete(oldest);
    }

    store.set(key, { value, expires: Date.now() + TTL });
  }

  /**
   * Check if a key is in the cache and not expired (without updating LRU order).
   * @param {string} key
   * @returns {boolean}
   */
  function has(key) {
    const entry = store.get(key);
    if (!entry) return false;
    if (Date.now() > entry.expires) { store.delete(key); return false; }
    return true;
  }

  /** Remove all entries. */
  function clear() {
    store.clear();
  }

  return { get, set, has, clear };
}
