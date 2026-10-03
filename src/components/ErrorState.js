/**
 * components/ErrorState.js
 * Shown when a search request fails.
 *
 * Spec (UI_UX_SPEC §5.5, AC-LS-4):
 *   - Categorised message (from AppError.userMessage).
 *   - Retry button when error is retryable.
 *   - NOT shown for AbortError (those are silent).
 *   - Distinct from empty state: red icon, Retry button.
 */

import { h, setText } from '../utils/dom.js';

/**
 * Render the ErrorState component.
 *
 * @param {{ error: { userMessage: string, retryable: boolean }, onRetry: Function }} opts
 * @returns {HTMLElement}
 */
export function ErrorState({ error, onRetry }) {
  const wrapper = h('div', { class: 'error-state', role: 'region', 'aria-label': 'Search error' });

  // Error icon.
  const icon = h('div', { class: 'error-state-icon', 'aria-hidden': 'true' });
  setText(icon, '⚠️');

  // Heading.
  const heading = h('h1');
  setText(heading, 'Search failed');

  // User-friendly message (from our fixed message table — never raw server text).
  const msg = h('p');
  setText(msg, error?.userMessage || 'Something went wrong.');

  wrapper.appendChild(icon);
  wrapper.appendChild(heading);
  wrapper.appendChild(msg);

  // Retry button — only when retryable.
  if (error?.retryable) {
    const retryBtn = h('button', { class: 'btn btn-primary', type: 'button' });
    setText(retryBtn, 'Try again');
    retryBtn.addEventListener('click', onRetry);
    wrapper.appendChild(retryBtn);
  }

  return wrapper;
}
