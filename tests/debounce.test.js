/**
 * tests/debounce.test.js
 * Unit tests for utils/debounce.js using Vitest fake timers.
 *
 * Covers TEST_PLAN D-3 and AC-DB-7:
 *   1. N rapid calls → fn called once with last args.
 *   2. Advance 299 ms, call again → no execution until 300 ms after second call.
 *   3. cancel() → zero executions.
 *   4. flush() → immediate execution; original timer doesn't fire again.
 *   5. pending() accurate.
 *   6. Two independent instances don't share timers.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { debounce } from '../src/utils/debounce.js';

describe('debounce', () => {

  beforeEach(() => {
    // Replace real timers with fake ones so we control time.
    vi.useFakeTimers();
  });

  afterEach(() => {
    // Restore real timers after each test.
    vi.useRealTimers();
  });

  it('calls fn once with the LAST args after N rapid calls', () => {
    const fn = vi.fn();
    const debounced = debounce(fn, 300);

    // 10 rapid calls, all within the 300 ms window.
    for (let i = 0; i < 10; i++) {
      debounced('call-' + i);
    }

    // Nothing should have fired yet.
    expect(fn).not.toHaveBeenCalled();

    // Advance time past the debounce delay.
    vi.advanceTimersByTime(301);

    // Should be called exactly once, with the LAST argument.
    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith('call-9');
  });

  it('resets the timer on each call — only fires 300 ms after the LAST call', () => {
    const fn = vi.fn();
    const debounced = debounce(fn, 300);

    debounced('first');
    vi.advanceTimersByTime(299); // almost fired...
    debounced('second');         // resets the timer
    vi.advanceTimersByTime(299); // still not fired

    expect(fn).not.toHaveBeenCalled();

    vi.advanceTimersByTime(2);   // now 301 ms after 'second'

    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith('second');
  });

  it('cancel() prevents the fn from ever being called', () => {
    const fn = vi.fn();
    const debounced = debounce(fn, 300);

    debounced('hello');
    expect(debounced.pending()).toBe(true);

    debounced.cancel();
    expect(debounced.pending()).toBe(false);

    vi.advanceTimersByTime(500);

    expect(fn).not.toHaveBeenCalled();
  });

  it('flush() calls fn immediately and prevents the original timer from firing twice', () => {
    const fn = vi.fn();
    const debounced = debounce(fn, 300);

    debounced('the-arg');
    expect(debounced.pending()).toBe(true);

    debounced.flush();

    // fn should be called immediately.
    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith('the-arg');

    // Advancing time should NOT cause another call.
    vi.advanceTimersByTime(500);
    expect(fn).toHaveBeenCalledTimes(1);

    // pending should be false after flush.
    expect(debounced.pending()).toBe(false);
  });

  it('flush() does nothing when no timer is pending', () => {
    const fn = vi.fn();
    const debounced = debounce(fn, 300);

    // No call made — flush should be a no-op.
    debounced.flush();
    expect(fn).not.toHaveBeenCalled();
  });

  it('pending() returns true while waiting, false after fire', () => {
    const fn = vi.fn();
    const debounced = debounce(fn, 300);

    expect(debounced.pending()).toBe(false);

    debounced('x');
    expect(debounced.pending()).toBe(true);

    vi.advanceTimersByTime(301);
    expect(debounced.pending()).toBe(false);
  });

  it('two independent instances do not share timers', () => {
    const fnA = vi.fn();
    const fnB = vi.fn();
    const dA = debounce(fnA, 300);
    const dB = debounce(fnB, 300);

    dA('a');
    dA.cancel(); // cancel A

    dB('b');
    vi.advanceTimersByTime(301); // B fires

    expect(fnA).not.toHaveBeenCalled(); // A was cancelled
    expect(fnB).toHaveBeenCalledWith('b');
  });

  it('fires the hooks at the right moments', () => {
    const fn = vi.fn();
    const hooks = {
      onSchedule: vi.fn(),
      onCancel:   vi.fn(),
      onFire:     vi.fn(),
    };
    const debounced = debounce(fn, 300, hooks);

    debounced('a');         // onSchedule called
    debounced('b');         // onCancel + onSchedule called again
    expect(hooks.onSchedule).toHaveBeenCalledTimes(2);
    expect(hooks.onCancel).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(301); // onFire called
    expect(hooks.onFire).toHaveBeenCalledTimes(1);
  });
});
