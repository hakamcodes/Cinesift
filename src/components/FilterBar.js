/**
 * components/FilterBar.js
 * Shows the filter options (genre, year, min rating, sort) and filter notice.
 */

import { h, setText } from '../utils/dom.js';

export function FilterBar({ filters, onFilterChange, isClientSide, genresMap }) {
  const container = h('div', { class: 'filter-bar' });
  
  if (isClientSide) {
    const note = h('p', { class: 'filter-notice' });
    setText(note, 'Filters apply to loaded results only during text search.');
    container.appendChild(note);
  }

  const controls = h('div', { class: 'filter-controls' });

  // Genre select
  const genreSelect = h('select', { 'aria-label': 'Genre' });
  genreSelect.appendChild(h('option', { value: '' }, 'All Genres'));
  genresMap.forEach((name, id) => {
    const opt = h('option', { value: id.toString() });
    setText(opt, name);
    if (filters.genre === id) opt.selected = true;
    genreSelect.appendChild(opt);
  });
  controls.appendChild(genreSelect);

  // Year input
  const yearInput = h('input', { 
    type: 'number', 
    placeholder: 'Year', 
    min: '1900', 
    max: '2100',
    'aria-label': 'Release Year'
  });
  if (filters.year) yearInput.value = filters.year;
  controls.appendChild(yearInput);

  // Min Rating select
  const ratingSelect = h('select', { 'aria-label': 'Minimum Rating' });
  ratingSelect.appendChild(h('option', { value: '0' }, 'Any Rating'));
  [5, 6, 7, 8].forEach(r => {
    const opt = h('option', { value: r.toString() });
    setText(opt, `${r}+ Stars`);
    if (filters.minRating === r) opt.selected = true;
    ratingSelect.appendChild(opt);
  });
  controls.appendChild(ratingSelect);

  // Sort select
  const sortSelect = h('select', { 'aria-label': 'Sort By' });
  const sorts = [
    { val: 'popularity.desc', label: 'Most Popular' },
    { val: 'vote_average.desc', label: 'Highest Rated' },
    { val: 'primary_release_date.desc', label: 'Newest First' },
    { val: 'original_title.asc', label: 'Title (A-Z)' },
  ];
  sorts.forEach(s => {
    const opt = h('option', { value: s.val });
    setText(opt, s.label);
    if (filters.sort === s.val) opt.selected = true;
    sortSelect.appendChild(opt);
  });
  controls.appendChild(sortSelect);

  const apply = () => {
    onFilterChange({
      genre: genreSelect.value ? parseInt(genreSelect.value, 10) : null,
      year: yearInput.value ? parseInt(yearInput.value, 10) : null,
      minRating: parseInt(ratingSelect.value, 10) || 0,
      sort: sortSelect.value
    });
  };

  genreSelect.addEventListener('change', apply);
  yearInput.addEventListener('change', apply);
  ratingSelect.addEventListener('change', apply);
  sortSelect.addEventListener('change', apply);

  container.appendChild(controls);
  return container;
}
