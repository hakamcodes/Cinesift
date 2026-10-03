/**
 * state/historyStore.js
 * Manages the recent-search history.
 *
 * Schema (DATABASE_AND_STORAGE.md §3):
 *   { "v": 1, "items": [{ "q": "batman", "t": 1767225600000 }] }
 *
 * Rules (DATABASE_AND_STORAGE.md §3.2):
 *   - Max 8 entries, newest first.
 *   - Saved only when: search returned success OR user pressed Enter (explicit).
 *   - Dedupe case-insensitive on normalised query; removes old entry before re-adding.
 *   - In-memory fallback when localStorage unavailable.
 */

import { isAvailable, writeJSON } from '../utils/storage.js';
import { readJSON } from '../utils/storage.js';

const KEY = 'cinesift:history:v1';
const CURRENT_VERSION = 1;
const MAX_ENTRIES = 8;

/** @type {Set<Function>} */
const subscribers = new Set();

/** @type {{ items: object[], available: boolean }} */
let state = loadHistory();

// ── Load / validate ────────────────────────────────────────────────────────

/**
 * Validate a single history entry.
 * @param {*} x
 * @returns {boolean}
 */
function isValidEntry(x) {
  return (
    x != null
    && typeof x.q === 'string' && x.q.length >= 2 && x.q.length <= 100
    && typeof x.t === 'number'
  );
}

/**
 * Load and validate history from localStorage.
 * @returns {{ items: object[], available: boolean }}
 */
function loadHistory() {
  const available = isAvailable();
  const parsed = readJSON(
    KEY,
    null,
    (d) => d && typeof d === 'object' && Array.isArray(d.items),
    () => null,
  );

  if (parsed === null) return { items: [], available };

  // Validate entries: must be valid shape, deduped, capped at 8.
  const seen = new Set();
  const items = parsed.items
    .filter(x => isValidEntry(x) && !seen.has(x.q.toLowerCase()) && seen.add(x.q.toLowerCase()))
    .slice(0, MAX_ENTRIES);

  return { items, available };
}

function persist() {
  const ok = writeJSON(KEY, { v: CURRENT_VERSION, items: state.items });
  if (!ok && state.available) {
    state = { ...state, available: false };
  }
}

function notify() {
  for (const fn of subscribers) fn({ ...state });
}

// ── Public API ─────────────────────────────────────────────────────────────

/**
 * Subscribe to history changes.
 * @param {Function} fn
 * @returns {Function} unsubscribe
 */
export function subscribe(fn) {
  subscribers.add(fn);
  fn({ ...state });
  return () => subscribers.delete(fn);
}

/**
 * Add or promote a query to the top of history.
 * Only call this when a search returned success OR user pressed Enter.
 *
 * @param {string} query - Already normalised query (length 2–100).
 */
export function push(query) {
  if (!query || query.length < 2 || query.length > 100) return;

  // Remove any existing entry with the same query (case-insensitive).
  const lower = query.toLowerCase();
  const filtered = state.items.filter(x => x.q.toLowerCase() !== lower);

  // Prepend and cap.
  const items = [{ q: query, t: Date.now() }, ...filtered].slice(0, MAX_ENTRIES);

  state = { ...state, items };
  persist();
  notify();
}

/**
 * Remove a single history entry by query string.
 * @param {string} query
 */
export function removeOne(query) {
  const lower = query.toLowerCase();
  state = { ...state, items: state.items.filter(x => x.q.toLowerCase() !== lower) };
  persist();
  notify();
}

/**
 * Clear all history entries.
 */
export function clear() {
  state = { ...state, items: [] };
  persist();
  notify();
}
