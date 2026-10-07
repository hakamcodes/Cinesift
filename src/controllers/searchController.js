/**
 * controllers/searchController.js
 * Orchestrates the full search lifecycle:
 *   input → debounce → validation → requestManager → store
 *
 * This is where the three layers of race protection come together:
 *   Layer 1: requestManager aborts the previous request automatically.
 *   Layer 2: isCurrent() check after every await.
 *   Layer 3: searchReducer rejects stale results by query.
 *
 * The controller owns the debounced function and the request manager reference.
 * It NEVER touches the DOM or imports tmdbAdapter directly.
 */

import { DEBOUNCE_MS, MIN_QUERY } from '../config.js';
import { debounce } from '../utils/debounce.js';
import { normalizeQuery, isValidQuery } from '../utils/normalizeQuery.js';
import { createRequestManager } from '../services/requestManager.js';
import * as movieService from '../services/movieService.js';
import { searchReducer } from '../state/searchState.js';
import { toAppError } from '../services/errors.js';

/**
 * Create a search controller bound to the given store and diagnostics.
 *
 * @param {{ getState, setState, subscribe }} store
 * @param {{ emit: Function }} diag - Diagnostics instance
 * @returns {{ onInput, onSubmit, retry, restoreFromUrl, unmount }}
 */
