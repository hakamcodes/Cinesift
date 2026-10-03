/**
 * pages/MovieDetailsPage.js
 * Renders the movie details view with hero, overview, cast, trailer, similar.
 */

import '../styles/pages.css';
import { h, setText } from '../utils/dom.js';
import * as movieService from '../services/movieService.js';
import { formatRating, formatRuntime, imageUrl } from '../utils/format.js';
import { ImageWithFallback } from '../components/ImageWithFallback.js';
import { ErrorState } from '../components/ErrorState.js';
import { TrailerButton } from '../components/TrailerModal.js';
import { Modal } from '../components/Modal.js';
import { MovieCard } from '../components/MovieCard.js';
import { openLightbox } from '../components/Lightbox.js';
import * as watchlistStore from '../state/watchlistStore.js';
import { showToast } from '../components/Toast.js';

let unmountRef = null;

export function mount(params, container) {
  const movieId = parseInt(params.id, 10);
  
  if (!movieId || isNaN(movieId) || movieId <= 0) {
    const error = h('div', { class: 'container error-state' });
    const h2 = h('h2');
    setText(h2, 'Movie not found');
    error.appendChild(h2);
    container.appendChild(error);
    return;
  }

  if (window.__cinesift?.requestManager) {
    window.__cinesift.requestManager.abort('details');
  }
  
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
  const textBars = h('div', { class: 'skeleton-text-bars' });
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
  
  if (movie.backdropPath || movie.posterPath) {
    const bgSrc = imageUrl(movie.backdropPath || movie.posterPath, 'w1280');
    const bdContainer = h('div', { class: 'hero-backdrop-container' });
    const backdrop = h('img', { class: 'hero-backdrop', src: bgSrc, alt: '' });
    const scrim = h('div', { class: 'hero-scrim' });
    bdContainer.appendChild(backdrop);
    bdContainer.appendChild(scrim);
    hero.appendChild(bdContainer);
  } else {
    hero.classList.add('no-backdrop');
  }
  
  const content = h('div', { class: 'hero-content' });
  
  const back = h('a', { class: 'hero-back', href: '#' });
  setText(back, '← Back');
  back.addEventListener('click', (e) => {
    e.preventDefault();
    history.back();
  });
  content.appendChild(back);
  
  const layout = h('div', { class: 'hero-layout' });
  
  const posterDiv = h('div', { class: 'hero-poster' });
  posterDiv.appendChild(ImageWithFallback({
    path: movie.posterPath,
    size: 'w500',
    alt: `Poster for ${movie.title}`,
    eager: true
  }));
  layout.appendChild(posterDiv);
  
  const info = h('div', { class: 'hero-info' });
  
  const h1 = h('h1', { tabindex: '-1' });
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
  
  // Badges
  const meta = h('div', { class: 'hero-meta' });
  if (movie.rating) {
    const rBadge = h('span');
    setText(rBadge, `★ ${formatRating(movie.rating)} (${movie.voteCount})`);
    meta.appendChild(rBadge);
  }
  if (movie.runtime) {
    const runBadge = h('span');
    setText(runBadge, formatRuntime(movie.runtime));
    meta.appendChild(runBadge);
  }
  if (movie.language) {
    const langBadge = h('span');
    setText(langBadge, movie.language.toUpperCase());
    meta.appendChild(langBadge);
  }
  if (movie.releaseDate) {
    const relBadge = h('span');
    setText(relBadge, movie.releaseDate);
    meta.appendChild(relBadge);
  }
  if (meta.childNodes.length > 0) info.appendChild(meta);
  
  if (movie.genres && movie.genres.length > 0) {
    const genresDiv = h('div', { class: 'hero-genres' });
    movie.genres.forEach(g => {
      const pill = h('span', { class: 'genre-pill' });
      setText(pill, g.name);
      genresDiv.appendChild(pill);
    });
    info.appendChild(genresDiv);
  }
  
  const actions = h('div', { class: 'hero-actions' });
  
  // Trailer Button (primary)
  const trailerBtn = TrailerButton({
    trailerKey: movie.trailer?.key,
    movieTitle: movie.title
  });
  trailerBtn.classList.remove('btn-secondary');
  trailerBtn.classList.add('btn-primary');
  actions.appendChild(trailerBtn);
  
  // Watchlist Button (secondary)
  const wlBtn = h('button', { class: 'btn btn-secondary hero-wl-btn' });
  const updateWlBtn = () => {
    const inWl = watchlistStore.has(movie.id);
    setText(wlBtn, inWl ? '✓ In Watchlist' : '＋ Add to watchlist');
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
      undo: nowInWl ? null : { label: 'Undo', onClick: () => watchlistStore.toggle(movie) }
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
  const mainContent = h('div', { class: 'details-main' });
  const leftCol = h('div', { class: 'details-left' });
  const rightCol = h('div', { class: 'details-right' });
  
  // Overview
  const overviewSec = h('section', { class: 'details-section overview-section' });
  const oTitle = h('h2');
  setText(oTitle, 'Overview');
  overviewSec.appendChild(oTitle);
  const oText = h('p');
  setText(oText, movie.overview || 'No overview available.');
  overviewSec.appendChild(oText);
  leftCol.appendChild(overviewSec);
  
  // Cast
  if (movie.cast && movie.cast.length > 0) {
    const castSec = h('section', { class: 'details-section cast-section' });
    const cTitle = h('h2');
    setText(cTitle, 'Cast');
    castSec.appendChild(cTitle);
    
    const castList = h('div', { class: 'cast-list' });
    movie.cast.forEach(actor => {
      const actDiv = h('div', { class: 'cast-member' });
      
      const photoDiv = h('div', { class: 'cast-photo' });
      if (actor.profilePath) {
        photoDiv.appendChild(ImageWithFallback({
          path: actor.profilePath,
          size: 'w185',
          alt: actor.name
        }));
      } else {
        const initials = actor.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
        setText(photoDiv, initials);
      }
      
      const name = h('div', { class: 'cast-name' });
      setText(name, actor.name);
      
      const char = h('div', { class: 'cast-character' });
      setText(char, actor.character || '');
      
      actDiv.appendChild(photoDiv);
      actDiv.appendChild(name);
      actDiv.appendChild(char);
      castList.appendChild(actDiv);
    });
    castSec.appendChild(castList);
    leftCol.appendChild(castSec);
  }

  // Backdrops / Gallery
  if (movie.backdrops && movie.backdrops.length > 0) {
    const galSec = h('section', { class: 'details-section gallery-section' });
    const gTitle = h('h2');
    setText(gTitle, 'Gallery');
    galSec.appendChild(gTitle);
    
    const galGrid = h('div', { class: 'gallery-row' });
    movie.backdrops.forEach((img, idx) => {
      const imgDiv = h('div', { 
        style: { 
          flexShrink: '0',
          scrollSnapAlign: 'start',
          width: '280px', 
          height: '158px', 
          borderRadius: 'var(--r-md)', 
          overflow: 'hidden',
          background: 'var(--surface-2)',
          cursor: 'pointer'
        } 
      });
      imgDiv.appendChild(ImageWithFallback({
        path: img.filePath,
        size: 'w1280',
        imgClass: 'backdrop-image',
        alt: 'Backdrop'
      }));
      imgDiv.addEventListener('click', () => openLightbox(movie.backdrops, idx));
      galGrid.appendChild(imgDiv);
    });
    galSec.appendChild(galGrid);
    leftCol.appendChild(galSec);
  }

  // Reviews
  if (movie.reviews && movie.reviews.length > 0) {
    const revSec = h('section', { class: 'details-section reviews-section' });
    const rTitle = h('h2');
    setText(rTitle, 'User Reviews');
    revSec.appendChild(rTitle);
    
    const revList = h('div', { style: { display: 'flex', flexDirection: 'column', gap: '16px' } });
    movie.reviews.forEach(r => {
      const rCard = h('div', { style: { padding: '16px', background: 'var(--surface-2)', borderRadius: '8px' } });
      const rHeader = h('div', { style: { display: 'flex', justifyContent: 'space-between', marginBottom: '8px' } });
      const rAuthor = h('strong');
      setText(rAuthor, r.author);
      rHeader.appendChild(rAuthor);
      if (r.rating) {
        const rRating = h('span', { style: { color: 'var(--accent)' } });
        setText(rRating, `★ ${r.rating}`);
        rHeader.appendChild(rRating);
      }
      rCard.appendChild(rHeader);
      
      const rContent = h('p', { style: { fontSize: 'var(--fs-sm)', color: 'var(--text-muted)' } });
      // truncate long reviews
      const text = r.content.length > 300 ? r.content.substring(0, 300) + '...' : r.content;
      setText(rContent, text);
      rCard.appendChild(rContent);
      revList.appendChild(rCard);
    });
    revSec.appendChild(revList);
    leftCol.appendChild(revSec);
  }

  // Similar Movies
  if (movie.similar && movie.similar.length > 0) {
    const simSec = h('section', { class: 'details-section similar-section' });
    
    const headerRow = h('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--s-3)' } });
    const sTitle = h('h2', { style: { margin: 0, padding: 0 } });
    setText(sTitle, 'Similar movies');
    headerRow.appendChild(sTitle);
    
    simSec.appendChild(headerRow);
    
    const simGrid = h('div', { class: 'movie-grid' });
    movie.similar.forEach((m, idx) => {
      simGrid.appendChild(MovieCard(m, idx < 4));
    });

    
    simSec.appendChild(simGrid);
    leftCol.appendChild(simSec);
  }
  
  // Facts
  const factsSec = h('section', { class: 'details-section facts-section' });
  const fTitle = h('h2');
  setText(fTitle, 'Facts');
  factsSec.appendChild(fTitle);

  const dl = h('dl', { class: 'facts-list' });

  if (movie.director) appendFact(dl, 'Director', movie.director);
  if (movie.writers && movie.writers.length > 0) appendFact(dl, 'Writers', movie.writers.join(', '));
  if (movie.producers && movie.producers.length > 0) appendFact(dl, 'Producers', movie.producers.join(', '));
  if (movie.composers && movie.composers.length > 0) appendFact(dl, 'Composers', movie.composers.join(', '));
  if (movie.releaseDate) appendFact(dl, 'Release date', movie.releaseDate);
  if (movie.status) appendFact(dl, 'Status', movie.status);
  if (movie.language) appendFact(dl, 'Language', movie.language.toUpperCase());
  if (movie.runtime) appendFact(dl, 'Runtime', formatRuntime(movie.runtime));
  if (movie.budget) appendFact(dl, 'Budget', `$${movie.budget.toLocaleString()}`);
  if (movie.revenue) appendFact(dl, 'Revenue', `$${movie.revenue.toLocaleString()}`);
  
  if (movie.productionCountries && movie.productionCountries.length > 0) {
    appendFact(dl, 'Countries', movie.productionCountries.join(', '));
  }
  if (movie.productionCompanies && movie.productionCompanies.length > 0) {
    appendFact(dl, 'Production companies', movie.productionCompanies.map(c => c.name).join(', '));
  }
  if (movie.watchProviders && movie.watchProviders.stream && movie.watchProviders.stream.length > 0) {
    appendFact(dl, 'Stream on', movie.watchProviders.stream.join(', '));
  }
  
  factsSec.appendChild(dl);
  rightCol.appendChild(factsSec);
  
  mainContent.appendChild(leftCol);
  mainContent.appendChild(rightCol);
  container.appendChild(mainContent);
}

function appendFact(dl, label, value) {
  const row = h('div', { class: 'fact-row' });
  const dt = h('dt', { class: 'fact-label' });
  setText(dt, label);
  const dd = h('dd', { class: 'fact-value' });
  setText(dd, value);
  row.appendChild(dt);
  row.appendChild(dd);
  dl.appendChild(row);
}

function showManualCopyFallback(url) {
  const content = h('div', { class: 'share-fallback' });
  const p = h('p');
  setText(p, 'Press Ctrl/⌘+C to copy');
  const input = h('input', { type: 'text', value: url, readonly: true, class: 'share-input' });
  input.style.width = '100%';
  input.style.marginTop = 'var(--s-2)';
  input.style.padding = 'var(--s-2)';
  input.style.background = 'var(--surface)';
  input.style.border = '1px solid var(--border)';
  input.style.color = 'var(--text)';
  
  content.appendChild(p);
  content.appendChild(input);
  const m = Modal({ title: 'Share Movie', content });
  m.open();
  input.select();
}

function copyToClipboard(url) {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(url).then(() => {
      showToast({ message: 'Link copied', type: 'success' });
    }).catch(() => {
      showManualCopyFallback(url);
    });
  } else {
    showManualCopyFallback(url);
  }
}
