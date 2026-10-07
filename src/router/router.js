/**
 * router/router.js
 * Client-side router using the History API.
 *
 * Routes:
 *   /              → HomePage
 *   /search        → SearchPage
 *   /movie/:id     → MovieDetailsPage
 *   /watchlist     → WatchlistPage
 *   *              → NotFoundPage
 *
 * Lifecycle:
 *   Each page exposes mount(params) and unmount().
 *   unmount() MUST cancel debounce and invalidate lanes (ARCHITECTURE.md §6).
 *
 * Link interception:
 *   Clicks on <a data-link> are intercepted for SPA navigation.
 *   Modifier keys (Ctrl/Cmd/middle-click) open new tabs normally.
 *
 * Title + focus:
 *   document.title updated on every route change.
 *   Focus moved to <h1 tabindex="-1"> on mount (ARCHITECTURE.md §6 / UI_UX_SPEC §9).
 */

/** @type {Array<{pattern: RegExp, page: string, keys: string[]}>} */
const ROUTES = [
  { pattern: /^\/$/, page: 'home', keys: [] },
  { pattern: /^\/search$/, page: 'search', keys: [] },
  { pattern: /^\/movie\/([^/]+)$/, page: 'details', keys: ['id'] },
  { pattern: /^\/watchlist$/, page: 'watchlist', keys: [] },
];

/** @type {{ unmount?: Function } | null} */
let currentPage = null;


/**
 * Create and start the router.
 *
 * @param {{ main: HTMLElement, getPageModule: Function }} opts
 *   - main: the #main DOM element to render into
 *   - getPageModule: async fn(pageName) → page module with { mount, unmount }
 * @returns {{ navigate: Function, replace: Function, start: Function }}
 */
export function createRouter({ main, getPageModule }) {
  /**
   * Resolve a path string to a route match.
   * @param {string} path
   * @returns {{ page: string, params: object } | null}
   */
  function resolve(path) {
    for (const route of ROUTES) {
      const m = path.match(route.pattern);
      if (m) {
        const params = {};
        route.keys.forEach((k, i) => { params[k] = m[i + 1]; });
        return { page: route.page, params };
      }
    }
    return { page: 'notfound', params: {} };
  }

  /**
   * Unmount the current page (cancels debounce, invalidates lanes).
   */
  function doUnmount() {
    if (currentPage && typeof currentPage.unmount === 'function') {
      currentPage.unmount();
    }
    currentPage = null;
  }

  /**
   * Mount a page into #main.
   * @param {string} pageName
   * @param {object} params
   */
  async function doMount(pageName, params) {
    doUnmount();

    let mod;
    try {
      mod = await getPageModule(pageName);
    } catch (e) {
      console.error('[router] failed to load page module', pageName, e);
      mod = await getPageModule('notfound');
    }

    // Clear main and mount.
    main.innerHTML = '';
    currentPage = mod;
    if (typeof mod.mount === 'function') {
      mod.mount(params, main);
    }

    // Focus the h1 for screen readers (UI_UX_SPEC §9).
    requestAnimationFrame(() => {
      if (history.state && history.state.focusSearch) {
        const globalInput = document.querySelector('.site-header .search-input');
        if (globalInput) {
          globalInput.focus({ preventScroll: true });
          const len = globalInput.value.length;
          globalInput.setSelectionRange(len, len);
          
          const newState = { ...history.state };
          delete newState.focusSearch;
          history.replaceState(newState, '');
        }
      } else {
        const h1 = main.querySelector('h1[tabindex="-1"]') || main.querySelector('h1');
        if (h1) {
          if (!h1.getAttribute('tabindex')) h1.setAttribute('tabindex', '-1');
          h1.focus({ preventScroll: false });
        }
        window.scrollTo(0, 0);
      }
    });
  }

  /**
   * Navigate to a new path (pushState).
   * @param {string} path
   * @param {object} [state]
   */
  function navigate(path, state = {}) {
    if (path === window.location.pathname + window.location.search) return;
    history.pushState(state, '', path);
    const { page, params } = resolve(new URL(path, window.location.origin).pathname);
    doMount(page, { ...params, search: new URL(path, window.location.origin).searchParams });
  }

  /**
   * Replace current history entry (no back-nav).
   * @param {string} path
   */
  function replace(path) {
    history.replaceState({}, '', path);
  }

  /**
   * Start the router: intercept clicks, handle popstate, resolve initial route.
   */
  function start() {
    // Handle browser back/forward.
    window.addEventListener('popstate', (e) => {
      const { page, params } = resolve(window.location.pathname);
      doMount(page, { ...params, search: new URLSearchParams(window.location.search) }).then(() => {
        if (e.state && typeof e.state.scrollY === 'number') {
          requestAnimationFrame(() => window.scrollTo(0, e.state.scrollY));
        }
      });
    });

    // Save scroll position before navigating away
    window.addEventListener('scroll', () => {
      if (history.state) {
        history.replaceState({ ...history.state, scrollY: window.scrollY }, '');
      } else {
        history.replaceState({ scrollY: window.scrollY }, '');
      }
    }, { passive: true });

    // Intercept <a data-link> clicks for SPA navigation.
    document.addEventListener('click', (e) => {
      // Ignore modifier keys (open in new tab).
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;

      const anchor = e.target.closest('a[data-link]');
      if (!anchor) return;

      const href = anchor.getAttribute('href');
      if (!href || href.startsWith('http') || href.startsWith('//')) return;

      e.preventDefault();
      navigate(href);
    });

    // Mount initial route.
    const { page, params } = resolve(window.location.pathname);
    doMount(page, { ...params, search: new URLSearchParams(window.location.search) });
  }

  return { navigate, replace, start };
}
