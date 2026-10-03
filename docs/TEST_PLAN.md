# TEST_PLAN — Cinesift

Tools: Vitest (unit), manual with Chrome DevTools (Network throttling, offline, Request blocking), mock mode (`?mock=1`), Lighthouse, axe DevTools, keyboard-only pass, one real phone.

Test IDs: `E-` edge, `D-` debounce, `R-` race, `F-` functional, `A-` a11y, `V-` responsive.

## 1. Debounce tests

### D-1 Rapid typing "batman" (primary)
- Setup: debug panel open, Network tab cleared, Preserve log on, mock or real.
- Action: type `batman` continuously (~100–150 ms/key), then stop.
- Expected measurements:

| Metric | Expected |
|---|---|
| Input events | 6 |
| Valid keystrokes (≥2 chars) | 5 |
| Timers created | 5 |
| Timers cancelled | 4 |
| Timers fired | 1 |
| API requests (search) | 1 (query=batman) |
| Cancelled requests | 0 |
| Requests prevented (panel) | 4 |
| Request start time | ≈ 300 ms (+ scheduling jitter) after last keystroke |

- Failure: ≥2 search requests for one continuous burst; request starts before 300 ms of quiet; request has partial query.

### D-2 Pause mid-word
Type `bat`, wait 600 ms, type `man`. Expected: request for `bat` fires at ~300 ms; typing `m` supersedes it (aborted if still in flight, or discarded if finished), final request `batman`; UI ends at batman. Requests: 2, aborted ≤1.

### D-3 Unit: debounce util (fake timers)
1. 10 calls within 100 ms → `fn` called once with last args after 300 ms.
2. Call, advance 299 ms, call again → no execution until 300 ms after second call.
3. `cancel()` → never executes.
4. `flush()` → executes immediately once; later timer doesn't fire again.
5. `pending()` accurate.
6. Two independent debounced instances don't share timers.

### D-4 Enter bypass
Type `incep`, press Enter within 300 ms. Expected: immediate request, timer cancelled, exactly 1 request; pressing Enter again quickly (same query) → duplicate skipped.

### D-5 Timer hygiene on navigation
Type `bat`, within 300 ms click Watchlist link. Expected: no request fires after route change; no state writes (check console for errors).

### D-6 IME / composition
Use IME (e.g., Japanese/Hindi input) – while composing, no requests; after commit, one request.

## 2. Race-condition tests

### R-1 Slow older, fast newer (mock mode — deterministic)
Mock latencies: `bat`=1800 ms, `batman`=250 ms. Type `bat`, wait 350 ms (request A starts), type `man`, wait 350 ms (request B starts).
Expected: B resolves @~600 ms and renders batman results; A is aborted (Network: `(canceled)`) — and **even if the abort were removed**, the UI must not switch to `bat` results at 1800 ms. Diagnostics: Aborted ≥1; Previous Request = Cancelled.
Failure: UI shows bat results after batman; flicker; error toast.

### R-2 Verify layer 2 independently
Dev flag `?noabort=1` makes `requestManager` skip `controller.abort()` (test-only). Repeat R-1 → A resolves late → `stale_discarded` increments; UI stays on B. Proves the ID guard works alone. (Remove or gate flag from production build.)

### R-3 Unit: out-of-order resolution
Fake service returns deferred promises. Start A, start B, resolve B then A. Assert final state `query==='batman'`, results from B, A ignored.

### R-4 Clear during flight
Type `batman`, as request is in flight delete all text. Expected: state `idle`, request aborted/invalidated, late response ignored, Home content visible.

### R-5 Stale error
A (slow) fails after B succeeded (mock `fail` for A). Expected: no error UI.

### R-6 Details lane
Open movie A (slow), Back, open movie B (fast). Expected: B displayed; A never overwrites.

### R-7 Load More vs new search
Click Load More (slow), then immediately search a different query. Expected: old page-2 results never appended to new list.

### R-8 Double Retry
Force error, click Retry twice quickly. Expected: 1 effective request, no duplicate items.

