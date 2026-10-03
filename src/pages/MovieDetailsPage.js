/**
 * pages/MovieDetailsPage.js
 * Renders the movie details view with hero, overview, cast, trailer, similar.
 * Implements the `details` lane to prevent race conditions on quick navigation.
 */

import { h, setText } from '../utils/dom.js';
import * as movieService from '../services/movieService.js';
import { formatYear, formatRating, formatRuntime } from '../utils/format.js';
import { ImageWithFallback } from '../components/ImageWithFallback.js';
import { ErrorState } from '../components/ErrorState.js';
import { TrailerButton } from '../components/TrailerModal.js';
import { MovieCard } from '../components/MovieCard.js';
import * as watchlistStore from '../state/watchlistStore.js';
import { showToast } from '../components/Toast.js';
import { Modal } from '../components/Modal.js';

let unmountRef = null;

export function mount(params, container) {
  const movieId = parseInt(params.id, 10);
  
  if (!movieId || isNaN(movieId)) {
    const error = h('div', { class: 'container error-state' });
    const h2 = h('h2');
    setText(h2, 'Movie not found');
    error.appendChild(h2);
    container.appendChild(error);
    return;
  }

  // Cancel any existing request on details lane when mounting
  if (window.__cinesift?.requestManager) {
    window.__cinesift.requestManager.abort('details');
  } else {
    // For production, we need a way to abort. Since requestManager is in searchController
    // normally, we'll instantiate a local controller for the details lane.
  }
  
  // Actually we can just fetch and use AbortController locally.
  const ctrl = new AbortController();
  let active = true;

  unmountRef = () => {
    active = false;
    ctrl.abort(new DOMException('unmounted', 'AbortError'));
    container.querySelectorAll('.movie-card').forEach(el => el._cleanup?.());
  };

  renderSkeleton(container);

  movieService.details(movieId, ctrl.signal)
    .then(movie => {
      if (!active) return;
      document.title = `${movie.title} ${movie.year ? `(${movie.year})` : ''} — Cinesift`;
      renderSuccess(container, movie);
    })
    .catch(err => {
      if (!active || err.name === 'AbortError') return;
      container.querySelectorAll('.movie-card').forEach(el => el._cleanup?.());
      container.innerHTML = '';
      if (err.category === 'not_found' || (err.cause?.status === 404)) {
        const error = h('div', { class: 'container error-state' });
        const h2 = h('h2');
        setText(h2, 'Movie not found');
        error.appendChild(h2);
        container.appendChild(error);
      } else {
        container.appendChild(ErrorState({
          error: { category: err.category || 'server', userMessage: err.message, retryable: true },
          onRetry: () => mount(params, container)
        }));
      }
    });
}

export function unmount() {
  if (unmountRef) unmountRef();
  unmountRef = null;
  document.title = 'Cinesift';
}

function renderSkeleton(container) {
  container.innerHTML = '';
  const skeleton = h('div', { class: 'movie-details-skeleton' });
  const hero = h('div', { class: 'skeleton-hero skeleton', 'aria-busy': 'true' });
  const textBars = h('div', { class: 'container skeleton-text-bars' });
  textBars.appendChild(h('div', { class: 'skeleton-line skeleton' }));
  textBars.appendChild(h('div', { class: 'skeleton-line short skeleton' }));
  skeleton.appendChild(hero);
  skeleton.appendChild(textBars);
  container.appendChild(skeleton);
}

