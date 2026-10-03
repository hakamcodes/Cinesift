/**
 * services/requestManager.js
 * Manages in-flight requests per "lane" (named slot).
 *
 * A lane allows exactly ONE active request at a time.
 * Starting a new request on the same lane automatically aborts the previous one
 * and assigns a new monotonically increasing ID.
 *
 * The three defences against race conditions (STATE_AND_ASYNC_FLOW §3.3):
 *   Layer 1: AbortController.abort() on the previous request.
 *   Layer 2: isCurrent(lane, id) guard checked after every await.
 *   Layer 3: Reducer rejects results whose query ≠ state.query (in searchController).
 *
 * Test flag: `?noabort=1` in URL skips the abort call so Layer 2 can be
 * verified independently (R-2 in TEST_PLAN). Remove from production builds
 * by checking `import.meta.env.DEV` or stripping with Vite define.
 */

/** Check the URL once at module load time. */
const SKIP_ABORT = typeof window !== 'undefined'
  && new URLSearchParams(window.location.search).get('noabort') === '1';

/**
 * Create a new request manager.
 *
 * @param {{ emit?: Function }} [diag] - Optional diagnostics instance.
 * @returns {{ run, isCurrent, abort, invalidate }}
 */
export function createRequestManager(diag) {
  /**
   * Map of lane → { id: number, controller: AbortController }
   * @type {Map<string, { id: number, controller: AbortController }>}
   */
  const lanes = new Map();

  /**
   * Start a new request on the given lane.
   * Aborts any previous request on the same lane.
   *
   * @param {string} lane - e.g. 'search', 'details', 'discover'
   * @param {(signal: AbortSignal) => Promise<any>} task - Your fetch logic.
   * @param {{ timeoutMs?: number, query?: string }} [opts]
   * @returns {{ id: number, promise: Promise<{ id, data, ms }>, signal: AbortSignal }}
   */
  function run(lane, task, opts = {}) {
    const { timeoutMs = 10_000, query = '' } = opts;

    const prev = lanes.get(lane);

    // Layer 1: abort the previous request.
    if (prev) {
      if (!SKIP_ABORT) {
        // Abort with a named DOMException so callers can tell it apart from
        // user-triggered aborts and timeouts.
        prev.controller.abort(new DOMException('superseded', 'AbortError'));
      }
      diag?.emit('request_abort', { id: prev.id });
    }

    // Assign a new ID: always increment from whatever was last (or 0).
    const id = (prev?.id ?? 0) + 1;
    const controller = new AbortController();
    lanes.set(lane, { id, controller });

    // Timeout: abort with a distinct reason so we can show a timeout message.
    const timeoutHandle = setTimeout(
      () => controller.abort(new DOMException('timeout', 'TimeoutError')),
      timeoutMs,
    );

    const started = performance.now();
    diag?.emit('request_start', { id, query });

    // Wrap the task promise so it always resolves with { id, data, ms }.
    const promise = task(controller.signal)
      .then((data) => ({ id, data, ms: performance.now() - started }))
      .finally(() => clearTimeout(timeoutHandle));

    return { id, promise, signal: controller.signal };
  }

  /**
   * Returns true if `id` is still the current (latest) request on `lane`.
   * Use this after every `await` in the caller:
   *   const { id, promise } = manager.run(lane, task);
   *   const { data } = await promise;
   *   if (!manager.isCurrent(lane, id)) return; // Layer 2 guard
   *
   * @param {string} lane
   * @param {number} id
   * @returns {boolean}
   */
  function isCurrent(lane, id) {
    return lanes.get(lane)?.id === id;
  }

  /**
   * Abort the current request on a lane (e.g. route unmount).
   * Does NOT bump the ID, so a late resolve would still be "current".
   * Use `invalidate` if you also want to discard late results.
   *
   * @param {string} lane
   */
  function abort(lane) {
    const entry = lanes.get(lane);
    if (entry) {
      entry.controller.abort(new DOMException('cancelled', 'AbortError'));
      diag?.emit('request_abort', { id: entry.id });
    }
  }

  /**
   * Abort AND bump the ID on a lane.
   * Any late resolve will now fail the `isCurrent` check (Layer 2).
   * Must be called when input is cleared or the route unmounts.
   *
   * @param {string} lane
   */
  function invalidate(lane) {
    const entry = lanes.get(lane);
    if (entry) {
      entry.controller.abort();
      // Replace with a dead controller at id+1 — no task is running it.
      lanes.set(lane, { id: entry.id + 1, controller: new AbortController() });
    }
  }

  return { run, isCurrent, abort, invalidate };
}
