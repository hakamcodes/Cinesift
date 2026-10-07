/**
 * utils/dom.js
 * Tiny DOM helpers so components stay readable without a framework.
 *
 * Rules: never put user/API text into innerHTML — use textContent.
 */

/**
 * Query a single element inside a root (or document).
 * @param {string} selector
 * @param {Element|Document} [root=document]
 * @returns {Element|null}
 */
export function qs(selector, root = document) {
  return root.querySelector(selector);
}

/**
 * Set textContent safely (no XSS from API/user text).
 * @param {Element} el
 * @param {string} text
 */
export function setText(el, text) {
  el.textContent = text;
}

/**
 * Show or hide an element using the hidden attribute.
 * @param {Element} el
 * @param {boolean} visible
 */
export function setVisible(el, visible) {
  el.hidden = !visible;
}

/**
 * Create a DOM element with optional attributes and children.
 *
 * @param {string} tag
 * @param {object} [attrs] - HTML attributes; class maps to className.
 * @param {...(string|Node)} children
 * @returns {HTMLElement}
 *
 * @example
 *   h('div', { class: 'card' }, h('p', {}, 'Hello'))
 */
export function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === null || v === undefined) continue;
    if (k === 'class') el.className = v;
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else el.setAttribute(k, v);
  }
  for (const child of children) {
    if (typeof child === 'string') {
      el.appendChild(document.createTextNode(child)); // safe — no innerHTML
    } else if (child instanceof Node) {
      el.appendChild(child);
    }
  }
  return el;
}

