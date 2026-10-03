/**
 * components/DiagnosticsPanel.js
 * Dev/evaluator tool showing real async counters.
 *
 * Spec (UI_UX_SPEC §5.10, AC-DG):
 *   - Opens via ?debug=1 in URL, footer toggle, or Ctrl+Shift+D.
 *   - Never shows tokens or credential-bearing URLs.
 *   - All numbers come from real events (not hard-coded).
 *   - Reset button zeroes all counters.
 *
 * The panel is always in the DOM but toggled with the `hidden` attribute.
 */

import { h, setText, setVisible } from '../utils/dom.js';
import { DEBOUNCE_MS, TMDB_MODE } from '../config.js';

/**
 * Create the diagnostics panel and bind it to the diagnostics event bus.
 *
 * @param {{ subscribe: Function, reset: Function, snapshot: Function }} diag
 * @returns {{ el: HTMLElement, open: Function, close: Function, toggle: Function }}
 */
export function DiagnosticsPanel(diag) {
  // ── Build the panel DOM ────────────────────────────────────────────────

  const panel = h('aside', {
    class: 'diag-panel',
    role: 'region',
    'aria-label': 'Search diagnostics',
  });
  panel.hidden = true;

  const title = h('h2');
  setText(title, 'Search Diagnostics');
  title.addEventListener('click', () => {
    panel.classList.toggle('expanded');
  });

  panel.appendChild(title);

  // Helper to create a labelled row.
  function makeRow(label, id) {
    const row = h('div', { class: 'diag-row' });
    const labelEl = h('span', { class: 'label' });
    setText(labelEl, label);
    const valueEl = h('span', { id });
    setText(valueEl, '—');
    row.appendChild(labelEl);
    row.appendChild(valueEl);
    panel.appendChild(row);
    return valueEl;
  }

  // Row elements — each is a <span> whose textContent we update.
  const rows = {
    query:     makeRow('Query:', 'diag-query'),
    status:    makeRow('Status:', 'diag-status'),
    requestId: makeRow('Request ID:', 'diag-req-id'),
    prevStatus:makeRow('Previous:', 'diag-prev'),
    ms:        makeRow('Response ms:', 'diag-ms'),
    results:   makeRow('Results:', 'diag-results'),
  };

  const div1 = h('hr', { class: 'diag-divider' });
  panel.appendChild(div1);

  const rows2 = {
    keystrokes:    makeRow('Keystrokes:', 'diag-ks'),
    validKs:       makeRow('Valid keystrokes:', 'diag-vks'),
    requests:      makeRow('API Requests:', 'diag-req'),
    timersCreated: makeRow('Timers created:', 'diag-tc'),
    timersCancelled: makeRow('Timers cancelled:', 'diag-tcanc'),
    prevented:     makeRow('Prevented:', 'diag-prev-req'),
    aborted:       makeRow('Aborted:', 'diag-aborted'),
    stale:         makeRow('Stale discarded:', 'diag-stale'),
    cacheHits:     makeRow('Cache hits:', 'diag-cache'),
    mode:          makeRow('Mode:', 'diag-mode'),
    debounce:      makeRow('Debounce ms:', 'diag-debounce'),
  };

  const div2 = h('hr', { class: 'diag-divider' });
  panel.appendChild(div2);

  // Action buttons.
  const actions = h('div', { class: 'diag-actions' });
  const resetBtn = h('button', { class: 'btn btn-secondary', type: 'button' });
  setText(resetBtn, 'Reset');
  resetBtn.addEventListener('click', () => diag.reset());

  const closeBtn = h('button', { class: 'btn btn-ghost', type: 'button' });
  setText(closeBtn, 'Close');
  closeBtn.addEventListener('click', close);

  actions.appendChild(resetBtn);
  actions.appendChild(closeBtn);
  panel.appendChild(actions);

  // ── Static values ────────────────────────────────────────────────────────
  setText(rows2.mode.el || rows2.mode, TMDB_MODE);
  setText(rows2.debounce.el || rows2.debounce, String(DEBOUNCE_MS));

  // ── Subscribe to counter updates ─────────────────────────────────────────

  diag.subscribe((snap) => {
    const lr = snap.lastRequest;

    const safeText = (el, val) => setText(el, val !== null && val !== undefined ? String(val) : '—');

    safeText(rows.query,      lr.query || '—');
    safeText(rows.status,     lr.status || '—');
    safeText(rows.requestId,  lr.id ? `#${lr.id}` : '—');
    safeText(rows.ms,         lr.ms !== null ? `${Math.round(lr.ms)} ms` : '—');
    safeText(rows.results,    lr.results !== null ? String(lr.results) : '—');

    safeText(rows2.keystrokes,     snap.keystrokes);
    safeText(rows2.validKs,        snap.validKeystrokes);
    safeText(rows2.requests,       snap.apiRequests);
    safeText(rows2.timersCreated,  snap.timersCreated);
    safeText(rows2.timersCancelled, snap.timersCancelled);
    safeText(rows2.prevented,      snap.prevented);
    safeText(rows2.aborted,        snap.aborted);
    safeText(rows2.stale,          snap.staleDiscarded);
    safeText(rows2.cacheHits,      snap.cacheHits);

    // Static values only need setting once, but doing it on subscribe is harmless.
    setText(rows2.mode,     TMDB_MODE);
    setText(rows2.debounce, String(DEBOUNCE_MS));
  });

  // ── Panel controls ───────────────────────────────────────────────────────

  function open() { setVisible(panel, true); }
  function close() { setVisible(panel, false); }
  function toggle() { panel.hidden ? open() : close(); }

  // Auto-open if ?debug=1 is in the URL.
  if (typeof window !== 'undefined'
      && new URLSearchParams(window.location.search).get('debug') === '1') {
    open();
  }

  // Keyboard shortcut: Ctrl+Shift+D.
  document.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.shiftKey && e.key === 'D') {
      e.preventDefault();
      toggle();
    }
  });

  return { el: panel, open, close, toggle };
}
