/**
 * utils/debounce.js
 * Trailing-edge debounce with cancel, flush, and pending helpers.
 *
 * "Trailing-edge" means the wrapped function is called only AFTER
 * the caller has been quiet for `wait` ms. Each new call resets the timer.
 *
 * The `hooks` object lets callers receive callbacks for diagnostics:
 *   onSchedule — a new timer was started
 *   onCancel   — a pending timer was cancelled
 *   onFire     — the timer fired and fn is about to be called
 */

/**
 * Creates a debounced version of `fn`.
 *
 * @param {Function} fn   - The function to delay.
 * @param {number}   wait - Milliseconds of quiet required before calling fn.
 * @param {{ onSchedule?: Function, onCancel?: Function, onFire?: Function }} [hooks]
 * @returns {Function & { cancel: Function, flush: Function, pending: Function }}
 */
export function debounce(fn, wait, hooks = {}) {
  // `timer` holds the setTimeout handle, or null when idle.
  let timer = null;
  // `lastArgs` stores the most recent arguments so flush() can use them.
  let lastArgs = null;

  function debounced(...args) {
    lastArgs = args;

    // Cancel any existing timer before starting a new one.
    if (timer !== null) {
      clearTimeout(timer);
      hooks.onCancel?.();   // diagnostics: timersCancelled++
    }

    hooks.onSchedule?.();   // diagnostics: timersCreated++

    // Start a fresh timer. When it fires, call fn with the latest args.
    timer = setTimeout(() => {
      timer = null;
      hooks.onFire?.();     // diagnostics: timersFired++
      const a = lastArgs;
      lastArgs = null;
      fn(...a);
    }, wait);
  }

  /**
   * Cancel the pending timer without calling fn.
   * Safe to call even when there is no pending timer.
   */
  debounced.cancel = () => {
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
      lastArgs = null;
      hooks.onCancel?.();
    }
  };

  /**
   * Execute fn immediately with the latest args, cancelling the timer.
   * Does nothing if no timer is pending.
   */
  debounced.flush = () => {
    if (timer === null) return;
    clearTimeout(timer);
    timer = null;
    hooks.onFire?.();
    const a = lastArgs;
    lastArgs = null;
    fn(...a);
  };

  /**
   * Returns true if a timer is currently waiting to fire.
   * @returns {boolean}
   */
  debounced.pending = () => timer !== null;

  return debounced;
}
