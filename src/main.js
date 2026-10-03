/**
 * src/main.js
 * Application entry point.
 *
 * Boots the store, creates the diagnostics instance, builds the UI shell,
 * wires up the search controller, and renders based on state changes.
 *
 * Architecture (ARCHITECTURE.md §1):
 *   UI → controller → debounce → requestManager → movieService → adapter → TMDB
 */

import './styles/tokens.css';
import './styles/base.css';
import './styles/components.css';

import { createStore }        from './state/store.js';
import { createDiagnostics }  from './utils/diagnostics.js';
import { createSearchController } from './controllers/searchController.js';
import { Header }             from './components/Header.js';
import { MovieCard }          from './components/MovieCard.js';
import { SkeletonGrid }       from './components/SkeletonGrid.js';
import { EmptyState }         from './components/EmptyState.js';
import { ErrorState }         from './components/ErrorState.js';
import { DiagnosticsPanel }   from './components/DiagnosticsPanel.js';
import { h, setText, qs }     from './utils/dom.js';
import { normalizeQuery }     from './utils/normalizeQuery.js';

// ── Bootstrap ─────────────────────────────────────────────────────────────────

const store = createStore();
const diag  = createDiagnostics();

// Expose diagnostics on window when debug is on.
if (new URLSearchParams(window.location.search).get('debug') === '1') {
  window.__cinesift = window.__cinesift || {};
  window.__cinesift.diagnostics = diag;
  window.__cinesift.store = store;
}

const controller = createSearchController(store, diag);

// ── Build shell ───────────────────────────────────────────────────────────────

// Header (sticky, contains search input).
const header = Header({
  onInput:  (raw) => controller.onInput(raw),
  onSubmit: ()    => controller.onSubmit(),
  onClear:  ()    => controller.onInput(''), // treat clear as empty input
});

// Live region for screen readers (result announcements).
const liveRegion = h('div', {
  id: 'live',
  role: 'status',
  'aria-live': 'polite',
  'aria-atomic': 'true',
  class: 'sr-only',
});

// Main content area.
const main = document.getElementById('main') || h('main', { id: 'main' });

// Diagnostics panel.
const diagPanel = DiagnosticsPanel(diag);

// Footer with TMDB attribution (required by TMDB terms).
const footer = h('footer', { class: 'site-footer' });
const footerText = h('p', { class: 'container' });
footerText.innerHTML =
  'This product uses the <a href="https://www.themoviedb.org/" rel="noopener noreferrer">TMDB API</a>' +
  ' but is not endorsed or certified by TMDB. &nbsp;|&nbsp; ' +
  '<button class="btn-ghost" id="diag-toggle" style="background:none;border:none;cursor:pointer;color:var(--text-muted);font-size:var(--fs-xs)">Diagnostics</button>';
footer.appendChild(footerText);

// Compose the document body.
document.body.appendChild(header);
document.body.appendChild(main);
document.body.appendChild(liveRegion);
document.body.appendChild(footer);
document.body.appendChild(diagPanel.el);

// Wire up diagnostics toggle button in footer.
const diagToggleBtn = document.getElementById('diag-toggle');
if (diagToggleBtn) diagToggleBtn.addEventListener('click', () => diagPanel.toggle());

// ── Router setup ──────────────────────────────────────────────────────────────

import { createRouter } from './router/router.js';

function setHeaderInput(value) {
  if (header._setQuery) header._setQuery(value);
}

function resetHeaderInput() {
  if (header._setQuery) header._setQuery('');
}

// Intercept header input to navigate to /search if we aren't there.
const originalOnInput = controller.onInput.bind(controller);
controller.onInput = (raw) => {
  if (window.location.pathname !== '/search' && raw.trim().length > 0) {
    router.navigate('/search');
  }
  originalOnInput(raw);
};

// When search succeeds or user presses enter, we save to history (Phase 12).
// We do this by observing state changes.
let lastSearchStatus = null;
import * as historyStore from './state/historyStore.js';
store.subscribe(state => {
  const currentStatus = state.search.status;
  if (currentStatus === 'success' && lastSearchStatus !== 'success' && state.search.committedQuery) {
    historyStore.push(state.search.committedQuery);
  }
  lastSearchStatus = currentStatus;
});

const originalOnSubmit = controller.onSubmit.bind(controller);
controller.onSubmit = () => {
  const query = header.querySelector('input')?.value?.trim();
  if (query) historyStore.push(query);
  if (window.location.pathname !== '/search') {
    router.navigate('/search');
  }
  originalOnSubmit();
};

const router = createRouter({
  main,
  getPageModule: async (pageName) => {
    switch (pageName) {
      case 'home':      return await import('./pages/HomePage.js');
      case 'search':    return { 
        mount: (params, container) => {
          import('./pages/SearchPage.js').then(m => m.mount(params, container, { store, controller, setHeaderInput }));
        },
        unmount: () => {
          import('./pages/SearchPage.js').then(m => m.unmount());
        }
      };
      case 'details':   return await import('./pages/MovieDetailsPage.js');
      case 'watchlist': return await import('./pages/WatchlistPage.js');
      default:          return await import('./pages/NotFoundPage.js');
    }
  }
});

// ── Restore from URL on initial load ─────────────────────────────────────────

const qFromUrl = new URLSearchParams(window.location.search).get('q') || '';
if (qFromUrl) {
  setHeaderInput(qFromUrl);
  controller.restoreFromUrl();
  if (window.location.pathname === '/') {
    router.replace('/search?q=' + encodeURIComponent(qFromUrl));
  }
}

// Live region helper
let lastAnnouncement = '';
store.subscribe(state => {
  const { status, committedQuery, query, totalResults } = state.search;
  let text = '';
  if (status === 'success') {
    text = `${totalResults} result${totalResults !== 1 ? 's' : ''} for "${committedQuery}"`;
  } else if (status === 'empty') {
    text = `No results for "${committedQuery || query}"`;
  } else if (status === 'loading') {
    text = '';
  }
  
  if (text !== undefined && text !== lastAnnouncement) {
    setText(liveRegion, '');
    requestAnimationFrame(() => setText(liveRegion, text));
    lastAnnouncement = text;
  }
});

router.start();

// ── Global error boundary ─────────────────────────────────────────────────────

window.addEventListener('unhandledrejection', (event) => {
  if (event.reason?.name === 'AbortError') {
    event.preventDefault();
    return;
  }
  console.error('[Cinesift] Unhandled rejection:', event.reason?.message || event.reason);
});

// ── Search Keyboard Shortcuts ──────────────────────────────────────────────────

window.addEventListener('keydown', (e) => {
  if (e.key === '/' && document.activeElement.tagName !== 'INPUT') {
    e.preventDefault();
    const searchInput = document.querySelector('.search-input');
    if (searchInput) searchInput.focus();
  }
  if (e.key === 'k' && (e.ctrlKey || e.metaKey)) {
    e.preventDefault();
    const searchInput = document.querySelector('.search-input');
    if (searchInput) searchInput.focus();
  }
});

// ── Toast listener ────────────────────────────────────────────────────────────

import { showToast } from './components/Toast.js';
window.addEventListener('cinesift:toast', (e) => {
  if (e.detail) showToast(e.detail);
});
