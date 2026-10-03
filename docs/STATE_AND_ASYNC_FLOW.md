# STATE_AND_ASYNC_FLOW — Debounce, cancellation, race prevention

This is the most important document. If time is short, implement exactly this and nothing else first.

## 1. Vocabulary

| Term | Meaning here |
|---|---|
| Keystroke | Any `input` event on the search box (includes paste, delete) |
| Normalised query | `trim()` + collapse inner whitespace + max 100 chars. Case preserved for display, `toLowerCase()` for comparison/cache |
| Valid query | normalised length ≥ 2 (`MIN_QUERY`) and ≤ 100 |
| Lane | A named slot allowing one active request at a time (`'search'`, `'details'`, `'discover'`) |
| Committed query | Query whose results are currently on screen |
| Request ID | Integer from a per-lane counter, incremented on every new request |

## 2. Debounce

### 2.1 Definition
Trailing-edge debounce: call the function only after `wait` ms have passed **with no new calls**. Each new call cancels the pending timer and starts a new one.

### 2.2 Spec

| Question | Decision |
|---|---|
| Event | `input` on `#search` (not `keyup` — misses paste/IME/mobile; not `change` — fires on blur) |
| Delay | `DEBOUNCE_MS = 300` in `config.js` (single constant, referenced everywhere) |
| Timer starts | After each **valid** input |
| Timer cleared | On next input; on invalid input; on Enter (flushed); on filter click; on route unmount; on suggestion/history selection |
| API call occurs | In timer callback only (`executeSearch`) |
| Trim | Always, before validity check and before request |
| Empty input | Cancel timer, abort in-flight, state → `idle`, show Home content / recent searches, **no request** |
| 1 char | Cancel timer, abort in-flight, state → `idle` + hint "Type at least 2 characters" (aria-live polite) |
| Very long | Truncate at 100 chars for the request (input itself not truncated, `maxlength=100` attribute prevents anyway) |
| Duplicate | If normalised (lowercased) query + filters equal `committedQuery` and status is `success|empty` → skip (count `duplicate_skipped`) |
| Enter key | `flush()`: cancel timer, run immediately (still goes through the same request manager) |
| IME composition | Ignore `input` events while `isComposing` is true; run on `compositionend` |
| Why not throttle | Throttle fires at regular intervals *during* typing (partial queries `ba`, `batm`), wasting requests; we want the final intent only |
| Why 300 ms | Mandated; also typical inter-key gap for average typists is ~100–250 ms, so 300 ms usually spans a burst while still feeling responsive |

### 2.3 Implementation (reference)

```js
// utils/debounce.js
export function debounce(fn, wait, hooks = {}) {
  let timer = null, lastArgs = null;

  function debounced(...args) {
    lastArgs = args;
    if (timer !== null) { clearTimeout(timer); hooks.onCancel?.(); }
    hooks.onSchedule?.();
    timer = setTimeout(() => {
      timer = null;
      hooks.onFire?.();
      const a = lastArgs; lastArgs = null;
      fn(...a);
    }, wait);
  }
  debounced.cancel = () => {
    if (timer !== null) { clearTimeout(timer); timer = null; lastArgs = null; hooks.onCancel?.(); }
  };
  debounced.flush = () => {
    if (timer === null) return;
    clearTimeout(timer); timer = null;
    const a = lastArgs; lastArgs = null;
    hooks.onFire?.();
    fn(...a);
  };
  debounced.pending = () => timer !== null;
  return debounced;
}
```

Hooks feed diagnostics: `onSchedule` → `timersCreated++`; `onCancel` → `timersCancelled++`; `onFire` → `timersFired++`.
Test must prove: N rapid calls → fn called once with **last** args; `cancel()` → zero calls; `flush()` → immediate call; timer reuse doesn't leak.

### 2.4 Timeline (typing "batman", 120 ms between keys, then pause)

```
t(ms)  event            timer state                         requests
0      input "b"        invalid (<2) → idle                 —
120    input "ba"       schedule T1 (fires @420)            —
240    input "bat"      cancel T1, schedule T2 (@540)       —
360    input "batm"     cancel T2, schedule T3 (@660)       —
480    input "batma"    cancel T3, schedule T4 (@780)       —
600    input "batman"   cancel T4, schedule T5 (@900)       —
900    T5 fires         executeSearch("batman")             Req #1 sent
```
Keystrokes: 6 · valid timers created: 5 · timers cancelled: 4 · requests: 1.
**Diagnostics definition:** `Requests Prevented = validKeystrokes − requestsSent` = 5 − 1 = **4**. (Do **not** count the invalid first keystroke as "prevented" unless you label it separately — be exact; evaluators may check.)

