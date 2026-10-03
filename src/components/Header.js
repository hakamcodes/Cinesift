/**
 * components/Header.js
 * Sticky site header with logo and search bar.
 *
 * The search input is the one true input for the whole app.
 * All input events are forwarded to the searchController via onInput/onSubmit callbacks.
 *
 * Spec (UI_UX_SPEC §3, §9, AC-QV):
 *   - type="search", maxlength=100, autocomplete="off", enterkeyhint="search".
 *   - Enter → flush debounce (onSubmit).
 *   - ESC → clear input when 1+ chars typed.
 *   - Clear ✕ button — visible when input has value.
 *   - compositionstart/compositionend: ignore input during IME.
 */

import { h, setText, qs } from '../utils/dom.js';

/**
 * Create the site header.
 *
 * @param {{ onInput: Function, onSubmit: Function, onClear: Function }} handlers
 * @returns {HTMLElement}
 */
export function Header({ onInput, onSubmit, onClear }) {
  const header = h('header', { class: 'site-header', role: 'banner' });

  // Skip link — first in DOM for keyboard users.
  const skipLink = h('a', { href: '#main', class: 'skip-link' });
  setText(skipLink, 'Skip to content');

  const container = h('div', { class: 'container' });

  // Logo / brand name.
  const logo = h('a', { href: '/', class: 'site-logo', 'data-link': '', 'aria-label': 'Cinesift home' });
  setText(logo, 'Cinesift');

  // ── Search bar ───────────────────────────────────────────────────────

  const searchBar = h('div', { class: 'search-bar', role: 'search' });

  // Visible label text (positioned off-screen — using sr-only).
  const label = h('label', { for: 'search', class: 'sr-only' });
  setText(label, 'Search movies');

  // The input element.
  const input = h('input', {
    id: 'search',
    type: 'search',
    maxlength: '100',
    autocomplete: 'off',
    enterkeyhint: 'search',
    placeholder: 'Search movies…',
    'aria-label': 'Search movies',
    'aria-autocomplete': 'none',
  });

  // Clear button.
  const clearBtn = h('button', {
    class: 'search-clear',
    type: 'button',
    'aria-label': 'Clear search',
  });
  setText(clearBtn, '✕');

  // One-char hint shown below the input.
  const hint = h('p', { class: 'search-hint', 'aria-live': 'polite' });

  // ── Input event handling ──────────────────────────────────────────────

  let isComposing = false;

  input.addEventListener('compositionstart', () => { isComposing = true; });
  input.addEventListener('compositionend', () => {
    isComposing = false;
    handleInput(); // Fire after IME commits.
  });

  input.addEventListener('input', () => {
    if (!isComposing) handleInput();
  });

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !isComposing) {
      e.preventDefault();
      onSubmit();
    }
    if (e.key === 'Escape') {
      if (input.value.length > 0) {
        clearInput();
      }
    }
  });

  clearBtn.addEventListener('click', clearInput);

  function handleInput() {
    const raw = input.value;
    // Show/hide the ✕ button.
    clearBtn.classList.toggle('visible', raw.length > 0);
    // Show 1-char hint.
    const norm = raw.trim();
    if (norm.length === 1) {
      setText(hint, 'Type at least 2 characters to search.');
    } else {
      setText(hint, '');
    }
    onInput(raw);
  }

  function clearInput() {
    input.value = '';
    clearBtn.classList.remove('visible');
    setText(hint, '');
    input.focus();
    onClear();
  }

  /**
   * Update the input value from outside (e.g. when restoring URL ?q=).
   * Exported so main.js can call it on initial load.
   */
  header._setQuery = (q) => {
    input.value = q;
    clearBtn.classList.toggle('visible', q.length > 0);
  };

  searchBar.appendChild(label);
  searchBar.appendChild(input);
  searchBar.appendChild(clearBtn);
  searchBar.appendChild(hint);

  const watchlistLink = h('a', { 
    href: '/watchlist', 
    class: 'header-watchlist-link',
    'data-link': '',
    'aria-label': 'Watchlist'
  });
  setText(watchlistLink, 'Watchlist');
  const badge = h('span', { class: 'watchlist-badge', 'aria-hidden': 'true' });
  watchlistLink.appendChild(badge);

  // Use dynamic import so Header.js doesn't fail if store isn't there yet in some tests
  import('../state/watchlistStore.js').then(store => {
    store.subscribe(state => {
      if (state.items.length > 0) {
        setText(badge, state.items.length.toString());
        badge.style.display = 'inline-block';
      } else {
        badge.style.display = 'none';
      }
    });
  });
  
  container.appendChild(logo);
  container.appendChild(searchBar);
  container.appendChild(watchlistLink);
  header.appendChild(skipLink);
  header.appendChild(container);

  return header;
}
