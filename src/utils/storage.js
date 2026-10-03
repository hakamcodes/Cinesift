/**
 * utils/storage.js
 * Safe localStorage wrapper. Only this file calls localStorage.
 *
 * All methods are wrapped in try/catch because localStorage access
 * itself can throw (disabled storage, sandboxed iframes, Safari private mode).
 *
 * DATABASE_AND_STORAGE.md §4.
 */

/**
 * Check if localStorage is accessible.
 * @returns {boolean}
 */
export function isAvailable() {
  try {
    const k = '__cinesift_test__';
    localStorage.setItem(k, '1');
    localStorage.removeItem(k);
    return true;
  } catch {
    return false;
  }
}

/**
 * Safely read a raw string from localStorage.
 * @param {string} key
 * @returns {string|null}
 */
export function safeGet(key) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

/**
 * Safely write a string to localStorage.
 * @param {string} key
 * @param {string} str
 * @returns {boolean} true if succeeded
 */
export function safeSet(key, str) {
  try {
    localStorage.setItem(key, str);
    return true;
  } catch {
    return false; // QuotaExceededError etc.
  }
}

/**
 * Safely remove a key from localStorage.
 * @param {string} key
 */
export function safeRemove(key) {
  try {
    localStorage.removeItem(key);
  } catch { /* ignore */ }
}

/**
 * Read, parse, validate, and return a JSON value from localStorage.
 * On any failure, calls recover(reason) and returns the default.
 *
 * @param {string} key - localStorage key
 * @param {*} defaultValue - returned on missing or corrupt data
 * @param {Function} [validator] - (parsed) => boolean; if false → recover
 * @param {Function} [recover] - (reason, rawStr) => defaultValue
 * @returns {*}
 */
export function readJSON(key, defaultValue, validator, recover) {
  const raw = safeGet(key);
  if (raw === null) return defaultValue;

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    if (recover) return recover('parse', raw);
    return defaultValue;
  }

  if (validator && !validator(parsed)) {
    if (recover) return recover('shape', raw);
    return defaultValue;
  }

  return parsed;
}

/**
 * Serialize a value to JSON and write it to localStorage.
 * @param {string} key
 * @param {*} value
 * @returns {boolean} true if write succeeded
 */
export function writeJSON(key, value) {
  try {
    return safeSet(key, JSON.stringify(value));
  } catch {
    return false;
  }
}
