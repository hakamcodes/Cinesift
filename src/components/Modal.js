/**
 * components/Modal.js
 * Native <dialog> modal wrapper.
 *
 * Spec (UI_UX_SPEC §5.7):
 *   - Uses showModal() for built-in focus trap, Esc, and inert background.
 *   - aria-labelledby points to title element.
 *   - Focus to close button on open.
 *   - Restore focus to trigger on close.
 *   - Close on Esc (native), backdrop click, ✕ button.
 *   - Lock body scroll on open.
 */

import { h, setText } from '../utils/dom.js';

/**
 * Create a modal dialog.
 *
 * @param {{
 *   id?: string,
 *   title?: string,
 *   content: HTMLElement,
 *   onClose?: Function,
 *   className?: string,
 * }} opts
 * @returns {{ dialog: HTMLDialogElement, open: Function, close: Function }}
 */
export function Modal({ id, title, content, onClose, className = '' }) {
  const titleId = id ? `${id}-title` : `modal-title-${Date.now()}`;

  const dialog = h('dialog', {
    class: `modal ${className}`,
    'aria-labelledby': title ? titleId : null,
    'aria-modal': 'true',
  });

  // Header.
  const header = h('div', { class: 'modal-header' });

  if (title) {
    const titleEl = h('h2', { id: titleId, class: 'modal-title' });
    setText(titleEl, title);
    header.appendChild(titleEl);
  }

  const closeBtn = h('button', {
    class: 'modal-close btn btn-ghost',
    type: 'button',
    'aria-label': 'Close',
  });
  setText(closeBtn, '✕');
  header.appendChild(closeBtn);

  const body = h('div', { class: 'modal-body' });
  body.appendChild(content);

  dialog.appendChild(header);
  dialog.appendChild(body);

  /** @type {Element|null} */
  let trigger = null;

  function openModal(triggerEl = null) {
    trigger = triggerEl || document.activeElement;
    document.body.style.overflow = 'hidden';
    document.body.appendChild(dialog);
    dialog.showModal();
    // Focus the close button (UI_UX_SPEC §5.7).
    requestAnimationFrame(() => closeBtn.focus());
  }

  function closeModal() {
    dialog.close();
    document.body.style.overflow = '';
    dialog.remove();
    // Restore focus to trigger element.
    if (trigger && typeof trigger.focus === 'function') {
      trigger.focus();
    }
    onClose?.();
  }

  closeBtn.addEventListener('click', closeModal);

  // Close on backdrop click.
  dialog.addEventListener('click', (e) => {
    if (e.target === dialog) closeModal();
  });

  // Native Esc is handled by <dialog> but we need to clean up.
  dialog.addEventListener('cancel', (e) => {
    e.preventDefault();
    closeModal();
  });

  return { dialog, open: openModal, close: closeModal };
}
