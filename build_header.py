import os
content = '''/**
 * components/Header.js
 * Sticky site header with logo and search bar.
 */

import { h, setText, qs } from '../utils/dom.js';
import { imageUrl, formatYear } from '../utils/format.js';

export function Header({ onInput, onSubmit, onClear, store }) {
  const header = h('header', { class: 'site-header', role: 'banner' });

  const skipLink = h('a', { href: '#main', class: 'skip-link' });
  setText(skipLink, 'Skip to content');

  const container = h('div', { class: 'container header-container' });

  // Logo / brand name.
  const logo = h('a', { href: '/', class: 'site-logo', 'data-link': '', 'aria-label': 'Cinesift home' });
  setText(logo, 'Cinesift');

  const searchBar = h('div', { class: 'search-bar', role: 'search', style: { position: 'relative' } });

  const label = h('label', { for: 'search', class: 'sr-only' });
  setText(label, 'Search movies');

  const input = h('input', {
    id: 'search',
    type: 'search',
    maxlength: '100',
    autocomplete: 'off',
    enterkeyhint: 'search',
    placeholder: 'Search movies…',
    'aria-label': 'Search movies',
    'aria-autocomplete': 'list',
    role: 'combobox',
    'aria-expanded': 'false',
    'aria-controls': 'search-suggestions',
    class: 'search-input'
  });

  const clearBtn = h('button', {
    class: 'search-clear',
    type: 'button',
    'aria-label': 'Clear search',
  });
  setText(clearBtn, '×');

  const hint = h('p', { class: 'search-hint', 'aria-live': 'polite' });

  const suggestionsBox = h('ul', {
    id: 'search-suggestions',
    role: 'listbox',
    class: 'suggestions-list',
  });
  suggestionsBox.style.display = 'none';

  let isComposing = false;
  let activeIndex = -1;
  let suggestions = [];

  input.addEventListener('compositionstart', () => { isComposing = true; });
  input.addEventListener('compositionend', () => {
    isComposing = false;
    handleInput();
  });

  input.addEventListener('input', () => {
    if (!isComposing) handleInput();
  });

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !isComposing) {
      e.preventDefault();
      if (activeIndex >= 0 && suggestions[activeIndex]) {
        // Navigate to suggestion
        const anchor = suggestionsBox.children[activeIndex].querySelector('a');
        if (anchor) anchor.click();
        closeSuggestions();
      } else {
        onSubmit();
        closeSuggestions();
      }
    } else if (e.key === 'Escape') {
      if (suggestionsBox.style.display !== 'none') {
        e.preventDefault();
        closeSuggestions();
      } else if (input.value.length > 0) {
        clearInput();
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (suggestions.length > 0) {
        if (suggestionsBox.style.display === 'none') openSuggestions();
        activeIndex = (activeIndex + 1) % suggestions.length;
        updateActiveDescendant();
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (suggestions.length > 0) {
        if (suggestionsBox.style.display === 'none') openSuggestions();
        activeIndex = (activeIndex - 1 + suggestions.length) % suggestions.length;
        updateActiveDescendant();
      }
    }
  });

  input.addEventListener('focus', () => {
    if (suggestions.length > 0) {
      openSuggestions();
    }
  });

  input.addEventListener('blur', () => {
    setTimeout(closeSuggestions, 150);
  });

  clearBtn.addEventListener('click', clearInput);

  function handleInput() {
    const raw = input.value;
    clearBtn.classList.toggle('visible', raw.length > 0);
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
    closeSuggestions();
  }

  function openSuggestions() {
    if (suggestions.length === 0) return;
    suggestionsBox.style.display = 'block';
    input.setAttribute('aria-expanded', 'true');
  }

  function closeSuggestions() {
    suggestionsBox.style.display = 'none';
    input.setAttribute('aria-expanded', 'false');
    activeIndex = -1;
    input.removeAttribute('aria-activedescendant');
    for (let i = 0; i < suggestionsBox.children.length; i++) {
      suggestionsBox.children[i].setAttribute('aria-selected', 'false');
    }
  }

  function updateActiveDescendant() {
    for (let i = 0; i < suggestionsBox.children.length; i++) {
      const li = suggestionsBox.children[i];
      if (i === activeIndex) {
        li.setAttribute('aria-selected', 'true');
        input.setAttribute('aria-activedescendant', li.id);
      } else {
        li.setAttribute('aria-selected', 'false');
      }
    }
  }

  function renderSuggestions(items) {
    suggestionsBox.innerHTML = '';
    suggestions = items.slice(0, 5);
    if (suggestions.length === 0) {
      closeSuggestions();
      return;
    }
    
    suggestions.forEach((item, idx) => {
      const li = h('li', {
        id: 'sugg-' + item.id,
        role: 'option',
        'aria-selected': 'false',
        class: 'suggestion-option'
      });
      
      const link = h('a', { href: '/movie/' + item.id, 'data-link': '', style: { display: 'contents', color: 'inherit', textDecoration: 'none' } });
      
      if (item.posterPath) {
        const img = h('img', { src: imageUrl(item.posterPath, 'w92'), class: 'suggestion-poster', alt: '' });
        link.appendChild(img);
      } else {
        const ph = h('div', { class: 'suggestion-poster' });
        link.appendChild(ph);
      }
      
      const titleEl = h('span', { class: 'suggestion-title' });
      setText(titleEl, item.title);
      link.appendChild(titleEl);
      
      const yearEl = h('span', { class: 'suggestion-year' });
      setText(yearEl, formatYear(item.releaseDate || item.year));
      link.appendChild(yearEl);
      
      li.appendChild(link);
      
      li.addEventListener('mousedown', (e) => {
        // Prevent blur
        e.preventDefault();
      });
      li.addEventListener('click', () => {
        link.click();
        closeSuggestions();
      });
      
      suggestionsBox.appendChild(li);
    });
    
    if (document.activeElement === input) {
      openSuggestions();
    }
  }

  if (store) {
    store.subscribe(state => {
      const s = state.search;
      if (s.status === 'success' && s.results && s.results.length > 0) {
        renderSuggestions(s.results);
      } else if (s.status === 'empty' || s.status === 'error' || s.query.length === 0) {
        renderSuggestions([]);
      }
    });
  }

  header._setQuery = (q) => {
    input.value = q;
    clearBtn.classList.toggle('visible', q.length > 0);
  };

  searchBar.appendChild(label);
  searchBar.appendChild(input);
  searchBar.appendChild(clearBtn);
  searchBar.appendChild(hint);
  searchBar.appendChild(suggestionsBox);

  const watchlistLink = h('a', { 
    href: '/watchlist', 
    class: 'header-watchlist-link',
    'data-link': '',
    'aria-label': 'Watchlist'
  });
  
  const wlText = h('span');
  setText(wlText, 'Watchlist');
  watchlistLink.appendChild(wlText);
  
  const badge = h('span', { class: 'watchlist-badge', 'aria-hidden': 'true' });
  watchlistLink.appendChild(badge);

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
'''
with open('src/components/Header.js', 'w', encoding='utf-8') as f:
    f.write(content)
print("Header rewritten")
