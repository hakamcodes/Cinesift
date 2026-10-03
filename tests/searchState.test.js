import { describe, it, expect, beforeEach } from 'vitest';
import { createStore } from '../src/state/searchState.js';

describe('searchState reducer', () => {
  let store;
  
  beforeEach(() => {
    store = createStore();
  });

  it('initializes with idle state', () => {
    const state = store.getState().search;
    expect(state.status).toBe('idle');
    expect(state.query).toBe('');
  });

  it('handles START_DEBOUNCE', () => {
    store.dispatch({ type: 'START_DEBOUNCE', payload: { query: 'batman' } });
    const state = store.getState().search;
    expect(state.status).toBe('debouncing');
    expect(state.query).toBe('batman');
  });

  it('handles SEARCH_START', () => {
    store.dispatch({ type: 'SEARCH_START', payload: { query: 'bat' } });
    const state = store.getState().search;
    expect(state.status).toBe('loading');
    expect(state.committedQuery).toBe('bat');
  });

  it('handles SEARCH_SUCCESS', () => {
    const results = [{ id: 1, title: 'Batman' }];
    store.dispatch({ type: 'SEARCH_SUCCESS', payload: { results, page: 1, totalPages: 1, totalResults: 1 } });
    const state = store.getState().search;
    expect(state.status).toBe('success');
    expect(state.results).toEqual(results);
  });

  it('handles SEARCH_EMPTY', () => {
    store.dispatch({ type: 'SEARCH_EMPTY' });
    const state = store.getState().search;
    expect(state.status).toBe('empty');
  });

  it('handles SEARCH_ERROR', () => {
    store.dispatch({ type: 'SEARCH_ERROR', payload: { error: { message: 'Failed' } } });
    const state = store.getState().search;
    expect(state.status).toBe('error');
    expect(state.error.message).toBe('Failed');
  });

  it('handles LOAD_MORE', () => {
    // Setup initial success
    store.dispatch({ type: 'SEARCH_SUCCESS', payload: { results: [{ id: 1 }], page: 1, totalPages: 2 } });
    
    // Load more loading
    store.dispatch({ type: 'LOAD_MORE_START' });
    expect(store.getState().search.loadingMore).toBe(true);

    // Load more success (deduplication check)
    store.dispatch({ 
      type: 'LOAD_MORE_SUCCESS', 
      payload: { results: [{ id: 1 }, { id: 2 }], page: 2 } 
    });
    
    const state = store.getState().search;
    expect(state.loadingMore).toBe(false);
    expect(state.results.length).toBe(2); // Should deduplicate ID 1
    expect(state.page).toBe(2);
  });

  it('handles CLEAR_SEARCH', () => {
    store.dispatch({ type: 'SEARCH_START', payload: { query: 'bat' } });
    store.dispatch({ type: 'CLEAR_SEARCH' });
    const state = store.getState().search;
    expect(state.status).toBe('idle');
    expect(state.query).toBe('');
    expect(state.committedQuery).toBe('');
  });
});