Pause > 300 ms mid-word (`bat` ... 500 ms ... `man`): Req for `bat` fires at +300; typing `batm` afterwards aborts it (if still in flight) → race path (§3).

## 3. Race condition

### 3.1 Problem
Requests A (`bat`) and B (`batman`) are in flight. Network doesn't guarantee order. If B returns first and A returns later, naive code does `render(A)`, leaving screen showing `bat` results under a box that says `batman`.

Root causes: (1) async completion order ≠ start order; (2) shared mutable "results" state written by whichever callback finishes last; (3) the debounce doesn't help when pauses exceed 300 ms.

### 3.2 Why debounce alone is not enough
Debounce limits **how often** requests start. It doesn't control **which response is allowed to write state**. A 300 ms pause followed by a slow request, then more typing, produces overlapping requests.

### 3.3 Three layers of defence

| Layer | Mechanism | Stops |
|---|---|---|
| 1 | `AbortController.abort()` on previous request when starting new one | Frees connection; browser rejects the old `fetch` promise with `AbortError`; prevents processing of obsolete body |
| 2 | **Request ID guard**: `if (id !== latestId) return;` after every `await` | Late resolutions that slipped through (response already fully received, or adapter code that ignores `signal`, cache returns) |
| 3 | **Committed-query guard** in reducer: reducer accepts `RESULTS_SUCCESS` only if `action.query === state.query` (the currently intended query) | Any logic bug in 1 & 2; belt-and-braces; makes state machine pure-testable |

Note on honesty: abort cancels the *client's* wait/processing; the server may already be doing the work and TMDB may still count the request. Abort saves bandwidth/CPU/latency, not necessarily server load.

### 3.4 Request Manager

```js
// services/requestManager.js
export function createRequestManager(diag) {
  const lanes = new Map(); // lane -> { id, controller }

  function run(lane, task, { timeoutMs = 10000 } = {}) {
    const prev = lanes.get(lane);
    if (prev) { prev.controller.abort(new DOMException('superseded', 'AbortError')); diag?.emit('request_abort', { id: prev.id }); }

    const id = (prev?.id ?? 0) + 1;
    const controller = new AbortController();
    lanes.set(lane, { id, controller });

    const timer = setTimeout(() => controller.abort(new DOMException('timeout', 'TimeoutError')), timeoutMs);
    const started = performance.now();
    diag?.emit('request_start', { id });

    const promise = task(controller.signal)
      .then((data) => ({ id, data, ms: performance.now() - started }))
      .finally(() => clearTimeout(timer));

    return { id, promise, signal: controller.signal };
  }

  const isCurrent = (lane, id) => lanes.get(lane)?.id === id;
  const abort = (lane) => { const l = lanes.get(lane); if (l) { l.controller.abort(new DOMException('cancelled', 'AbortError')); } };
  // Bumping id on abort-without-replacement invalidates any late result:
  const invalidate = (lane) => { const l = lanes.get(lane); if (l) { l.controller.abort(); lanes.set(lane, { id: l.id + 1, controller: new AbortController() }); } };

  return { run, isCurrent, abort, invalidate };
}
```

Invalid input (empty/1 char) must call `invalidate('search')` — **not just** `abort` — so a late response from before the clear can't resurrect old results.

### 3.5 Search controller (reference)

```js
async function executeSearch(query, page = 1, { append = false } = {}) {
  const params = { query, page, year: state.filters.year };
  const cached = cache.get(cacheKey(params));
  setState({ status: append ? state.status : 'loading', query, error: null, loadingMore: append });

  const { id, promise } = requestManager.run('search', (signal) =>
    cached ? Promise.resolve(cached) : movieService.search(params, signal));

  try {
    const { data, ms } = await promise;
    if (!requestManager.isCurrent('search', id)) {           // layer 2
      diag.emit('stale_discarded', { id }); return;
    }
    dispatch({ type: 'SEARCH_SUCCESS', query, page, data, ms }); // layer 3 inside reducer
  } catch (err) {
    if (err.name === 'AbortError') return;                    // our own cancel — silent
    if (!requestManager.isCurrent('search', id)) return;      // stale failure must not show error
    dispatch({ type: 'SEARCH_ERROR', query, error: toAppError(err) });
  } finally {
    // do NOT unconditionally clear loading flags here; reducer clears them on current-request outcomes only
  }
}
```

**Classic bugs this avoids (put in viva notes):**
1. Showing an error toast for `AbortError`.
2. `finally { setLoading(false) }` from stale request hides loader of the active request.
3. Not invalidating when input is cleared.
4. Using a global boolean `isLoading` instead of per-request identity.
5. Stale **error** overwriting fresh results.
6. Load More of old query appending to new query's list (guarded by `query` + `page` match in reducer).

