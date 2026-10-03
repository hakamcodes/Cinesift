/**
 * components/EmptyState.js
 * Shown when a search returns 0 results.
 *
 * Spec (UI_UX_SPEC §5.4, AC-ER):
 *   - Echo query in text (via textContent — never innerHTML).
 *   - Distinct from error: neutral tone, no red, no Retry.
 *   - Offer: Clear search button + static suggestion chips.
 *   - `role=status` content announced once via live region.
 */

import { h, setText } from '../utils/dom.js';

/** Static popular titles used as suggestions. Never API-sourced. */
const SUGGESTIONS = ['Inception', 'Parasite', 'Batman', 'Interstellar', 'The Godfather'];

/**
 * Render the EmptyState.
 *
 * @param {{ query: string, onClear: Function, onSuggestion: Function }} opts
 * @returns {HTMLElement}
 */
export function EmptyState({ query, onClear, onSuggestion }) {
  const wrapper = h('div', { class: 'empty-state', role: 'region', 'aria-label': 'No results' });

  // Film-strip emoji as decorative icon.
  const icon = h('div', { class: 'empty-state-icon', 'aria-hidden': 'true' });
  setText(icon, '🎬');

  // Heading — "No movies found for "batman"".
  const heading = h('h1');
  // Build: "No movies found for "" + query + """
  const prefixNode = document.createTextNode('No movies found for \u201c');
  const queryNode = document.createTextNode(query);   // safe: textContent
  const suffixNode = document.createTextNode('\u201d');
  heading.appendChild(prefixNode);
  heading.appendChild(queryNode);
  heading.appendChild(suffixNode);

  // Subtitle hint.
  const hint = h('p');
  setText(hint, 'Check the spelling or try a shorter title.');

  // Clear button.
  const clearBtn = h('button', { class: 'btn btn-secondary', type: 'button' });
  setText(clearBtn, 'Clear search');
  clearBtn.addEventListener('click', onClear);

  // Suggestion chips.
  const tryLabel = h('p');
  setText(tryLabel, 'Try:');

  const chips = h('div', { class: 'empty-state-suggestions', 'aria-label': 'Suggested searches' });
  for (const title of SUGGESTIONS) {
    const chip = h('button', { class: 'suggestion-chip', type: 'button' });
    setText(chip, title);   // safe — static strings
    chip.addEventListener('click', () => onSuggestion(title));
    chips.appendChild(chip);
  }

  wrapper.appendChild(icon);
  wrapper.appendChild(heading);
  wrapper.appendChild(hint);
  wrapper.appendChild(clearBtn);
  wrapper.appendChild(tryLabel);
  wrapper.appendChild(chips);

  return wrapper;
}
