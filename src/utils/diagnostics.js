/**
 * utils/diagnostics.js
 * Lightweight event bus for async counters used by the diagnostics panel.
 *
 * How it works:
 *   - Other modules call `diag.emit('event_name', payload)` at key points.
 *   - This module tallies counters and lets the panel subscribe for updates.
 *   - No logic lives here — only counting and notifying.
 *
 * Counter definitions match STATE_AND_ASYNC_FLOW §7 and AC-DG-2.
 */

/**
 * Create a diagnostics instance.
 * One instance is created in main.js and passed to requestManager and searchController.
 *
 * @returns {{
 *   emit: (event: string, payload?: object) => void,
 *   snapshot: () => object,
 *   reset: () => void,
 *   subscribe: (fn: Function) => Function
 * }}
 */
export function createDiagnostics() {
  // All counters start at zero.
  let counts = freshCounts();

  // Details about the most recent request (shown in the panel header).
  let lastRequest = {
    id: 0,
    query: '',
    status: '—',       // SUCCESS | ERROR | ABORTED | STALE
    ms: null,
    results: null,
  };

  // Subscriber callbacks — notified whenever state changes.
  const subscribers = new Set();

  /** Reset all counters to zero. */
  function reset() {
    counts = freshCounts();
    lastRequest = { id: 0, query: '', status: '—', ms: null, results: null };
    notify();
  }

  /**
   * Emit a diagnostic event.
   * @param {string} event
   * @param {object} [payload]
   */
  function emit(event, payload = {}) {
    switch (event) {
      // Input events
      case 'keystroke':
        counts.keystrokes++;
        break;
      case 'valid_keystroke':
        counts.validKeystrokes++;
        break;

      // Timer events (from debounce hooks)
      case 'timer_created':   // onSchedule
        counts.timersCreated++;
        break;
      case 'timer_cancelled': // onCancel
        counts.timersCancelled++;
        break;
      case 'timer_fired':     // onFire
        counts.timersFired++;
        break;

      // Request lifecycle events (from requestManager)
      case 'request_start':
        counts.apiRequests++;
        lastRequest.id = payload.id;
        lastRequest.query = payload.query || '';
        lastRequest.status = 'PENDING';
        break;
      case 'request_abort':
        counts.aborted++;
        lastRequest.status = 'ABORTED';
        break;
      case 'request_success':
        lastRequest.status = 'SUCCESS';
        lastRequest.ms = payload.ms ?? null;
        lastRequest.results = payload.count ?? null;
        break;
      case 'request_error':
        lastRequest.status = 'ERROR';
        lastRequest.ms = payload.ms ?? null;
        break;
      case 'stale_discarded':
        counts.staleDiscarded++;
        break;

      // Other events
      case 'cache_hit':
        counts.cacheHits++;
        break;
      case 'duplicate_skipped':
        counts.duplicatesSkipped++;
        break;

      default:
        // Ignore unknown events — future-proof.
        break;
    }
    notify();
  }

  /**
   * Returns a frozen snapshot of current counters + last-request info.
   * @returns {object}
   */
  function snapshot() {
    return Object.freeze({
      ...counts,
      // Derived counter: valid keystrokes that didn't become requests.
      prevented: Math.max(0, counts.validKeystrokes - counts.apiRequests),
      lastRequest: { ...lastRequest },
    });
  }

  /**
   * Subscribe to counter updates.
   * @param {Function} fn - Called with a snapshot whenever state changes.
   * @returns {Function} unsubscribe function
   */
  function subscribe(fn) {
    subscribers.add(fn);
    // Call immediately so the subscriber gets the current state.
    fn(snapshot());
    return () => subscribers.delete(fn);
  }

  /** Notify all subscribers with the latest snapshot. */
  function notify() {
    const snap = snapshot();
    for (const fn of subscribers) fn(snap);
  }

  return { emit, snapshot, reset, subscribe };
}

/** Returns a fresh zero-valued counter object. */
function freshCounts() {
  return {
    keystrokes:       0,
    validKeystrokes:  0,
    timersCreated:    0,
    timersCancelled:  0,
    timersFired:      0,
    apiRequests:      0,
    aborted:          0,
    staleDiscarded:   0,
    cacheHits:        0,
    duplicatesSkipped: 0,
  };
}
