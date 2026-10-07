/**
 * components/MovieCard.js
 * A single movie card with poster, title, year, rating.
 *
 * Spec (UI_UX_SPEC §5.1):
 *   - <article> with a stretched <a> link to /movie/:id.
 *   - Poster uses ImageWithFallback (lazy loading, fallback art).
 *   - Title 2-line clamp.
 *   - Missing data: year → "—", rating → "NR".
 *   - No throws — every field has a default.
 */

import { h, setText } from '../utils/dom.js';
import { formatYear, formatRating } from '../utils/format.js';
import { ImageWithFallback } from './ImageWithFallback.js';
import * as watchlistStore from '../state/watchlistStore.js';

/**
 * Render a MovieCard DOM element.
 *
 * @param {{
 *   id: number,
 *   title: string,
 *   posterPath: string|null,
 *   year: number|null,
 *   rating: number|null,
 * @param {object} [options]
 * @param {boolean} [options.eager=false] - If true, image loads eagerly.
 * @returns {HTMLElement}
 */
export function MovieCard(movie, { eager = false } = {}) {
  const { id, title = 'Untitled', posterPath, year, rating } = movie;

  const article = h('article', { class: 'movie-card' });

  // Stretched link — covers the whole card. Watchlist button sits above it via z-index.
  const link = h('a', {
    href: `/movie/${id}`,
    class: 'movie-card-link',
    'data-link': '',   // Intercepted by router for SPA navigation.
    'aria-label': title,
  });

  // Poster image (or fallback).
  const poster = ImageWithFallback({
    path: posterPath,
    size: 'w342',
    alt: '',           // Decorative; title is adjacent text.
    title,
    className: '',
    eager
  });

  link.appendChild(poster);
  article.appendChild(link);

  // Card body — title + meta.
  const body = h('div', { class: 'movie-card-body' });

  const titleEl = h('p', { class: 'movie-card-title', title });
  setText(titleEl, title);  // textContent — safe for user/API text.

  const meta = h('p', { class: 'movie-card-meta' });
  const yearStr = formatYear(year);
  const ratingStr = formatRating(rating);
  // Build meta text: "2022 · ★ 7.8" or "— · NR"
  const starSpan = h('span', { class: 'rating-star' });
  setText(starSpan, ratingStr);

  const yearSpan = document.createTextNode(`${yearStr} · `);

  meta.appendChild(yearSpan);
  meta.appendChild(starSpan);

  body.appendChild(titleEl);
  body.appendChild(meta);
  article.appendChild(body);

  // Watchlist heart button
  const heart = h('button', { 
    class: 'movie-card-heart', 
    type: 'button',
    'aria-label': 'Add to watchlist',
    'aria-pressed': 'false'
  });
  // Initially heart empty
  setText(heart, '♡');
  
  // Sync state
  const sync = () => {
    const inWl = watchlistStore.has(id);
    setText(heart, inWl ? '♥' : '♡');
    heart.setAttribute('aria-pressed', inWl.toString());
    heart.setAttribute('aria-label', inWl ? 'Remove from watchlist' : 'Add to watchlist');
    if (inWl) heart.classList.add('active');
    else heart.classList.remove('active');
  };
  sync();
  
  const unsub = watchlistStore.subscribe(sync);

  heart.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation(); // prevent link click
    const nowIn = watchlistStore.toggle(movie);
    // Let details page / toast handle notification if needed, or trigger global event
    window.dispatchEvent(new CustomEvent('cinesift:toast', {
      detail: {
        message: nowIn ? 'Added to watchlist' : 'Removed from watchlist',
        type: 'success',
        undo: nowIn ? null : { label: 'Undo', onClick: () => watchlistStore.add(movie) }
      }
    }));
  });
  
  article.appendChild(heart);

  // Provide cleanup hook for pages to avoid listener leaks
  article._cleanup = unsub;

  return article;
}
