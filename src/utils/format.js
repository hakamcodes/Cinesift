/**
 * utils/format.js
 * Pure formatting functions: image URLs, years, ratings, runtime.
 * All functions are side-effect-free and easy to test.
 */

import { IMG_BASE } from '../config.js';

/**
 * Build a TMDB image URL from a raw path.
 *
 * @param {string|null} path  - e.g. "/pB8BM7pdSp6B6Ih7QZ4DrQ3PmJK.jpg"
 * @param {string} size       - e.g. "w342", "w500", "original"
 * @returns {string|null}     - Full URL or null if path is null.
 *
 * @example
 *   imageUrl('/abc.jpg', 'w342') // "https://image.tmdb.org/t/p/w342/abc.jpg"
 *   imageUrl(null, 'w342')       // null
 */
export function imageUrl(path, size) {
  if (!path) return null;
  return `${IMG_BASE}/${size}${path}`;
}

/**
 * Format a rating number as a one-decimal string.
 * Returns "NR" (not rated) when rating is null.
 *
 * @param {number|null} rating
 * @returns {string}
 */
export function formatRating(rating) {
  if (rating === null || rating === undefined) return 'NR';
  return rating.toFixed(1);
}

/**
 * Format a year or releaseDate string as a 4-digit year string.
 * Returns "—" when not available.
 *
 * @param {number|string|null} year
 * @returns {string}
 */
export function formatYear(year) {
  if (!year) return '—';
  return String(year).slice(0, 4);
}

/**
 * Format runtime in minutes as "Xh Ym".
 * Returns null when runtime is 0 or missing (UI should hide the stat).
 *
 * @param {number|null} minutes
 * @returns {string|null}
 */
export function formatRuntime(minutes) {
  if (!minutes || minutes <= 0) return null;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}