### 3.6 Sequence diagram — normal race (abort works)

```
User        Controller        RequestMgr          Network
 | "bat"       |                  |                  |
 |------------>| (300ms quiet)    |                  |
 |             |--run(search)---->| id=1, ctrl1      |
 |             |                  |----GET bat------>|
 | "batman"    |                  |                  |
 |------------>| (300ms quiet)    |                  |
 |             |--run(search)---->| abort ctrl1 ✖    |
 |             |                  | id=2, ctrl2      |
 |             |                  |----GET batman--->|
 |             |<-- AbortError(1)-|  (ignored)       |
 |             |<----- data(2)----|<-----200---------|
 |             |  isCurrent(2)? yes → SEARCH_SUCCESS |
 |<--- render batman results                         |
```

### 3.7 Sequence diagram — abort too late (response already received)

```
 run(1) ....... response 1 body fully received ──┐
 run(2) starts → abort(1) has no effect           │ promise(1) resolves in microtask queue
 await promise(1) resumes  →  isCurrent('search',1)? NO (latest=2) → stale_discarded
 data(2) arrives → isCurrent(2)? yes → render
```

### 3.8 Sequence diagram — adapter ignores signal / cache path

```
 cache returns (Promise.resolve) for query A while request B started later → id guard discards A.
```

### 3.9 Failure scenarios

