import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as storage from '../src/utils/storage.js';

describe('storage utility', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('reads and writes JSON successfully', () => {
    storage.set('test-key', { a: 1 });
    expect(storage.get('test-key')).toEqual({ a: 1 });
  });

  it('returns fallback if key does not exist', () => {
    expect(storage.get('missing-key', [])).toEqual([]);
  });

  it('returns fallback and removes key if JSON is corrupt', () => {
    localStorage.setItem('corrupt-key', '{bad-json');
    expect(storage.get('corrupt-key', [])).toEqual([]);
    expect(localStorage.getItem('corrupt-key')).toBeNull();
  });

  it('handles quota exceeded errors gracefully', () => {
    const setItemMock = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      const err = new Error('Quota exceeded');
      err.name = 'QuotaExceededError';
      throw err;
    });

    // Should not throw, should return false
    const result = storage.set('big-key', { data: 'too-big' });
    expect(result).toBe(false);
  });
});