### R-9 Slow network
DevTools "Slow 3G". Expected: skeleton visible; timeout at 10 s → timeout error with Retry; typing during load supersedes.

## 3. Edge-case matrix

| ID | Case | Setup | Action | Expected | Failure condition |
|---|---|---|---|---|---|
| E-1 | Empty query | Home | Focus, press Enter | No request; stays idle; maybe hint | Request with `query=` |
| E-2 | Spaces only | — | Type `"    "` | Treated as empty; idle; no request | Request sent; "No results for ' '" |
| E-3 | 1 character | — | Type `b` | No request; hint "Type at least 2 characters" | Request fired |
| E-4 | Very long query | — | Paste 500 chars | Input capped at 100 (`maxlength`); single request OK or no crash | UI overflow; 414 error unhandled |
| E-5 | Special chars | — | `batman & robin`, `ünïcode`, `<script>`, `%`, `"`, `#` | Properly URL-encoded (`URLSearchParams`); results/empty; no HTML injection; echo uses textContent | Broken URL; script executes; layout break |
| E-6 | Rapid typing | See D-1 | | 1 request | >1 |
| E-7 | Rapid query changes | See R-1 | | Latest wins | Stale shown |
| E-8 | Duplicate query | Search `batman` (success) | Retype same / add trailing space | No new request (duplicate skipped); results unchanged | New request / flicker |
| E-9 | Slow network | Slow 3G | Search | Skeleton; eventual results or timeout state | Infinite skeleton |
| E-10 | Disconnection | DevTools Offline | Search | `network` ErrorState + Retry; regains when back online and Retry | Blank area; crash |
| E-11 | API failure 5xx | Mock `fail` or block request | Search | `server` ErrorState, input editable | Raw JSON/stack shown |
| E-12 | Malformed data | Mock returns `{results: null}` / items missing id | Search | `malformed` error or bad items dropped; no crash | TypeError in console, blank UI |
| E-13 | Zero results | `zzqxjkv` | Search | EmptyState with query echo, input focused | Blank; error styling; skeleton stuck |
| E-14 | Missing poster | Result with `poster_path:null` | View grid | Fallback art same aspect | Broken image icon; layout shift |
| E-15 | Broken poster URL | Block `image.tmdb.org` | View grid | Fallback appears on `error` | Broken icons |
| E-16 | Missing backdrop | Movie w/o backdrop | Open details | Flat header, layout intact | Empty gap/overlap text |
| E-17 | Missing trailer | Movie without YouTube video | Open details | Disabled trailer button + visible text | Button opens empty modal |
| E-18 | Missing cast | Movie with empty credits | Open details | Cast section hidden | Empty heading |
| E-19 | Empty gallery | No backdrops | Open details | Gallery hidden | Empty heading/grid |
| E-20 | localStorage corrupt | `localStorage['cinesift:watchlist:v1']='{oops'` | Reload, open Watchlist | Recovered to empty, toast once, no crash, can add items | White screen; infinite error |
| E-21 | localStorage unavailable | Block storage / sandbox / override `Storage.prototype.setItem` to throw | Add to watchlist | Works in-memory; notice shown | Uncaught exception; button does nothing silently |
| E-22 | Duplicate watchlist add | Add movie, then inject same id via two tabs/rapid double-click | | Single entry | Two entries |
| E-23 | Remove nonexistent | Call `remove(999999)` | | No-op, no throw | Exception / wrong item removed |
| E-24 | Refresh on details | `/movie/27205` | F5 | Same movie renders (host rewrite works) | 404 from host; blank |
| E-25 | Direct URL (bad id) | `/movie/abc`, `/movie/0`, `/movie/99999999` | Open | Validation → "Movie not found" (no request for `abc`) | Request with NaN; crash |
| E-26 | Mobile layout | 360×640 & 320×568 | Walk all pages | No horizontal scroll; targets ≥44px | Overflow; clipped hero |
| E-27 | Keyboard nav | Keyboard only | Search → open card → trailer → close → watchlist | Logical order, visible focus, no traps; Esc closes | Lost focus; trap |
| E-28 | Modal close | Open trailer | Esc / ✕ / backdrop | Closes; playback stops; focus returns to trigger | Audio continues; focus lost |
| E-29 | Share unsupported | Desktop browser w/o `navigator.share` | Click Share | Clipboard copy + toast | Nothing happens |
| E-30 | Clipboard failure | Deny clipboard/insecure context | Click Share | Manual-copy dialog with selected URL | Silent failure |
| E-31 | Rate limit | Mock 429 w/ `Retry-After: 3` | Search | Message with countdown; Retry enabled after | Auto-loop of retries |
| E-32 | Filters + pagination | Search, Load More ×2, then change genre | | page resets to 1; list replaced | Mixed old/new items |
| E-33 | Back/forward | Search batman → open movie → Back | | Search restored from URL (cache hit → instant) | Empty page; lost query |
| E-34 | Paste | Paste `batman` into empty input | | One debounced request | Zero (event missed) or per-char |
| E-35 | Clear via ✕ / Esc | Results visible | Clear input | idle; request invalidated | Old results linger |