export function createSearchController(store, diag) {
  // Request manager handles lanes, IDs, and AbortControllers.
  const manager = createRequestManager(diag);

  // Expose the manager for test hooks (?debug=1).
  if (typeof window !== 'undefined'
      && new URLSearchParams(window.location.search).get('debug') === '1') {
    window.__cinesift = window.__cinesift || {};
    window.__cinesift.requestManager = manager;
  }

  // The debounced wrapper around executeSearch.
  // Hooks feed the diagnostics counters.
  const debouncedSearch = debounce(
    (query) => executeSearch(query),
    DEBOUNCE_MS,
    {
      onSchedule: () => diag.emit('timer_created'),
      onCancel:   () => diag.emit('timer_cancelled'),
      onFire:     () => diag.emit('timer_fired'),
    },
  );

  // ── Dispatch helper ──────────────────────────────────────────────────

  /**
   * Dispatch an action through the search reducer.
   * @param {object} action
   */
  function dispatch(action) {
    const current = store.getState().search;
    const next = searchReducer(current, action);
    if (next !== current) {
      store.setState({ search: next });
    }
  }

  // ── URL sync helpers ──────────────────────────────────────────────────

  /** Sync current query to the URL without adding a history entry. */
  function syncUrlParams(query, push = false) {
    if (typeof history === 'undefined') return;
    const url = new URL(window.location.href);
    if (query) {
      url.searchParams.set('q', query);
    } else {
      url.searchParams.delete('q');
    }
    
    const filters = store.getState().search.filters || {};
    if (filters.genre) url.searchParams.set('genre', filters.genre);
    else url.searchParams.delete('genre');
    
    if (filters.year) url.searchParams.set('year', filters.year);
    else url.searchParams.delete('year');
    
    if (filters.minRating > 0) url.searchParams.set('rating', filters.minRating);
    else url.searchParams.delete('rating');
    
    if (filters.sort && filters.sort !== 'popularity.desc') url.searchParams.set('sort', filters.sort);
    else url.searchParams.delete('sort');

    if (push) {
      history.pushState(null, '', url.toString());
    } else {
      history.replaceState(null, '', url.toString());
    }
  }

  function syncUrlReplace(query) {
    syncUrlParams(query, false);
  }

  // ── Core search execution ─────────────────────────────────────────────

  /**
   * Execute a search request. Called by the debounced wrapper or flush().
   *
   * @param {string} query - Already normalised.
   * @param {number} [page]
   * @param {boolean} [isLoadMore]
   */
  async function executeSearch(query, page = 1, isLoadMore = false) {
    const state = store.getState().search;
    const filters = state.filters || {};

    // If query is empty but filters are active (Browse Mode), we do discover.
    // If query is empty and no filters, it's invalid unless cleared.
    const isBrowseMode = !query && (filters.genre || filters.year || filters.minRating > 0 || filters.sort !== 'popularity.desc');
    
    if (!isBrowseMode && (!query || !isValidQuery(query))) return;

    if (
      !isLoadMore &&
      query.toLowerCase() === (state.committedQuery || '').toLowerCase()
      && (state.status === 'success' || state.status === 'empty')
      && page === 1
      && JSON.stringify(filters) === JSON.stringify(state.lastFilters || {})
    ) {
      diag.emit('duplicate_skipped');
      return;
    }

    if (isLoadMore) {
      dispatch({ type: 'LOAD_MORE_START' });
    } else {
      syncUrlReplace(query);
    }

    const { id, promise } = manager.run(
      'search',
      (signal) => {
        if (isBrowseMode) {
          return movieService.discover({ ...filters, page }, signal);
        } else {
          return movieService.search({ query, page, year: filters.year || null }, signal);
        }
      },
      { query }
    );

    if (!isLoadMore) {
      dispatch({ type: 'SEARCH_START', query, id });
      store.setState({ search: { ...store.getState().search, lastFilters: filters } });
    }

    try {
      const { data } = await promise;

      if (!manager.isCurrent('search', id)) {
        diag.emit('stale_discarded', { id });
        return;
      }

      diag.emit('request_success', { id, ms: 0, count: data.items.length });

      if (isLoadMore) {
        dispatch({ type: 'LOAD_MORE_SUCCESS', query, page, data });
      } else {
        dispatch({ type: 'SEARCH_SUCCESS', query, page, data });
        if (page === 1) {
          syncUrlParams(query, true);
        }
      }

    } catch (err) {
      if (err.name === 'AbortError') return;
      if (!manager.isCurrent('search', id)) return;

      const appErr = toAppError(err);
      diag.emit('request_error', { id, category: appErr.category });
      
      if (isLoadMore) {
        dispatch({ type: 'LOAD_MORE_ERROR' });
        // Optionally show toast for load more error
        window.dispatchEvent(new CustomEvent('cinesift:toast', {
          detail: { message: 'Failed to load more results.', type: 'warn' }
        }));
      } else {
        dispatch({ type: 'SEARCH_ERROR', query, error: appErr });
      }
    }
  }

  // ── Public handlers ───────────────────────────────────────────────────

  function onInput(raw) {
    diag.emit('keystroke');

    const normalised = normalizeQuery(raw);
    store.setState({ search: { ...store.getState().search, rawInput: raw } });
    const filters = store.getState().search.filters || {};
    const isBrowseMode = !normalised && (filters.genre || filters.year || filters.minRating > 0 || filters.sort !== 'popularity.desc');

    if (!isValidQuery(normalised) && !isBrowseMode) {
      debouncedSearch.cancel();
      manager.invalidate('search');
      diag.emit('input_invalid');
      dispatch({ type: normalised.length === 0 ? 'CLEAR_INPUT' : 'INPUT_INVALID', raw });
      syncUrlReplace('');
      return;
    }

    diag.emit('valid_keystroke');
    dispatch({ type: 'INPUT_VALID', raw, query: normalised });
    debouncedSearch(normalised);
  }

  function onSubmit() {
    debouncedSearch.flush();
  }

  function retry() {
    const state = store.getState().search;
    const query = state.query || '';
    const filters = state.filters || {};
    const isBrowseMode = !query && (filters.genre || filters.year || filters.minRating > 0 || filters.sort !== 'popularity.desc');
    
    if (!isBrowseMode && (!query || !isValidQuery(query))) return;
    
    debouncedSearch.cancel();
    executeSearch(query);
  }

  function restoreFromUrl() {
    const params = new URLSearchParams(window.location.search);
    const q = params.get('q') || '';
    
    const urlGenre = params.get('genre') ? parseInt(params.get('genre'), 10) : null;
    const urlYear = params.get('year') ? parseInt(params.get('year'), 10) : null;
    const urlRating = params.get('rating') ? parseFloat(params.get('rating')) : 0;
    const urlSort = params.get('sort') || 'popularity.desc';

    const newFilters = {
      genre: urlGenre,
      year: urlYear,
      minRating: urlRating,
      sort: urlSort
    };
    
    dispatch({ type: 'FILTER_CHANGED', filters: newFilters });
    
    const isBrowseMode = !q && (newFilters.genre || newFilters.year || newFilters.minRating > 0 || newFilters.sort !== 'popularity.desc');
    
    if (!isBrowseMode && (!q || !isValidQuery(normalizeQuery(q)))) return;
    
    const normalised = normalizeQuery(q);
    executeSearch(normalised);
  }

  function unmount() {
    debouncedSearch.cancel();
    manager.invalidate('search');
  }

  function loadMore() {
    const state = store.getState().search;
    if (state.loadingMore || state.page >= state.totalPages) return;
    executeSearch(state.query, state.page + 1, true);
  }

  function applyFilters(newFilters) {
    dispatch({ type: 'FILTER_CHANGED', filters: newFilters });
    const state = store.getState().search;
    const query = state.query || '';
    
    // If there is an active text query, filters are client-side only (API_SPEC §4).
    // We don't trigger a new search request. The UI will filter the displayed results.
    // However, if there is NO text query, we are in Browse Mode and must fetch from /discover.
    // AC-FL-4: Changing a filter aborts in-flight requests, resets page=1, runs immediately.
    // AC-FL-3: Year is sent to the API.
    debouncedSearch.cancel();
    executeSearch(query);
  }

  return { onInput, onSubmit, retry, restoreFromUrl, unmount, loadMore, applyFilters };
}
