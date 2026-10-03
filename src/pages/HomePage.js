/**
 * pages/HomePage.js
 * The default landing page (Phase 13).
 * Shows a hero section and a trending movies grid.
 */

import { h, setText } from '../utils/dom.js';
import * as movieService from '../services/movieService.js';
import { MovieCard } from '../components/MovieCard.js';
import { SkeletonGrid } from '../components/SkeletonGrid.js';

let unmountRef = null;

export function mount(params, container) {
  document.title = 'Cinesift';

  // AbortController for home lane
  const ctrl = new AbortController();
  let active = true;

  unmountRef = () => {
    active = false;
    ctrl.abort(new DOMException('unmounted', 'AbortError'));
  };

  const home = h('div', { class: 'home-page' });
  
  // Hero section
  const hero = h('section', { class: 'home-hero' });
  const h1 = h('h1', { tabindex: '-1' });
  setText(h1, 'Find any movie, instantly.');
  hero.appendChild(h1);
  const p = h('p');
  setText(p, 'Search millions of movies, build your watchlist, and discover new favourites.');
  hero.appendChild(p);
  home.appendChild(hero);
  
  // Trending Section
  const trendingSec = h('section', { class: 'home-trending container' });
  const h2 = h('h2');
  setText(h2, 'Trending This Week');
  trendingSec.appendChild(h2);
  
  const gridContainer = h('div');
  gridContainer.appendChild(SkeletonGrid());
  trendingSec.appendChild(gridContainer);
  
  home.appendChild(trendingSec);
  container.appendChild(home);

  movieService.trending({ window: 'week' }, ctrl.signal)
    .then(data => {
      if (!active) return;
      gridContainer.querySelectorAll('.movie-card').forEach(el => el._cleanup?.());
      gridContainer.innerHTML = '';
      if (!data.items || data.items.length === 0) {
        const p = h('p');
        setText(p, 'No trending movies found.');
        gridContainer.appendChild(p);
        return;
      }
      
      const grid = h('div', { class: 'movie-grid' });
      data.items.slice(0, 12).forEach((movie, idx) => {
        grid.appendChild(MovieCard(movie, idx < 4));
      });
      gridContainer.appendChild(grid);
    })
    .catch(err => {
      if (!active || err.name === 'AbortError') return;
      gridContainer.querySelectorAll('.movie-card').forEach(el => el._cleanup?.());
      gridContainer.innerHTML = '';
      const p = h('p');
      setText(p, 'Failed to load trending movies.');
      gridContainer.appendChild(p);
    });
}

export function unmount() {
  if (unmountRef) unmountRef();
  unmountRef = null;
  document.querySelectorAll('.home-page .movie-card').forEach(el => el._cleanup?.());
}
