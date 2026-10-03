/**
 * components/SkeletonGrid.js
 * Shows N placeholder cards while a request is in flight.
 *
 * Spec (UI_UX_SPEC §5.3):
 *   - Card-shaped 2:3 block + two text bars.
 *   - Shimmer animation (CSS .skeleton class).
 *   - aria-hidden=true on each card.
 *   - Container has aria-busy=true while visible.
 */

import { SKELETON_COUNT } from '../config.js';
import { h } from '../utils/dom.js';

/**
 * Render a skeleton grid with N placeholder cards.
 *
 * @param {{ count?: number }} [opts]
 * @returns {HTMLElement}
 */
export function SkeletonGrid({ count = SKELETON_COUNT } = {}) {
  const grid = h('div', {
    class: 'movie-grid',
    'aria-label': 'Loading movies',
    'aria-busy': 'true',
  });

  for (let i = 0; i < count; i++) {
    grid.appendChild(makeSkeletonCard());
  }

  return grid;
}

/** Build one skeleton card DOM element. */
function makeSkeletonCard() {
  const card = h('div', { class: 'skeleton-card', 'aria-hidden': 'true' });

  // Poster placeholder (2:3 aspect).
  const poster = h('div', { class: 'skeleton skeleton-poster' });

  // Two text bar placeholders.
  const line1 = h('div', { class: 'skeleton skeleton-line' });
  const line2 = h('div', { class: 'skeleton skeleton-line short' });

  card.appendChild(poster);
  card.appendChild(line1);
  card.appendChild(line2);

  return card;
}
