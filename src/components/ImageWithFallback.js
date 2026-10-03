/**
 * components/ImageWithFallback.js
 * Renders an <img> and swaps to an inline SVG placeholder on error.
 *
 * Spec (UI_UX_SPEC §5.2):
 *   - Null/empty path → render placeholder directly (no network request).
 *   - Image error event → swap to placeholder with same aspect ratio.
 *   - No broken-image icon ever.
 *   - Preserve aspect ratio to avoid CLS.
 */

import { imageUrl } from '../utils/format.js';
import { h } from '../utils/dom.js';

/**
 * Create a poster <div> that either shows an <img> or a placeholder SVG.
 *
 * @param {{
 *   path: string|null,
 *   size?: string,
 *   alt?: string,
 *   title?: string,
 *   className?: string
 * }} opts
 * @returns {HTMLElement}
 */
export function ImageWithFallback({ path, size = 'w342', alt = '', title = '', className = '', eager = false }) {
  const container = h('div', { class: `img-fallback-container ${className}` });

  const src = imageUrl(path, size);

  if (!src) {
    // No path — render placeholder immediately, no network request wasted.
    container.appendChild(makePlaceholder(title));
    return container;
  }

  // Use a srcset to provide multiple sizes (w185 for small, w342 for medium, w500 for large displays).
  const srcset = `${imageUrl(path, 'w185')} 185w, ${imageUrl(path, 'w342')} 342w, ${imageUrl(path, 'w500')} 500w`;
  const sizes = '(max-width: 480px) 185px, (max-width: 768px) 342px, 500px';

  // We have a URL — attempt to load it.
  const img = h('img', {
    src,
    srcset,
    sizes,
    alt,
    loading: eager ? 'eager' : 'lazy',
    decoding: eager ? 'auto' : 'async',
    class: 'movie-card-poster',
  });
  
  if (eager) {
    img.setAttribute('fetchpriority', 'high');
  }

  // On error (404, blocked host, etc.) swap to the SVG placeholder.
  img.addEventListener('error', () => {
    img.replaceWith(makePlaceholder(title));
  }, { once: true });

  container.appendChild(img);
  return container;
}

/**
 * Build an inline SVG placeholder matching the 2:3 poster aspect ratio.
 * Shows the first two letters of the title as a visual cue.
 *
 * @param {string} title
 * @returns {SVGElement}
 */
function makePlaceholder(title) {
  const initials = (title || '?').slice(0, 2).toUpperCase();

  // Create a minimal SVG placeholder.
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 200 300');
  svg.setAttribute('width', '100%');
  svg.setAttribute('aria-hidden', 'true');
  svg.style.display = 'block';
  svg.style.background = '#1c1f27';
  svg.classList.add('movie-card-poster');

  // Film-reel icon (simple path).
  const icon = document.createElementNS('http://www.w3.org/2000/svg', 'text');
  icon.setAttribute('x', '100');
  icon.setAttribute('y', '130');
  icon.setAttribute('text-anchor', 'middle');
  icon.setAttribute('font-size', '48');
  icon.setAttribute('fill', '#2a2e39');
  icon.textContent = '🎬';

  // Initials label — safe because initials come from a normalised title (no user HTML).
  const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
  label.setAttribute('x', '100');
  label.setAttribute('y', '185');
  label.setAttribute('text-anchor', 'middle');
  label.setAttribute('font-size', '36');
  label.setAttribute('font-weight', 'bold');
  label.setAttribute('fill', '#a3a9b8');
  label.textContent = initials; // textContent — no injection

  svg.appendChild(icon);
  svg.appendChild(label);
  return svg;
}
