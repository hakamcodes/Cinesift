/**
 * tests/normalizeQuery.test.js
 * Unit tests for utils/normalizeQuery.js
 */

import { describe, it, expect } from 'vitest';
import { normalizeQuery, isValidQuery } from '../src/utils/normalizeQuery.js';

describe('normalizeQuery', () => {

  it('trims leading and trailing whitespace', () => {
    expect(normalizeQuery('  batman  ')).toBe('batman');
    expect(normalizeQuery('\t hello \n')).toBe('hello');
  });

  it('collapses inner whitespace to a single space', () => {
    expect(normalizeQuery('bat  man')).toBe('bat man');
    expect(normalizeQuery('the   dark  knight')).toBe('the dark knight');
  });

  it('truncates to MAX_QUERY (100) characters', () => {
    const long = 'a'.repeat(200);
    expect(normalizeQuery(long)).toHaveLength(100);
  });

  it('preserves case (lowercasing is the caller\'s job)', () => {
    expect(normalizeQuery('Batman')).toBe('Batman');
    expect(normalizeQuery('THE DARK KNIGHT')).toBe('THE DARK KNIGHT');
  });

  it('returns empty string for blank input', () => {
    expect(normalizeQuery('')).toBe('');
    expect(normalizeQuery('   ')).toBe('');
  });

  it('handles special characters without throwing', () => {
    expect(() => normalizeQuery('<script>alert(1)</script>')).not.toThrow();
    expect(() => normalizeQuery('batman & robin')).not.toThrow();
    expect(normalizeQuery('%20test')).toBe('%20test');
  });
});

describe('isValidQuery', () => {

  it('returns false for empty string', () => {
    expect(isValidQuery('')).toBe(false);
  });

  it('returns false for 1-character string', () => {
    expect(isValidQuery('b')).toBe(false);
  });

  it('returns true for 2-character string', () => {
    expect(isValidQuery('ba')).toBe(true);
  });

  it('returns true for normal queries', () => {
    expect(isValidQuery('batman')).toBe(true);
    expect(isValidQuery('the dark knight')).toBe(true);
  });

  it('returns true for exactly MAX_QUERY length', () => {
    expect(isValidQuery('a'.repeat(100))).toBe(true);
  });
});
