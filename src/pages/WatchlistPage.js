/**
 * pages/WatchlistPage.js
 * Displays the user's watchlist from local storage.
 */

import { h, setText } from '../utils/dom.js';
import * as watchlistStore from '../state/watchlistStore.js';
import { MovieCard } from '../components/MovieCard.js';

let unmountRef = null;

export function mount(params, container) {
  document.title = 'Watchlist — Cinesift';
  
  const page = h('div', { class: 'container watchlist-page' });
  const header = h('div', { class: 'results-header' });
  const h1 = h('h1', { tabindex: '-1' });
  setText(h1, 'My Watchlist');
  const count = h('span', { class: 'results-count' });
  header.appendChild(h1);
  header.appendChild(count);
  page.appendChild(header);
  
  const gridContainer = h('div');
  page.appendChild(gridContainer);
  container.appendChild(page);
  
  const renderList = (state) => {
    gridContainer.querySelectorAll('.movie-card').forEach(el => el._cleanup?.());
    gridContainer.innerHTML = '';
    setText(count, `${state.items.length} movie${state.items.length !== 1 ? 's' : ''}`);
    
    if (state.items.length === 0) {
      const empty = h('div', { class: 'empty-state' });
      const p = h('p');
      setText(p, 'Your watchlist is empty. Add movies to keep track of what you want to watch.');
      empty.appendChild(p);
      gridContainer.appendChild(empty);
      return;
    }
    
    const grid = h('div', { class: 'movie-grid' });
    state.items.forEach((movie, idx) => {
      grid.appendChild(MovieCard(movie, idx < 4));
    });
    gridContainer.appendChild(grid);
  };
  
  // Initial render and subscribe
  const unsub = watchlistStore.subscribe(renderList);
  
  unmountRef = () => {
    unsub();
    gridContainer.querySelectorAll('.movie-card').forEach(el => el._cleanup?.());
  };
}

export function unmount() {
  if (unmountRef) unmountRef();
  unmountRef = null;
  document.title = 'Cinesift';
}
