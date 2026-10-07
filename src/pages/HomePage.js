/**
 * pages/HomePage.js
 * The default landing page.
 * Shows a hero section with the top trending movie backdrop, large search input,
 * recent searches, trending movies grid, and genre chips.
 */

import { h, setText } from '../utils/dom.js';
import * as movieService from '../services/movieService.js';
import { MovieCard } from '../components/MovieCard.js';
import { SkeletonGrid } from '../components/SkeletonGrid.js';
import { ErrorState } from '../components/ErrorState.js';
import * as historyStore from '../state/historyStore.js';
import { imageUrl } from '../utils/format.js';

let unmountRef = null;

export function mount(params, container) {
  document.title = 'Cinesift';
  document.body.classList.add('is-home');

  const ctrl = new AbortController();
  let active = true;
  let unsubHistory = null;

  unmountRef = () => {
    active = false;
    ctrl.abort(new DOMException('unmounted', 'AbortError'));
    if (unsubHistory) unsubHistory();
    document.body.classList.remove('is-home');
    document.querySelectorAll('.home-page .movie-card').forEach(el => el._cleanup?.());
  };

  const home = h('div', { class: 'home-page' });
  
  // ── Hero Section ──
  const hero = h('section', { class: 'home-hero' });
  
  const heroBackdrop = h('div', { class: 'home-hero-backdrop' });
  hero.appendChild(heroBackdrop);
  
  const heroContent = h('div', { class: 'home-hero-content container' });
  
  const h1 = h('h1', { tabindex: '-1' });
  setText(h1, 'Find any movie, instantly.');
  heroContent.appendChild(h1);
  
  const p = h('p', { class: 'home-hero-subtext' });
  setText(p, 'Search millions of movies, build your watchlist, and discover new favourites.');
  heroContent.appendChild(p);

  // Large Hero Search Input
  const searchForm = h('div', { class: 'hero-search-wrapper' });
  const searchIcon = h('span', { class: 'hero-search-icon', 'aria-hidden': 'true' });
  setText(searchIcon, '🔍');
  const searchInput = h('input', {
    class: 'hero-search-input',
    type: 'search',
    placeholder: 'Search movies...',
    'aria-label': 'Search movies'
  });
  const searchHint = h('span', { class: 'hero-search-hint', 'aria-hidden': 'true' });
  setText(searchHint, '⌘K');

  // Wire hero search to global header search
  searchInput.addEventListener('input', (e) => {
    const globalInput = document.querySelector('.site-header .search-input');
    if (globalInput) {
      globalInput.value = e.target.value;
      globalInput.dispatchEvent(new Event('input', { bubbles: true }));
    }
  });
  searchInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const globalInput = document.querySelector('.site-header .search-input');
      if (globalInput) {
        globalInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
      }
    }
  });

  searchForm.appendChild(searchIcon);
  searchForm.appendChild(searchInput);
  searchForm.appendChild(searchHint);
  heroContent.appendChild(searchForm);

  // Recent searches
  const recentSearchesContainer = h('div', { class: 'recent-searches' });
  heroContent.appendChild(recentSearchesContainer);

  unsubHistory = historyStore.subscribe(state => {
    recentSearchesContainer.innerHTML = '';
    if (state.items && state.items.length > 0) {
      state.items.forEach(item => {
        const chip = h('button', { class: 'recent-chip' });
        
        const qText = h('span');
        setText(qText, item.q);
        
        const xBtn = h('span', { class: 'recent-chip-x', 'aria-label': `Remove ${item.q} from history` });
        setText(xBtn, '✕');
        xBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          historyStore.removeOne(item.q);
        });

        chip.appendChild(qText);
        chip.appendChild(xBtn);

        chip.addEventListener('click', () => {
          const globalInput = document.querySelector('.site-header .search-input');
          if (globalInput) {
            globalInput.value = item.q;
            globalInput.dispatchEvent(new Event('input', { bubbles: true }));
            globalInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
          }
        });
        
        recentSearchesContainer.appendChild(chip);
      });
      
      const clearAll = h('button', { class: 'recent-clear-all' });
      setText(clearAll, 'Clear all');
      clearAll.addEventListener('click', () => historyStore.clear());
      recentSearchesContainer.appendChild(clearAll);
    }
  });

  // Featured Movie Area
  const featuredArea = h('div', { class: 'featured-movie-area' });
  heroContent.appendChild(featuredArea);

  hero.appendChild(heroContent);
  home.appendChild(hero);

  // ── Genres Section ──
  const genresSec = h('section', { class: 'home-genres container' });
  const genresRow = h('div', { class: 'genres-row' });
  genresSec.appendChild(genresRow);
  home.appendChild(genresSec);

  movieService.genres(ctrl.signal).then(genresMap => {
    if (!active) return;
    genresMap.forEach((name, id) => {
      const chip = h('a', { class: 'genre-browse-chip', href: `/search?genre=${id}`, 'data-link': '' });
      setText(chip, name);
      genresRow.appendChild(chip);
    });
  }).catch(() => {}); // Ignore genre failure

  // ── Trending Section ──
  const trendingSec = h('section', { class: 'home-trending container' });
  const h2 = h('h2');
  setText(h2, 'Trending this week');
  trendingSec.appendChild(h2);
  
  const gridContainer = h('div');
  gridContainer.appendChild(SkeletonGrid());
  trendingSec.appendChild(gridContainer);
  
  home.appendChild(trendingSec);

  // ── Popular Section (if supported) ──
  // Per TMDB API spec, `discover` supports `sort=popularity.desc`.
  const popularSec = h('section', { class: 'home-trending container' });
  const h2Pop = h('h2');
  setText(h2Pop, 'Popular');
  popularSec.appendChild(h2Pop);
  const popGridContainer = h('div');
  popGridContainer.appendChild(SkeletonGrid());
  popularSec.appendChild(popGridContainer);
  home.appendChild(popularSec);

  container.appendChild(home);



  function loadTrending() {
    gridContainer.innerHTML = '';
    gridContainer.appendChild(SkeletonGrid());
    
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
        
        // Setup Featured Movie (Hero backdrop)
        const featured = data.items[0];
        if (featured) {
          // Since trending only returns MovieSummary, we might not have backdropPath in summary if adapter stripped it. 
          // Wait, tmdbAdapter.js normaliseMovieSummary doesn't include backdropPath! 
          // Let me check adapter code... yes it doesn't. 
          // I'll just use posterPath as a fallback for backdrop if it looks okay, 
          // but I will fetch details for the featured movie to get the high-res backdrop if possible.
          movieService.details(featured.id, ctrl.signal).then(det => {
            if (!active) return;
            if (det.backdropPath) {
              const bgSrc = imageUrl(det.backdropPath, 'w1280');
              const img = h('img', { src: bgSrc, alt: '', class: 'hero-backdrop-img' });
              heroBackdrop.appendChild(img);
            }
          }).catch(() => {});

          const featTitle = h('span', { class: 'featured-title' });
          setText(featTitle, featured.title);
          const featBtn = h('a', { class: 'btn btn-secondary featured-btn', href: `/movie/${featured.id}`, 'data-link': '' });
          setText(featBtn, 'View details');
          featuredArea.appendChild(featTitle);
          featuredArea.appendChild(featBtn);
        }

        const grid = h('div', { class: 'movie-grid' });
        data.items.slice(0, 12).forEach((movie, idx) => {
          grid.appendChild(MovieCard(movie, { eager: idx < 4 }));
        });
        gridContainer.appendChild(grid);
      })
      .catch(err => {
        if (!active || err.name === 'AbortError') return;
        gridContainer.querySelectorAll('.movie-card').forEach(el => el._cleanup?.());
        gridContainer.innerHTML = '';
        gridContainer.appendChild(ErrorState({
          error: { category: err.category || 'server', userMessage: 'Failed to load trending movies.', retryable: true },
          onRetry: loadTrending
        }));
      });
  }

  function loadPopular() {
    popGridContainer.innerHTML = '';
    popGridContainer.appendChild(SkeletonGrid());
    
    movieService.discover({ sort: 'popularity.desc' }, ctrl.signal)
      .then(data => {
        if (!active) return;
        popGridContainer.querySelectorAll('.movie-card').forEach(el => el._cleanup?.());
        popGridContainer.innerHTML = '';
        if (!data.items || data.items.length === 0) {
          popularSec.style.display = 'none';
          return;
        }
        
        const grid = h('div', { class: 'movie-grid' });
        data.items.slice(0, 12).forEach((movie, idx) => {
          grid.appendChild(MovieCard(movie, { eager: idx < 4 }));
        });
        popGridContainer.appendChild(grid);
      })
      .catch(err => {
        if (!active || err.name === 'AbortError') return;
        popGridContainer.innerHTML = '';
        popGridContainer.appendChild(ErrorState({
          error: { category: err.category || 'server', userMessage: 'Failed to load popular movies.', retryable: true },
          onRetry: loadPopular
        }));
      });
  }

  loadTrending();
  loadPopular();
}

export function unmount() {
  if (unmountRef) unmountRef();
  unmountRef = null;
}
