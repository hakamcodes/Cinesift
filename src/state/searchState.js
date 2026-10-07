/**
 * state/searchState.js
 * Pure reducer for the search state machine.
 *
 * Implements Layer 3 of race protection (STATE_AND_ASYNC_FLOW §3.3):
 * the reducer accepts SEARCH_SUCCESS only if action.query === state.query.
 *
 * States: idle | debouncing | loading | success | empty | error
 *
 * This file contains NO side effects — it only takes (state, action) → newState.
 * Tests can call `searchReducer` directly without touching the DOM or network.
 */

/**
 * @param {object} state   - The current search slice of the store.
 * @param {{ type: string, [key: string]: any }} action
 * @returns {object}       - New search state (merged by the store).
 */
export function searchReducer(state, action) {
  switch (action.type) {

    // ── Input events ────────────────────────────────────────────────────

    case 'INPUT_INVALID':
      // Empty, whitespace, or 1-char input — go to idle.
      // AC-QV-1: no request sent; timer cancelled by caller.
      return {
        ...state,
        status: 'idle',
        rawInput: action.raw ?? state.rawInput,
        query: '',
      };

    case 'INPUT_VALID':
      // Valid query typed — enter debouncing.
      // Keep previous results visible (no skeleton flash during debounce).
      // STATE_AND_ASYNC_FLOW §4.2: "keep previous content; skeleton only when request starts".
      return {
        ...state,
        status: 'debouncing',
        rawInput: action.raw ?? state.rawInput,
        query: action.query,  // normalised, not yet committed
      };

    // ── Request lifecycle ──────────────────────────────────────────────

    case 'SEARCH_START':
      // A request was actually dispatched — show skeleton now.
      return {
        ...state,
        status: 'loading',
        query: action.query,
        error: null,
        loadingMore: false,
        requestId: action.id,
      };

    case 'SEARCH_SUCCESS': {
      // Layer 3: reject if query no longer matches.
      if (action.query !== state.query) return state;

      const newStatus = action.data.items.length > 0 ? 'success' : 'empty';
      return {
        ...state,
        status: newStatus,
        committedQuery: action.query,
        results: action.data.items,
        page: action.data.page,
        totalPages: action.data.totalPages,
        totalResults: action.data.totalResults,
        loadingMore: false,
        error: null,
      };
    }

    case 'SEARCH_ERROR':
      // Layer 3: ignore stale errors.
      if (action.query !== state.query) return state;
      return {
        ...state,
        status: 'error',
        loadingMore: false,
        error: {
          category: action.error.category,
          userMessage: action.error.userMessage,
          retryable: action.error.retryable,
          retryAfter: action.error.retryAfter ?? null,
        },
      };

    case 'RETRY':
      // Go back to loading — caller will re-run the request.
      return {
        ...state,
        status: 'loading',
        error: null,
      };

    case 'CLEAR_INPUT':
      // User cleared the search box.
      return {
        ...state,
        status: 'idle',
        rawInput: '',
        query: '',
        results: [],
        error: null,
        page: 1,
        totalPages: 0,
        totalResults: 0,
      };

    // ── Load More ──────────────────────────────────────────────────────

    case 'LOAD_MORE_START':
      return {
        ...state,
        loadingMore: true,
      };

    case 'LOAD_MORE_SUCCESS': {
      if (action.query !== state.query || action.page !== state.page + 1) return state;
      // Dedupe by id.
      const existingIds = new Set(state.results.map(x => x.id));
      const newItems = action.data.items.filter(x => !existingIds.has(x.id));
      return {
        ...state,
        loadingMore: false,
        results: [...state.results, ...newItems],
        page: action.data.page,
        totalPages: action.data.totalPages,
        totalResults: action.data.totalResults,
      };
    }

    case 'LOAD_MORE_ERROR':
      return {
        ...state,
        loadingMore: false,
      };

    // ── Filters ────────────────────────────────────────────────────────

    case 'FILTER_CHANGED':
      return {
        ...state,
        filters: action.filters, // { genre, year, minRating, sort }
      };

    case 'SET_DIAGNOSTICS_OPEN':
      // Handled by UI slice, not here.
      return state;

    default:
      return state;
  }
}