| Scenario | Expected |
|---|---|
| A slow, B fast | B shown; A discarded/aborted; no flicker back |
| A fast, B slow, user clears input before B returns | `invalidate` → B discarded; Home/idle stays |
| A fails after B succeeded | A's error ignored |
| B fails, A had succeeded earlier | `error` for B shown (A's results no longer relevant); Retry re-runs B |
| Navigate away mid-request | `unmount()` → `invalidate` all lanes + `debounced.cancel()`; no state write after unmount |
| Double-click Retry | Second `run` aborts first; only one request effective |
| Timeout | Treated as `timeout` error **only if** still current; else ignored |

## 4. State machine (search)

States: `idle` · `debouncing` · `loading` · `success` · `empty` · `error`
(+ flag `loadingMore` inside `success` for pagination, so the grid doesn't disappear.)

```
                    input valid                   timer fires
        ┌──────────────────────────┐        ┌──────────────────┐
        │                          ▼        │                  ▼
     [idle] ◄──── input invalid ─ [debouncing] ──────────► [loading]
        ▲  ▲                          ▲                       │  │  │
        │  │       input (any)        │                       │  │  └── 0 results ──► [empty]
        │  └──────────────────────────┘                       │  └───── ≥1 results ─► [success]
        │                                                     └──────── failure ────► [error]
        │
   (from success/empty/error too: input invalid → idle; input valid → debouncing)

  success/empty/error ── Retry / filter change / Enter ──► [loading]
  success ── Load More ──► success(loadingMore=true) ──► success | success + inline error
  [loading] ── input valid ──► [debouncing]   (abort in-flight, ignore its outcome)
```

### 4.1 Transition table

| From | Event | Guard | To | Side effects |
|---|---|---|---|---|
| any | `INPUT_INVALID` | — | `idle` | cancel timer, `invalidate('search')`, clear page |
| any | `INPUT_VALID` | — | `debouncing` | (re)schedule timer; **do not** clear results yet (avoid flash) |
| `debouncing` | `TIMER_FIRED` | query ≠ committed or filters changed | `loading` | `run('search')` |
| `debouncing` | `TIMER_FIRED` | duplicate of committed & success/empty | previous (`success`/`empty`) | skip request, count duplicate |
| `loading` | `SEARCH_SUCCESS` | id current & query matches | `success` if items>0 else `empty` | update results, push history (non-empty only), emit metrics |
| `loading` | `SEARCH_ERROR` | id current & query matches | `error` | store category |
| `loading` | `INPUT_VALID` | — | `debouncing` | abort happens when next `run` starts (or immediately via `abort`) |
| `success` | `LOAD_MORE` | `page < totalPages` & not `loadingMore` | `success` (+`loadingMore`) | `run('search', page+1)` |
| `success` | `LOAD_MORE_SUCCESS` | id current, same query, `page === state.page+1` | `success` | append w/ dedupe by id |
| `success` | `LOAD_MORE_ERROR` | id current | `success` + inline error row w/ Retry | keep existing items |
| `error`/`empty`/`success` | `RETRY` | — | `loading` | `run` |
| any | `FILTER_CHANGED` | — | `loading` | cancel timer, page=1, run immediately |
| any | `ROUTE_LEAVE` | — | unchanged (reset on next mount) | cancel timer, invalidate lanes |

### 4.2 What the UI shows per state

| State | Results area | Input | Allowed actions |
|---|---|---|---|
| `idle` (no query) | Home content / recent searches | enabled | type, pick recent, open trending |
| `idle` (1 char) | Hint under input | enabled | type |
| `debouncing` | **Keep previous content**; subtle "typing" indicator optional (thin bar) | enabled | continue typing, Enter (flush) |
| `loading` | Skeleton grid (8–12 cards); `aria-busy=true` | enabled | type (supersedes), Esc |
| `success` | Movie grid + count + Load More | enabled | all |
| `empty` | EmptyState (query echoed) | enabled, focused | edit, clear, pick suggestion |
| `error` | ErrorState + Retry | enabled | retry, edit |

Why keep old content during `debouncing`: replacing with skeleton on every keystroke defeats the purpose of debounce and causes flicker. Skeleton appears only when a request actually starts.

## 5. Other lanes

| Lane | Starts on | Aborts on | Notes |
|---|---|---|---|
| `search` | debounced input, Enter, retry, filter, load more | new search, invalid input, route leave | |
| `discover` | Browse mode filters | filter change, route leave | Shares reducer shape with search |
| `details` | route `/movie/:id` mount | new details mount, route leave | Prevent A→B overwrite when quickly clicking Back then another movie |
| `home` | HomePage mount (trending + genres) | route leave | Independent; failure doesn't affect search |

## 6. Duplicate-request prevention

| Case | Mechanism |
|---|---|
| Same query typed again | duplicate guard vs `committedQuery` |
| Query seen recently | LRU cache (5 min) |
| Double Retry click | `loading` → disable button; manager aborts older anyway |
| React-style double-mount / route reload | `restoreFromUrl` runs once per mount; `unmount` invalidates |
| Load More double click | `loadingMore` flag disables button; guard in reducer |

## 7. Per-search diagnostics fields

```
Query · Debounce · Request ID · Previous (Cancelled|Success|Error|—) · Current status ·
Response ms · Results count · Keystrokes · Valid keystrokes · Timers created/cancelled ·
API requests · Aborted · Stale discarded · Cache hits · Duplicates skipped · Prevented
```
Definitions are exact (see §2.4). Counters reset via "Reset" button.

## 8. Pagination

- Reset on: new committed query, filter change, retry-from-error-of-page-1, route re-entry.
- Load More: `page = state.page + 1`; request carries `query` and `page`; reducer accepts only if `query === state.query && page === state.page + 1`.
- Append with `Map` dedupe by `id` (TMDB pages can overlap when ranking shifts).
- Hide button when `page >= totalPages` or after hitting API max page; show "End of results".
- Failure during Load More keeps existing items; inline "Couldn't load more. Retry".
- Focus management: after Load More, keep focus on the button; announce "20 more results loaded" in live region.

## 9. Live region strategy (a11y)

One visually-hidden `div[role=status][aria-live=polite][aria-atomic=true]`. Update **only** on terminal states (`success`, `empty`, `error`) → "20 results for batman", "No results for xyz", "Search failed". Never on `debouncing`/`loading` ticks. Clear text before setting same string again so repeats announce.

## 10. Test hooks

Expose `window.__cinesift = { diagnostics, requestManager }` only when debug is on. Vitest tests use fake timers for debounce and a controllable fake `movieService` returning deferred promises (resolve out-of-order on purpose).

Must-have unit tests:
1. 6 rapid calls → 1 execution, last arg.
2. `flush` executes immediately; `cancel` prevents.
3. Out-of-order resolution: resolve B then A → state shows B.
4. Abort rejects with `AbortError` and no error state.
5. `invalidate` then late resolve → ignored.
6. Stale error ignored.
7. Load More with mismatched `query/page` rejected.
8. Duplicate query skipped.

## 11. If using React instead

```js
useEffect(() => {
  if (!valid(debouncedQuery)) { setStatus('idle'); return; }
  const ctrl = new AbortController();
  let active = true;                      // layer-2 equivalent
  setStatus('loading');
  movieService.search(debouncedQuery, ctrl.signal)
    .then(d => { if (active) { setData(d); setStatus(d.items.length ? 'success':'empty'); } })
    .catch(e => { if (e.name !== 'AbortError' && active) setStatus('error'); });
  return () => { active = false; ctrl.abort(); };
}, [debouncedQuery, filters]);
```
Keep the same three layers; the effect cleanup *is* the abort. Debounce the **value** with a custom `useDebouncedValue(value, 300)` (write it yourself).
