/**
 * components/LoadMoreButton.js
 */

import { h, setText } from '../utils/dom.js';

export function LoadMoreButton({ onClick, loading }) {
  const btn = h('button', { 
    class: 'btn btn-secondary load-more-btn', 
    type: 'button',
    disabled: loading ? 'true' : null
  });
  setText(btn, loading ? 'Loading...' : 'Load More');
  
  btn.addEventListener('click', () => {
    if (!loading) onClick();
  });
  
  return btn;
}