function renderSuccess(container, movie) {
  container.innerHTML = '';
  
  // Hero section
  const hero = h('section', { class: 'movie-hero' });
  
  // Backdrop
  if (movie.backdropPath || movie.posterPath) {
    const bgSrc = movie.backdropPath ? 
      `https://image.tmdb.org/t/p/w1280${movie.backdropPath}` : 
      `https://image.tmdb.org/t/p/w1280${movie.posterPath}`;
    
    const backdrop = h('div', { class: 'hero-backdrop' });
    backdrop.style.backgroundImage = `url("${bgSrc}")`;
    hero.appendChild(backdrop);
  } else {
    hero.classList.add('no-backdrop');
  }
  
  const scrim = h('div', { class: 'hero-scrim' });
  hero.appendChild(scrim);
  
  const content = h('div', { class: 'container hero-content' });
  
  // Back button
  const back = h('a', { class: 'hero-back btn-ghost', href: '#', 'aria-label': 'Go back' });
  setText(back, '← Back');
  back.addEventListener('click', (e) => {
    e.preventDefault();
    history.back();
  });
  content.appendChild(back);
  
  const layout = h('div', { class: 'hero-layout' });
  
  // Poster
  const posterDiv = h('div', { class: 'hero-poster' });
  posterDiv.appendChild(ImageWithFallback({
    path: movie.posterPath,
    size: 'w500',
    alt: `Poster for ${movie.title}`,
    eager: true
  }));
  layout.appendChild(posterDiv);
  
  // Info
  const info = h('div', { class: 'hero-info' });
  
  const h1 = h('h1', { tabindex: '-1' }); // Focus target
  setText(h1, movie.title);
  if (movie.year) {
    const yearSpan = h('span', { class: 'hero-year' });
    setText(yearSpan, ` (${movie.year})`);
    h1.appendChild(yearSpan);
  }
  info.appendChild(h1);
  
  if (movie.tagline) {
    const tag = h('p', { class: 'hero-tagline' });
    setText(tag, movie.tagline);
    info.appendChild(tag);
  }
  
  // Meta line
  const meta = h('div', { class: 'hero-meta' });
  const metaParts = [];
  
  if (movie.rating) {
    metaParts.push(`★ ${formatRating(movie.rating)} (${movie.voteCount})`);
  }
  if (movie.runtime) {
    metaParts.push(formatRuntime(movie.runtime));
  }
  if (movie.language) {
    metaParts.push(movie.language.toUpperCase());
  }
  
  if (metaParts.length > 0) {
    setText(meta, metaParts.join(' · '));
    info.appendChild(meta);
  }
  
  // Genres
  if (movie.genres && movie.genres.length > 0) {
    const genresDiv = h('div', { class: 'hero-genres' });
    movie.genres.forEach(g => {
      const pill = h('span', { class: 'genre-pill' });
      setText(pill, g.name);
      genresDiv.appendChild(pill);
    });
    info.appendChild(genresDiv);
  }
  
  // Actions
  const actions = h('div', { class: 'hero-actions' });
  
  // Trailer Button
  const trailerBtn = TrailerButton({
    trailerKey: movie.trailer?.key,
    movieTitle: movie.title
  });
  actions.appendChild(trailerBtn);
  
  // Watchlist Button
  const wlBtn = h('button', { class: 'btn btn-secondary hero-wl-btn' });
  const updateWlBtn = () => {
    const inWl = watchlistStore.has(movie.id);
    setText(wlBtn, inWl ? '✓ In Watchlist' : '＋ Watchlist');
    wlBtn.setAttribute('aria-pressed', inWl.toString());
  };
  updateWlBtn();
  const unsubWl = watchlistStore.subscribe(updateWlBtn);
  const oldUnmount = unmountRef;
  unmountRef = () => {
    if (oldUnmount) oldUnmount();
    unsubWl();
  };
  
  wlBtn.addEventListener('click', () => {
    const nowInWl = watchlistStore.toggle(movie);
    showToast({ 
      message: nowInWl ? 'Added to watchlist' : 'Removed from watchlist', 
      type: 'success',
      undo: nowInWl ? null : {
        label: 'Undo',
        onClick: () => watchlistStore.add(movie)
      }
    });
  });
  actions.appendChild(wlBtn);

  // Share button
  const shareBtn = h('button', { class: 'btn btn-secondary' });
  setText(shareBtn, '⤴ Share');
  shareBtn.addEventListener('click', async () => {
    const url = `${window.location.origin}/movie/${movie.id}`;
    if (navigator.share) {
      try {
        await navigator.share({ title: movie.title, url });
      } catch (err) {
        if (err.name !== 'AbortError') copyToClipboard(url);
      }
    } else {
      copyToClipboard(url);
    }
  });
  actions.appendChild(shareBtn);
  
  info.appendChild(actions);
  layout.appendChild(info);
  content.appendChild(layout);
  hero.appendChild(content);
  container.appendChild(hero);
  
  // Main Details Content
  const mainContent = h('div', { class: 'container details-main' });
  const leftCol = h('div', { class: 'details-left' });
  const rightCol = h('div', { class: 'details-right' });
  
  // Overview
  const overviewSec = h('section', { class: 'details-section' });
  const oTitle = h('h2');
  setText(oTitle, 'Overview');
  overviewSec.appendChild(oTitle);
  const oText = h('p');
  setText(oText, movie.overview || 'No overview available.');
  overviewSec.appendChild(oText);
  leftCol.appendChild(overviewSec);
  
  // Cast
  if (movie.cast && movie.cast.length > 0) {
    const castSec = h('section', { class: 'details-section' });
    const cTitle = h('h2');
    setText(cTitle, 'Top Cast');
    castSec.appendChild(cTitle);
    
    const castList = h('div', { class: 'cast-list' });
    movie.cast.forEach(actor => {
      const actDiv = h('div', { class: 'cast-member' });
      const img = ImageWithFallback({
        path: actor.profilePath,
        size: 'w185',
        alt: actor.name
      });
      img.classList.add('cast-photo');
      const name = h('div', { class: 'cast-name' });
      setText(name, actor.name);
      const char = h('div', { class: 'cast-character' });
      setText(char, actor.character || '');
      
      actDiv.appendChild(img);
      actDiv.appendChild(name);
      actDiv.appendChild(char);
      castList.appendChild(actDiv);
    });
    castSec.appendChild(castList);
    leftCol.appendChild(castSec);
  }

  // Similar Movies
  if (movie.similar && movie.similar.length > 0) {
    const simSec = h('section', { class: 'details-section' });
    const sTitle = h('h2');
    setText(sTitle, 'Similar Movies');
    simSec.appendChild(sTitle);
    
    const simGrid = h('div', { class: 'similar-row' }); // horizontal scroll
    movie.similar.forEach((m, idx) => {
      simGrid.appendChild(MovieCard(m, idx < 4));
    });
    simSec.appendChild(simGrid);
    leftCol.appendChild(simSec);
  }
  
  // Facts
  const factsSec = h('section', { class: 'details-section facts-list' });
  if (movie.director) {
    factsSec.appendChild(factRow('Director', movie.director));
  }
  if (movie.releaseDate) {
    factsSec.appendChild(factRow('Release Date', movie.releaseDate));
  }
  if (movie.status) {
    factsSec.appendChild(factRow('Status', movie.status));
  }
  rightCol.appendChild(factsSec);
  
  mainContent.appendChild(leftCol);
  mainContent.appendChild(rightCol);
  container.appendChild(mainContent);
}