## 4. Functional tests

| ID | Feature | Test | Pass |
|---|---|---|---|
| F-1 | Search success | Search `inception` | Grid ≥1 cards; count text; history saved |
| F-2 | Card → details | Click card (not heart) | Route `/movie/:id`; hero loads |
| F-3 | Heart toggle on card | Click heart | Watchlist toggles; no navigation |
| F-4 | Watchlist persistence | Add 2, refresh | Still there, order newest first |
| F-5 | Remove + Undo | Remove then Undo within 5 s | Restored in place |
| F-6 | History | Search 10 distinct queries | Only 8 newest; dedupe case-insensitive; Clear all works |
| F-7 | Trending | Open Home | 12 cards; failure → inline retry only |
| F-8 | Filters (browse) | Genre + min rating + sort | Server params in request; results sorted |
| F-9 | Filters (search) | Search + genre | Client-filter; note shown; counts accurate |
| F-10 | Load More | Click until end | Appends w/o duplicates; button disappears at last page |
| F-11 | Trailer | Open + close | Embed loads; closes properly |
| F-12 | Similar | Click similar movie | New details; scroll top; focus h1 |
| F-13 | Gallery | Open, ←/→, Esc | Works; counter updates |
| F-14 | Share | Click | Native sheet or "Link copied" |
| F-15 | Router | Navigate all routes, Back/Forward | Correct pages; title updates |
| F-16 | URL state | Open `/search?q=batman&genre=28` fresh tab | State restored; single request |
| F-17 | Diagnostics | Toggle | Counts match D-1 |
| F-18 | Key security | Search bundle/network for token (direct mode excluded) | Proxy mode: no token in bundle/requests from browser |

## 5. Responsive tests (V-)
Widths 320, 360, 414, 600, 768, 960, 1280, 1920; portrait/landscape on phone. Check header wraps, grid columns per matrix, details layout, filters sheet, modals, diagnostics drawer, no overflow, text ≥14 px.

## 6. Accessibility tests (A-)
1. Keyboard-only complete journey (E-27).
2. Visible focus on every interactive element.
3. axe: 0 serious/critical on Home, Search (success/empty/error), Details, Watchlist.
4. Screen reader: typing a query announces **one** result summary (not per keystroke); empty state announced; modal announces title; focus returns.
5. Zoom 200 % & text spacing: no loss.
6. `prefers-reduced-motion: reduce` → no shimmer/transform.
7. Contrast spot-check: muted text, disabled button text, placeholder.

## 7. Performance checks
- Lighthouse mobile: Performance ≥ 85 (realistic with TMDB images), CLS < 0.1 (aspect-ratio boxes), LCP image not lazy-loaded (hero/first row `fetchpriority=high` for first 2–4).
- Bundle: no large dependencies; JS < ~100 KB gz.
- Network: details = 1 request (+images); search results page = 1 request; no per-card detail calls.

## 8. Regression gate before demo
D-1, R-1, R-2, E-13, E-10, E-24, F-4, F-17 must pass on the **deployed** build, on both a laptop and a phone, on the venue-like network.
