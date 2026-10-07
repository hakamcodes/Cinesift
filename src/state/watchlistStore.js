/**
 * state/watchlistStore.js
 * Manages the local watchlist with versioned envelope, validation,
 * corrupt-data recovery, in-memory fallback, and cross-tab sync.
 *
 * Schema (DATABASE_AND_STORAGE.md §2):
 *   { "v": 1, "items": [{ id, title, posterPath, year, rating, addedAt }] }
 *
 * Rules:
 *   - In-memory array is the source of truth; persistence is a side-effect.
 *   - Add: validate → dedupe → unshift → persist.
 *   - Remove: filter → persist; returns false if id not found.
 *   - Toggle: has(id) ? remove : add; returns new boolean state.
 *   - Undo remove: re-insert at original index within 5 s (kept in toast closure).
 *   - Max 200 items.
 *   - Cross-tab sync via 'storage' event.
 */

import { isAvailable, safeGet, writeJSON } from '../utils/storage.js';

const KEY = 'cinesift:watchlist:v1';
const CURRENT_VERSION = 1;
const MAX_ITEMS = 200;

/** @type {Set<Function>} */
const subscribers = new Set();

/** @type {{ items: object[], available: boolean }} */
let state = loadWatchlist();

// Cross-tab sync.
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key === KEY) {
      state = loadWatchlist();
      notify();
    }
  });
}

// ── Load / validate ────────────────────────────────────────────────────────

/**
 * Validate a single item snapshot.
 * @param {*} x
 * @returns {boolean}
 */
function isValidItem(x) {
  return (
    x != null
    && Number.isInteger(x.id) && x.id > 0
    && typeof x.title === 'string'
  );
}

/**
 * Migrate older formats to current schema.
 * @param {*} raw
 * @returns {object|null}
 */
function migrate(raw) {
  // Bare array (hypothetical v0)
  if (Array.isArray(raw)) {
    return { v: 1, items: raw.filter(isValidItem) };
  }
  if (!raw || typeof raw !== 'object') return null;
  // Future version — read-only fallback.
  if (raw.v > CURRENT_VERSION) return raw;
  // v1 or v-less
  return { v: 1, items: Array.isArray(raw.items) ? raw.items : [] };
}

/**
 * Load and validate watchlist from localStorage.
 * @returns {{ items: object[], available: boolean }}
 */
function loadWatchlist() {
  const available = isAvailable();
  const raw = safeGet(KEY);
  if (raw === null) return { items: [], available };

  let parsed;
  try { parsed = JSON.parse(raw); } catch { return recover('parse', raw, available); }

  const migrated = migrate(parsed);
  if (!migrated || !Array.isArray(migrated.items)) {
    return recover('shape', raw, available);
  }

  // Dedupe and validate items.
  const seen = new Set();
  const items = migrated.items.filter(x =>
    isValidItem(x) && !seen.has(x.id) && seen.add(x.id)
  );

  return { items, available };
}

/**
 * Handle corrupt data: back up the raw string, reset, emit a single toast.
 * @param {string} reason
 * @param {string} rawStr
 * @param {boolean} available
 * @returns {{ items: [], available: boolean }}
 */
function recover(reason, rawStr, available) {
  try {
    localStorage.setItem(KEY + ':corrupt', rawStr.slice(0, 20000));
    localStorage.removeItem(KEY);
  } catch { /* ignore */ }
  // Emit a toast via a custom event (so this module stays UI-free).
  window.dispatchEvent(new CustomEvent('cinesift:toast', {
    detail: { message: "Your saved list couldn't be read and was reset.", type: 'warn' }
  }));
  return { items: [], available };
}

// ── Persistence ────────────────────────────────────────────────────────────

/**
 * Persist the current in-memory state to localStorage.
 */
function persist() {
  const ok = writeJSON(KEY, { v: 1, items: state.items });
  if (!ok && state.available) {
    state = { ...state, available: false };
    window.dispatchEvent(new CustomEvent('cinesift:toast', {
      detail: { message: "Saving isn't available in this browser. Your list will reset when you close the tab.", type: 'warn' }
    }));
  }
}

function notify() {
  for (const fn of subscribers) fn({ ...state });
}

// ── Public API ─────────────────────────────────────────────────────────────

/**
 * Subscribe to watchlist changes.
 * @param {Function} fn - Called with { items, available }.
 * @returns {Function} unsubscribe
 */
export function subscribe(fn) {
  subscribers.add(fn);
  fn({ ...state });
  return () => subscribers.delete(fn);
}

/**
 * Get current watchlist snapshot.
 * @returns {{ items: object[], available: boolean }}
 */
export function getState() {
  return { ...state };
}

/**
 * Check if a movie id is in the watchlist.
 * @param {number} id
 * @returns {boolean}
 */
export function has(id) {
  return state.items.some(x => x.id === id);
}

/**
 * Add a movie to the watchlist.
 * @param {{ id, title, posterPath, year, rating }} movie
 * @returns {boolean} false if already in list or invalid
 */
export function add(movie) {
  if (!isValidItem(movie)) return false;
  if (has(movie.id)) return false;
  if (state.items.length >= MAX_ITEMS) {
    window.dispatchEvent(new CustomEvent('cinesift:toast', {
      detail: { message: 'Watchlist is full (200).', type: 'warn' }
    }));
    return false;
  }
  const snapshot = {
    id: movie.id,
    title: movie.title,
    posterPath: movie.posterPath ?? null,
    year: movie.year ?? null,
    rating: movie.rating ?? null,
    addedAt: Date.now(),
  };
  state = { ...state, items: [snapshot, ...state.items] };
  persist();
  notify();
  return true;
}

/**
 * Remove a movie from the watchlist by id.
 * @param {number} id
 * @returns {{ removed: boolean, index: number, item: object|null }}
 */
export function remove(id) {
  const index = state.items.findIndex(x => x.id === id);
  if (index === -1) return { removed: false, index: -1, item: null };
  const item = state.items[index];
  state = { ...state, items: state.items.filter(x => x.id !== id) };
  persist();
  notify();
  return { removed: true, index, item };
}

/**
 * Toggle a movie in/out of the watchlist.
 * @param {{ id, title, posterPath, year, rating }} movie
 * @returns {boolean} new `has(id)` state
 */
export function toggle(movie) {
  if (has(movie.id)) {
    remove(movie.id);
    return false;
  } else {
    add(movie);
    return true;
  }
}

/**
 * Re-insert a previously removed item at its original index.
 * Used by the Undo toast.
 * @param {object} item
 * @param {number} originalIndex
 */
export function undoRemove(item, originalIndex) {
  if (has(item.id)) return; // already re-added somehow
  const newItems = [...state.items];
  const insertAt = Math.min(originalIndex, newItems.length);
  newItems.splice(insertAt, 0, item);
  state = { ...state, items: newItems };
  persist();
  notify();
}

/**
 * Clear all items (used by "Clear all" button with confirm dialog).
 */
export function clear() {
  state = { ...state, items: [] };
  persist();
  notify();
}
