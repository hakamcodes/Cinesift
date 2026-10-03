/**
 * components/ImageWithFallback.js
 * Renders an <img> and swaps to an inline SVG placeholder on error.
 *
 * Spec (UI_UX_SPEC §5.2):
 *   - Null/empty path → render placeholder directly (no network request).
 *   - Image error event → swap to placeholder with same aspect ratio.
 *   - No broken-image icon ever.
 *   - Preserve aspect ratio to avoid CLS.
 *   - max-width:100% and height:auto on all <img> elements.
 */

import { imageUrl } from '../utils/format.js';
import { h } from '../utils/dom.js';

/**
 * srcset/sizes configuration by intended use-case.
 * Keeps card posters from requesting huge sizes and cast photos from w500.
 *
 * @type {Record<string, { widths: number[], sizes: string }>}
 */
const SRCSET_CONFIG = {
  // Card poster: w342 primary; offer w185 for small screens, w500 for Retina.
  w342: {
    widths: [185, 342, 500],
    sizes: '(max-width: 360px) 185px, (max-width: 960px) 342px, 500px',
  },
  // Details poster: w500 primary; offer w342 as a smaller fallback.
  w500: {
    widths: [342, 500],
    sizes: '(max-width: 600px) 342px, 500px',
  },
  // Cast photo / small thumb: w185 only — never fetch a larger size.
  w185: {
    widths: [185],
    sizes: '185px',
  },
  // Backdrop: offer w780 and w1280 based on viewport.
  w1280: {
    widths: [780, 1280],
    sizes: '(max-width: 960px) 780px, 1280px',
  },
};

/**
 * Create a poster <div> that either shows an <img> or a placeholder SVG.
 *
 * @param {{
 *   path: string|null,
 *   size?: string,
 *   alt?: string,
 *   title?: string,
 *   className?: string,
 *   eager?: boolean
 * }} opts
 * @returns {HTMLElement}
 */
export function ImageWithFallback({ path, size = 'w342', alt = '', title = '', className = '', imgClass = 'movie-card-poster', eager = false }) {
  const container = h('div', { class: `img-fallback-container${className ? ` ${className}` : ''}` });

  const src = imageUrl(path, size);

  if (!src) {
    // No path — render placeholder immediately, no network request wasted.
    container.appendChild(makePlaceholder(title, imgClass));
    return container;
  }

  // Build a srcset limited to the widths appropriate for this size bucket.
  const config = SRCSET_CONFIG[size];
  let srcsetAttr = '';
  let sizesAttr = '';

  if (config && config.widths.length > 1) {
    srcsetAttr = config.widths
      .map(w => `${imageUrl(path, `w${w}`)} ${w}w`)
      .join(', ');
    sizesAttr = config.sizes;
  }

  // We have a URL — attempt to load it.
  const imgAttrs = {
    src,
    alt,
    loading: eager ? 'eager' : 'lazy',
    decoding: eager ? 'auto' : 'async',
    class: imgClass,
  };

  if (srcsetAttr) {
    imgAttrs.srcset = srcsetAttr;
    imgAttrs.sizes  = sizesAttr;
  }

  const img = h('img', imgAttrs);

  if (eager) {
    img.setAttribute('fetchpriority', 'high');
  }

  // On error (404, blocked host, network failure) swap to the SVG placeholder.
  img.addEventListener('error', () => {
    img.replaceWith(makePlaceholder(title, imgClass));
  }, { once: true });

  container.appendChild(img);
  return container;
}

/**
 * Build an inline SVG placeholder.
 * Adapts aspect ratio based on the imgClass.
 * Shows the first two letters of the title as a visual cue.
 *
 * @param {string} title
 * @param {string} imgClass
 * @returns {SVGElement}
 */
function makePlaceholder(title, imgClass = 'movie-card-poster') {
  const initials = (title || '?').slice(0, 2).toUpperCase();

  const isBackdrop = imgClass.includes('backdrop');
  const viewBox = isBackdrop ? '0 0 320 180' : '0 0 200 300';
  const iconY = isBackdrop ? '80' : '130';
  const textY = isBackdrop ? '135' : '185';

  // Create a minimal SVG placeholder.
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', viewBox);
  svg.setAttribute('width', '100%');
  svg.setAttribute('aria-hidden', 'true');
  svg.style.display = 'block';
  svg.style.background = '#1c1f27';
  
  // Apply the same class so CSS rules (like aspect ratio) apply to the placeholder too.
  svg.className.baseVal = imgClass;

  // Film-reel icon (simple text glyph).
  const icon = document.createElementNS('http://www.w3.org/2000/svg', 'text');
  icon.setAttribute('x', '50%');
  icon.setAttribute('y', iconY);
  icon.setAttribute('text-anchor', 'middle');
  icon.setAttribute('font-size', '48');
  icon.setAttribute('fill', '#2a2e39');
  icon.textContent = '🎬';

  // Initials label — safe because initials come from a normalised title (no user HTML).
  const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
  label.setAttribute('x', '50%');
  label.setAttribute('y', textY);
  label.setAttribute('text-anchor', 'middle');
  label.setAttribute('font-size', '36');
  label.setAttribute('font-weight', 'bold');
  label.setAttribute('fill', '#a3a9b8');
  label.textContent = initials; // textContent — no injection

  svg.appendChild(icon);
  svg.appendChild(label);
  return svg;
}
