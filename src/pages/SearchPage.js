/**
 * pages/SearchPage.js
 * The search results page.
 * Renders state from the global searchStore.
 */

import { h, setText } from '../utils/dom.js';
import { MovieCard } from '../components/MovieCard.js';
import { SkeletonGrid } from '../components/SkeletonGrid.js';
import { EmptyState } from '../components/EmptyState.js';
import { ErrorState } from '../components/ErrorState.js';
import { RecentSearches } from '../components/RecentSearches.js';
import { FilterBar } from '../components/FilterBar.js';
import { LoadMoreButton } from '../components/LoadMoreButton.js';
import * as movieService from '../services/movieService.js';

let unmountRef = null;
let cachedGenres = new Map();

export function mount(params, container, { store, controller, setHeaderInput }) {
  document.title = 'Search — Cinesift';
  
  const page = h('div', { class: 'search-page' });
  container.appendChild(page);
  
  // Fetch genres map once for the filter bar
  movieService.genres().then(map => {
    cachedGenres = map;
    render(store.getState()); // re-render once we have genres
  });

  const render = (state) => {
    const { status, results, query, committedQuery, error, filters = {}, loadingMore, page: currentPage, totalPages, totalResults } = state.search;
    
    // Clean up existing cards to prevent listener leaks
    page.querySelectorAll('.movie-card').forEach(el => el._cleanup?.());
    page.innerHTML = '';
    
    if (committedQuery) {
      document.title = `${committedQuery} - Search — Cinesift`;
    } else {
      document.title = 'Search — Cinesift';
    }

    const wrapper = h('div', { class: 'container' });

    // Client-side filtering logic
    const isClientSide = !!committedQuery || !!query;
    let displayedResults = results || [];
    
    if (isClientSide && results && results.length > 0) {
      displayedResults = results.filter(m => {
        if (filters.genre && !m.genreIds?.includes(filters.genre)) return false;
        if (filters.year && m.year !== filters.year) return false;
        if (filters.minRating && (m.rating || 0) < filters.minRating) return false;
        return true;
      });

      // Sort client-side
      if (filters.sort) {
        displayedResults.sort((a, b) => {
          switch (filters.sort) {
            case 'popularity.desc': return (b.popularity || 0) - (a.popularity || 0); // We don't have popularity in basic model, fallback to fallback
            case 'vote_average.desc': return (b.rating || 0) - (a.rating || 0);
            case 'primary_release_date.desc': return (new Date(b.releaseDate || 0) - new Date(a.releaseDate || 0));
            case 'original_title.asc': return (a.title || '').localeCompare(b.title || '');
            default: return 0;
          }
        });
      }
    }

    const showFilterBar = status === 'success' || (status === 'empty' && (filters.genre || filters.year || filters.minRating > 0 || filters.sort !== 'popularity.desc'));

    if (showFilterBar && cachedGenres.size > 0) {
      wrapper.appendChild(FilterBar({
        filters,
        onFilterChange: controller.applyFilters,
        isClientSide,
        genresMap: cachedGenres
      }));
    }

    switch (status) {
      case 'idle':
        renderIdle(wrapper, controller, setHeaderInput);
        break;
      case 'debouncing':
        if (displayedResults.length > 0) {
          renderResultsGrid(wrapper, displayedResults, committedQuery, totalResults);
        } else {
          renderIdle(wrapper, controller, setHeaderInput);
        }
        break;
      case 'loading':
        wrapper.appendChild(SkeletonGrid());
        break;
      case 'success':
        if (displayedResults.length === 0 && isClientSide) {
          // Client-side filtered to empty
          const filteredEmpty = h('div', { class: 'empty-state' });
          const feIcon = h('div', { class: 'empty-state-icon', 'aria-hidden': 'true' });
          setText(feIcon, '🕵️‍♂️');
          const feH1 = h('h1');
          setText(feH1, 'No movies match these filters');
          filteredEmpty.appendChild(feIcon);
          filteredEmpty.appendChild(feH1);
          wrapper.appendChild(filteredEmpty);
        } else {
          renderResultsGrid(wrapper, displayedResults, committedQuery, totalResults);
          
          if (currentPage < totalPages) {
            wrapper.appendChild(LoadMoreButton({
              onClick: controller.loadMore,
              loading: loadingMore
            }));
          }
        }
        break;
      case 'empty':
        wrapper.appendChild(EmptyState({
          query: committedQuery || query,
          onClear: () => { controller.onInput(''); setHeaderInput(''); },
          onSuggestion: (title) => { setHeaderInput(title); controller.onInput(title); },
        }));
        wrapper.appendChild(RecentSearches({
          onSelect: (q) => { setHeaderInput(q); controller.onInput(q); controller.onSubmit(); }
        }));
        break;
      case 'error':
        wrapper.appendChild(ErrorState({
          error,
          onRetry: () => controller.retry(),
        }));
        break;
      default:
        renderIdle(wrapper, controller, setHeaderInput);
    }
    
    page.appendChild(wrapper);
  };
  
  const unsub = store.subscribe(render);
  
  unmountRef = () => {
    unsub();
    page.querySelectorAll('.movie-card').forEach(el => el._cleanup?.());
    controller.unmount(); // this cancels debounce and invalidates search lane
  };
}

export function unmount() {
  if (unmountRef) unmountRef();
  unmountRef = null;
  document.title = 'Cinesift';
}

function renderIdle(container, controller, setHeaderInput) {
  const prompt = h('div', { class: 'empty-state' });
  const icon = h('div', { class: 'empty-state-icon', 'aria-hidden': 'true' });
  setText(icon, '🔍');
  const heading = h('h1');
  setText(heading, 'Search movies');
  const sub = h('p');
  setText(sub, 'Type in the search box above to find movies.');
  prompt.appendChild(icon);
  prompt.appendChild(heading);
  prompt.appendChild(sub);
  
  container.appendChild(prompt);
  
  const recent = RecentSearches({
    onSelect: (q) => { setHeaderInput(q); controller.onInput(q); controller.onSubmit(); }
  });
  container.appendChild(recent);
}

function renderResultsGrid(container, results, query, totalResults) {
  const resultsHeader = h('div', { class: 'results-header' });
  const title = h('h1');
  if (query) {
    setText(title, `Results for "${query}"`);
  } else {
    setText(title, `Discover Movies`);
    // Visually hidden class if we don't want to show it, but usually a title is good.
    // Spec says 1 h1 per route, let's keep it visible.
  }
  const count = h('span', { class: 'results-count' });
  if (totalResults) setText(count, `${results.length} of ${totalResults}`);
  
  resultsHeader.appendChild(title);
  if (totalResults) resultsHeader.appendChild(count);
  container.appendChild(resultsHeader);

  const grid = h('div', { class: 'movie-grid' });
  results.forEach((movie, idx) => {
    grid.appendChild(MovieCard(movie, idx < 4));
  });
  container.appendChild(grid);
}
