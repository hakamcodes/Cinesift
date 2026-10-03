/**
 * tests/normalisers.test.js
 * Unit tests for the TMDB adapter normalisers.
 *
 * Tests (from STATE_AND_ASYNC_FLOW §10 + ACCEPTANCE_CRITERIA):
 *   - normaliseMovieSummary: nulls, missing ids, empty release dates.
 *   - normalisePage: missing results array throws malformed error.
 *   - Rating null when voteCount=0.
 *   - Items missing id are dropped.
 */

import { describe, it, expect } from 'vitest';
import { normaliseMovieSummary, normalisePage } from '../src/services/tmdbAdapter.js';
import { AppError, ErrorCategory } from '../src/services/errors.js';

describe('normaliseMovieSummary', () => {

  it('maps a standard TMDB result correctly', () => {
    const raw = {
      id: 550,
      title: 'Fight Club',
      original_title: 'Fight Club',
      poster_path: '/pB8BM7.jpg',
      release_date: '1999-10-15',
      vote_average: 8.433,
      vote_count: 26279,
      genre_ids: [18, 53],
      original_language: 'en',
      overview: 'An insomniac and a soap salesman.',
    };

    const result = normaliseMovieSummary(raw);

    expect(result.id).toBe(550);
    expect(result.title).toBe('Fight Club');
    expect(result.posterPath).toBe('/pB8BM7.jpg');
    expect(result.releaseDate).toBe('1999-10-15');
    expect(result.year).toBe(1999);
    expect(result.rating).toBe(8.4);   // one decimal
    expect(result.voteCount).toBe(26279);
    expect(result.genreIds).toEqual([18, 53]);
    expect(result.language).toBe('en');
  });

  it('returns null (drops item) when id is missing', () => {
    expect(normaliseMovieSummary({ title: 'No ID' })).toBeNull();
    expect(normaliseMovieSummary(null)).toBeNull();
    expect(normaliseMovieSummary(undefined)).toBeNull();
  });

  it('sets rating=null when vote_count=0 (shows NR)', () => {
    const raw = {
      id: 1,
      title: 'New Film',
      vote_average: 0,
      vote_count: 0,
    };
    const result = normaliseMovieSummary(raw);
    expect(result.rating).toBeNull();
  });

  it('sets releaseDate=null and year=null when release_date is empty string', () => {
    const raw = { id: 2, title: 'Old Film', release_date: '' };
    const result = normaliseMovieSummary(raw);
    expect(result.releaseDate).toBeNull();
    expect(result.year).toBeNull();
  });

  it('sets posterPath=null when poster_path is null', () => {
    const raw = { id: 3, title: 'No Poster', poster_path: null };
    const result = normaliseMovieSummary(raw);
    expect(result.posterPath).toBeNull();
  });

  it('defaults genreIds to [] when genre_ids is missing', () => {
    const raw = { id: 4, title: 'No Genres' };
    const result = normaliseMovieSummary(raw);
    expect(result.genreIds).toEqual([]);
  });

  it('falls back to original_title → "Untitled" when title is missing', () => {
    const withOriginal = { id: 5, original_title: 'La Película', poster_path: null };
    expect(normaliseMovieSummary(withOriginal).title).toBe('La Película');

    const noTitle = { id: 6 };
    expect(normaliseMovieSummary(noTitle).title).toBe('Untitled');
  });

  it('returns a frozen (immutable) object', () => {
    const raw = { id: 7, title: 'Test' };
    const result = normaliseMovieSummary(raw);
    expect(() => { result.title = 'changed'; }).toThrow();
  });
});

describe('normalisePage', () => {

  it('maps the TMDB page envelope correctly', () => {
    const json = {
      page: 1,
      total_pages: 5,
      total_results: 100,
      results: [{ id: 1, title: 'A', vote_count: 10, vote_average: 7.0 }],
    };

    const result = normalisePage(json);
    expect(result.page).toBe(1);
    expect(result.totalPages).toBe(5);
    expect(result.totalResults).toBe(100);
    expect(result.items).toHaveLength(1);
    expect(result.items[0].id).toBe(1);
  });

  it('drops items without an id', () => {
    const json = {
      page: 1, total_pages: 1, total_results: 3,
      results: [
        { id: 1, title: 'Valid' },
        { title: 'No ID' },          // should be dropped
        { id: null, title: 'Null ID' }, // should be dropped
        { id: 2, title: 'Also Valid' },
      ],
    };

    const result = normalisePage(json);
    expect(result.items).toHaveLength(2);
    expect(result.items.map(i => i.id)).toEqual([1, 2]);
  });

  it('throws AppError(malformed) when results is not an array', () => {
    expect(() => normalisePage({ results: null })).toThrow(AppError);
    expect(() => normalisePage({ results: 'string' })).toThrow(AppError);
    expect(() => normalisePage({})).toThrow(AppError);

    // Check the category.
    try {
      normalisePage({ results: null });
    } catch (e) {
      expect(e.category).toBe(ErrorCategory.MALFORMED);
    }
  });

  it('returns an empty items array for empty results', () => {
    const result = normalisePage({ page: 1, total_pages: 0, total_results: 0, results: [] });
    expect(result.items).toHaveLength(0);
  });
});
