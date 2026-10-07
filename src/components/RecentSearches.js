/**
 * components/RecentSearches.js
 * Shows recent search chips from historyStore.
 */

import { h, setText } from '../utils/dom.js';
import * as historyStore from '../state/historyStore.js';

export function RecentSearches({ onSelect }) {
  const container = h('div', { class: 'recent-searches' });
  
  const render = (state) => {
    container.innerHTML = '';
    if (state.items.length === 0) return;
    
    const header = h('div', { class: 'recent-header' });
    const title = h('h3');
    setText(title, 'Recent Searches');
    const clearBtn = h('button', { class: 'btn-ghost btn-sm', type: 'button' });
    setText(clearBtn, 'Clear all');
    clearBtn.addEventListener('click', () => historyStore.clear());
    header.appendChild(title);
    header.appendChild(clearBtn);
    container.appendChild(header);
    
    const chips = h('div', { class: 'empty-state-suggestions' }); // reusing suggestion chip styles
    state.items.forEach(item => {
      const chip = h('button', { class: 'suggestion-chip', type: 'button' });
      const text = h('span');
      setText(text, item.q);
      
      const removeBtn = h('span', { class: 'chip-remove', 'aria-label': `Remove ${item.q}` });
      setText(removeBtn, ' ✕');
      removeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        historyStore.removeOne(item.q);
      });
      
      chip.appendChild(text);
      chip.appendChild(removeBtn);
      
      chip.addEventListener('click', () => {
        onSelect(item.q);
      });
      chips.appendChild(chip);
    });
    container.appendChild(chips);
  };
  
  const unsub = historyStore.subscribe(render);
  
  // Expose cleanup
  container._cleanup = unsub;
  return container;
}
