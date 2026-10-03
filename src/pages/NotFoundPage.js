/**
 * pages/NotFoundPage.js
 * 404 page.
 */

import { h, setText } from '../utils/dom.js';

export function mount(params, container) {
  document.title = 'Page Not Found — Cinesift';
  
  const error = h('div', { class: 'container error-state' });
  const icon = h('div', { class: 'error-state-icon', 'aria-hidden': 'true' });
  setText(icon, '🧭');
  const h2 = h('h1', { tabindex: '-1' });
  setText(h2, 'Page not found');
  const p = h('p');
  setText(p, "We couldn't find the page you're looking for.");
  
  const link = h('a', { href: '/', class: 'btn btn-primary', 'data-link': '' });
  setText(link, 'Go to Homepage');
  
  error.appendChild(icon);
  error.appendChild(h2);
  error.appendChild(p);
  error.appendChild(link);
  
  container.appendChild(error);
}

export function unmount() {
  document.title = 'Cinesift';
}
