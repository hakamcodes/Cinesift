/**
 * utils/normalizeQuery.js
 * Cleans a raw search input string to a canonical form.
 *
 * Rules (from STATE_AND_ASYNC_FLOW §1):
 *   1. trim() — remove leading/trailing whitespace.
 *   2. Collapse runs of inner whitespace to a single space.
 *   3. Truncate to MAX_QUERY (100) characters.
 *
 * Case is preserved; callers use toLowerCase() for comparison/cache keys.
 */

import { MAX_QUERY, MIN_QUERY } from '../config.js';

/**
 * Normalise a raw query string.
 *
 * @param {string} raw - The string exactly as the user typed it.
 * @returns {string}   - Cleaned string, at most MAX_QUERY chars.
 *
 * @example
 *   normalizeQuery("  batman  ")    // "batman"
 *   normalizeQuery("bat  man")      // "bat man"
 *   normalizeQuery("a".repeat(200)) // "a".repeat(100)
 */
export function normalizeQuery(raw) {
  // Step 1: trim whitespace from both ends.
  const trimmed = raw.trim();

  // Step 2: replace every run of whitespace (spaces, tabs, etc.) with one space.
  const collapsed = trimmed.replace(/\s+/g, ' ');

  // Step 3: truncate to the maximum allowed length.
  return collapsed.slice(0, MAX_QUERY);
}

/**
 * Returns true if a normalised query is long enough to search.
 * Keeps the validity check in one place so all callers agree.
 *
 * @param {string} normalised - Output from normalizeQuery().
 * @returns {boolean}
 */
export function isValidQuery(normalised) {
  return normalised.length >= MIN_QUERY;
}
