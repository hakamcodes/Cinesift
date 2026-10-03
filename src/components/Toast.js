/**
 * components/Toast.js
 * Bottom-center (mobile) / bottom-right (desktop) toast notifications.
 *
 * Spec (UI_UX_SPEC §5.6):
 *   - role=status, auto-dismiss 3s (5s with Undo).
 *   - Pause on hover/focus.
 *   - Max 1 visible (replace existing).
 *   - Used for: watchlist add/remove(+Undo), link copied, share failed, storage unavailable.
 *
 * Usage: showToast({ message, type?, undo? })
 *   - type: 'info' | 'warn' | 'success' (default 'info')
 *   - undo: { label, onClick } — if present, shows Undo button and 5s delay
 */

import { h, setText } from '../utils/dom.js';

let toastEl = null;
let dismissTimer = null;

/**
 * Ensure the toast root container exists in the DOM.
 * @returns {HTMLElement}
 */
function getRoot() {
  let root = document.getElementById('toast-root');
  if (!root) {
    root = h('div', { id: 'toast-root', 'aria-live': 'polite', 'aria-atomic': 'true' });
    document.body.appendChild(root);
  }
  return root;
}

/**
 * Show a toast notification.
 *
 * @param {{ message: string, type?: string, undo?: { label: string, onClick: Function } }} opts
 */
export function showToast({ message, type = 'info', undo = null }) {
  const root = getRoot();

  // Dismiss any existing toast immediately.
  if (toastEl) {
    clearTimeout(dismissTimer);
    toastEl.remove();
    toastEl = null;
  }

  const el = h('div', {
    class: `toast toast-${type}`,
    role: 'status',
    'aria-live': 'polite',
  });

  const textEl = h('span', { class: 'toast-message' });
  setText(textEl, message);
  el.appendChild(textEl);

  if (undo) {
    const undoBtn = h('button', { class: 'toast-undo btn btn-ghost', type: 'button' });
    setText(undoBtn, undo.label || 'Undo');
    undoBtn.addEventListener('click', () => {
      undo.onClick();
      dismiss();
    });
    el.appendChild(undoBtn);
  }

  const delay = undo ? 5000 : 3000;
  let isPaused = false;
  let remaining = delay;
  let startTime = Date.now();

  function dismiss() {
    clearTimeout(dismissTimer);
    el.classList.add('toast-out');
    setTimeout(() => {
      el.remove();
      if (toastEl === el) toastEl = null;
    }, 300);
  }

  function startTimer() {
    dismissTimer = setTimeout(dismiss, remaining);
    startTime = Date.now();
  }

  function pauseTimer() {
    if (isPaused) return;
    isPaused = true;
    clearTimeout(dismissTimer);
    remaining -= Date.now() - startTime;
  }

  function resumeTimer() {
    if (!isPaused) return;
    isPaused = false;
    startTimer();
  }

  el.addEventListener('mouseenter', pauseTimer);
  el.addEventListener('mouseleave', resumeTimer);
  el.addEventListener('focusin', pauseTimer);
  el.addEventListener('focusout', resumeTimer);

  root.appendChild(el);
  toastEl = el;
  startTimer();

  // Animate in.
  requestAnimationFrame(() => el.classList.add('toast-in'));
}
