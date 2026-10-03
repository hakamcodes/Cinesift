/**
 * components/TrailerModal.js
 * YouTube trailer modal using native <dialog>.
 *
 * Spec (UI_UX_SPEC §7.1):
 *   - Embed: youtube-nocookie.com/embed/{key}?autoplay=1&rel=0
 *   - iframe created only when modal opens; removed on close (stops playback).
 *   - Key validated against /^[\w-]{6,20}$/ before URL build (avoid injection).
 *   - Fallback: if key is null → button disabled + "Trailer unavailable" text.
 *   - Fallback link to YouTube if iframe fails after 8s.
 */

import { h, setText } from '../utils/dom.js';

/** Validate a YouTube video key. */
const KEY_RE = /^[\w-]{6,20}$/;

/**
 * Render a Trailer button; clicking opens the modal.
 *
 * @param {{ trailerKey: string|null, movieTitle: string }} opts
 * @returns {HTMLElement}
 */
export function TrailerButton({ trailerKey, movieTitle }) {
  const hasTrailer = trailerKey && KEY_RE.test(trailerKey);

  const btn = h('button', {
    class: 'btn btn-primary trailer-btn',
    type: 'button',
    disabled: hasTrailer ? null : 'true',
    'aria-label': hasTrailer ? `Watch trailer for ${movieTitle}` : 'Trailer unavailable',
  });
  setText(btn, hasTrailer ? '▶ Watch Trailer' : '▶ Trailer Unavailable');

  if (!hasTrailer) return btn;

  btn.addEventListener('click', () => {
    openTrailerModal(trailerKey, movieTitle, btn);
  });

  return btn;
}

/**
 * Open the trailer in a dialog modal.
 * @param {string} key
 * @param {string} movieTitle
 * @param {HTMLElement} trigger
 */
function openTrailerModal(key, movieTitle, trigger) {
  const dialog = h('dialog', {
    class: 'modal trailer-modal',
    'aria-label': `Trailer: ${movieTitle}`,
    'aria-modal': 'true',
  });

  const closeBtn = h('button', {
    class: 'modal-close btn btn-ghost trailer-close',
    type: 'button',
    'aria-label': 'Close trailer',
  });
  setText(closeBtn, '✕');

  const wrapper = h('div', { class: 'trailer-wrapper' });

  // Spinner shown until iframe loads.
  const spinner = h('div', { class: 'trailer-spinner', 'aria-hidden': 'true' });
  setText(spinner, '⏳');
  wrapper.appendChild(spinner);

  const src = `https://www.youtube-nocookie.com/embed/${key}?autoplay=1&rel=0`;
  const iframe = h('iframe', {
    class: 'trailer-iframe',
    src,
    title: `Trailer: ${movieTitle}`,
    allow: 'autoplay; encrypted-media; picture-in-picture',
    allowfullscreen: '',
    loading: 'lazy',
  });

  // Show fallback link after 8s if iframe doesn't load.
  const fallbackTimer = setTimeout(() => {
    if (!wrapper.contains(iframe) || !iframe.classList.contains('loaded')) {
      const link = h('a', {
        href: `https://www.youtube.com/watch?v=${key}`,
        target: '_blank',
        rel: 'noopener noreferrer',
        class: 'btn btn-secondary',
      });
      setText(link, 'Open on YouTube');
      wrapper.appendChild(link);
    }
  }, 8000);

  iframe.addEventListener('load', () => {
    iframe.classList.add('loaded');
    spinner.remove();
  });

  wrapper.appendChild(iframe);
  dialog.appendChild(closeBtn);
  dialog.appendChild(wrapper);

  function closeModal() {
    clearTimeout(fallbackTimer);
    // Remove iframe first to stop playback.
    iframe.remove();
    dialog.close();
    document.body.style.overflow = '';
    dialog.remove();
    trigger?.focus();
  }

  closeBtn.addEventListener('click', closeModal);
  dialog.addEventListener('click', (e) => { if (e.target === dialog) closeModal(); });
  dialog.addEventListener('cancel', (e) => { e.preventDefault(); closeModal(); });

  document.body.style.overflow = 'hidden';
  document.body.appendChild(dialog);
  dialog.showModal();
  requestAnimationFrame(() => closeBtn.focus());
}