function factRow(label, value) {
  const div = h('div', { class: 'fact-row' });
  const dt = h('div', { class: 'fact-label' });
  setText(dt, label);
  const dd = h('div', { class: 'fact-value' });
  setText(dd, value);
  div.appendChild(dt);
  div.appendChild(dd);
  return div;
}

function copyToClipboard(url, shareBtn) {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(url).then(() => {
      showToast({ message: 'Link copied', type: 'success' });
    }).catch(() => {
      manualCopyFallback(url, shareBtn);
    });
  } else {
    manualCopyFallback(url, shareBtn);
  }
}

function manualCopyFallback(url, shareBtn) {
  const content = h('div', { class: 'manual-copy-content' });
  const input = h('input', { 
    type: 'text', 
    readonly: 'true', 
    value: url, 
    class: 'manual-copy-input',
    'aria-label': 'URL to copy'
  });
  const p = h('p');
  setText(p, 'Press Ctrl/⌘+C to copy, or select the text above.');
  
  content.appendChild(input);
  content.appendChild(p);

  const modal = Modal({
    title: 'Share Link',
    content,
    className: 'share-modal'
  });

  modal.open(shareBtn);

  // Auto-select the input for easy copying
  requestAnimationFrame(() => {
    input.focus();
    input.select();
  });
}
