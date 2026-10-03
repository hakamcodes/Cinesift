/**
 * state/store.js
 * Tiny observable store — the single source of truth for the whole app.
 *
 * Pattern: subscribers get the full state snapshot after every setState call.
 * Components call store.subscribe() and re-render on changes.
 * Components NEVER write to state directly — they call actions/controllers.
 */

/**
 * Initial application state shape.
 * All fields must be serialisable (no functions, no DOM references).
 */
const INITIAL_STATE = {
  search: {
    // State machine: idle|debouncing|loading|success|empty|error
    status: 'idle',
    rawInput: '',           // Exactly what the user typed
    query: '',              // Normalised, sent to the active request
    committedQuery: '',     // Query whose results are currently displayed
    filters: {
      genre: null,
      year: null,
      minRating: 0,
      sort: 'relevance',
    },
    page: 1,
    totalPages: 0,
    totalResults: 0,
    results: [],            // MovieSummary[]
    loadingMore: false,
    error: null,            // { category, userMessage, retryable }
    requestId: 0,           // Monotonic ID of the latest issued request
  },
  ui: {
    diagnosticsOpen: false,
    toast: null,            // { message, type, id }
  },
};

/**
 * Create a new store instance.
 *
 * @returns {{ getState, setState, subscribe }}
 */
export function createStore() {
  // Deep clone the initial state so tests don't share it.
  let state = structuredClone(INITIAL_STATE);

  // All subscribers are called after every setState.
  const subscribers = new Set();

  /**
   * Get a frozen snapshot of the current state.
   * @returns {object}
   */
  function getState() {
    return state; // Callers must not mutate this.
  }

  /**
   * Merge a partial state object (one or more top-level keys).
   * Nested objects like `search` are shallow-merged.
   *
   * @param {object} partial - e.g. { search: { status: 'loading' } }
   */
  function setState(partial) {
    for (const key of Object.keys(partial)) {
      if (typeof partial[key] === 'object' && partial[key] !== null
          && !Array.isArray(partial[key]) && typeof state[key] === 'object') {
        // Shallow merge nested objects (e.g. state.search).
        state[key] = { ...state[key], ...partial[key] };
      } else {
        state[key] = partial[key];
      }
    }
    notify();
  }

  /**
   * Subscribe to all state changes.
   * @param {Function} fn - Called with the current state snapshot.
   * @returns {Function} Unsubscribe function.
   */
  function subscribe(fn) {
    subscribers.add(fn);
    fn(state); // Call immediately with current state.
    return () => subscribers.delete(fn);
  }

  /** Notify all subscribers. */
  function notify() {
    for (const fn of subscribers) fn(state);
  }

  return { getState, setState, subscribe };
}
