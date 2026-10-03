# ARCHITECTURE — Cinesift

## 1. Layer diagram

```
UI (pages + components)            render DOM, emit user intents
        ↓ intents / ↑ state subscriptions
Application State (store)          single source of truth, pub/sub
        ↓
Search Controller                  input → validation → orchestration
        ↓
Debounce Manager                   300 ms timer, cancel/flush, counters
        ↓
Request Manager                    AbortController + requestId + stale guard
        ↓
Movie Service                      app-level API: search, trending, details…
        ↓
API Adapter (tmdbAdapter)          URL building, auth, error mapping, normalise
        ↓
TMDB (or /api proxy, or mock)
```

Local persistence (separate from API path):

```
watchlistStore ──► storage.js (safe JSON, versioned) ──► localStorage
historyStore   ──► storage.js                         ──► localStorage
```

**Rules**
1. UI never imports `tmdbAdapter` or touches `fetch`.
2. Only `requestManager` creates `AbortController`s for search/discover/load-more.
3. Only adapter knows TMDB field names (`poster_path`, `genre_ids`, …).
4. Only `storage.js` calls `localStorage`.
5. Components don't mutate state directly — they call store actions.

## 2. Folder structure (vanilla + Vite)

```
cinesift/
├─ index.html
├─ vite.config.js
├─ .env.example            # VITE_TMDB_MODE=proxy|direct|mock, VITE_TMDB_TOKEN= (dev only)
├─ .gitignore              # .env, .env.local, node_modules, dist
├─ netlify.toml / _redirects   # SPA fallback + function redirect
├─ netlify/functions/tmdb.js   # optional proxy (holds secret)
├─ public/
│  └─ fallback-poster.svg
├─ src/
│  ├─ main.js              # boot: config, store, router, shell
│  ├─ config.js            # DEBOUNCE_MS=300, MIN_QUERY=2, MAX_QUERY=100, PAGE caps, TTLs
│  ├─ router/
│  │  └─ router.js         # route table, navigate(), popstate, link interception
│  ├─ state/
│  │  ├─ store.js          # createStore(), subscribe, setState
│  │  ├─ searchState.js    # search machine reducer + selectors
│  │  ├─ watchlistStore.js
│  │  └─ historyStore.js
│  ├─ controllers/
│  │  └─ searchController.js
│  ├─ services/
│  │  ├─ movieService.js   # public API for UI/controllers
│  │  ├─ tmdbAdapter.js    # vendor-specific
│  │  ├─ mockAdapter.js    # fixtures + artificial latency (race demo)
│  │  ├─ requestManager.js
│  │  ├─ cache.js          # small LRU+TTL Map
│  │  └─ errors.js         # AppError, categories
│  ├─ utils/
│  │  ├─ debounce.js
│  │  ├─ storage.js
│  │  ├─ dom.js            # h(), qs(), delegate(), setText()
│  │  ├─ format.js         # year, runtime, rating, image URL builder
│  │  ├─ normalizeQuery.js
│  │  └─ diagnostics.js    # counters + event bus (dev/eval)
│  ├─ pages/
│  │  ├─ HomePage.js  SearchPage.js  MovieDetailsPage.js  WatchlistPage.js  NotFoundPage.js
│  ├─ components/
│  │  ├─ Header.js SearchBar.js MovieCard.js MovieGrid.js SkeletonGrid.js
│  │  ├─ EmptyState.js ErrorState.js FilterBar.js LoadMoreButton.js
│  │  ├─ RecentSearches.js Suggestions.js CastList.js SimilarRow.js
│  │  ├─ TrailerModal.js GalleryLightbox.js Modal.js Toast.js DiagnosticsPanel.js
│  │  └─ ImageWithFallback.js
│  └─ styles/
│     ├─ tokens.css base.css layout.css components.css pages.css utilities.css
└─ tests/                   # vitest unit tests: debounce, requestManager, storage, adapter
```

### Module reference

| Module | Purpose | Inputs | Outputs | Depends on | Key functions |
|---|---|---|---|---|---|
| `config.js` | Constants in one place | — | frozen object | — | `DEBOUNCE_MS` |
| `debounce.js` | Trailing debounce w/ cancel+flush+pending | `fn, wait, hooks` | wrapped fn | diagnostics (optional hooks) | `debounce()`, `.cancel()`, `.flush()`, `.pending()` |
| `requestManager.js` | One active "lane" per key; abort previous; ID guard | `lane, (signal)=>Promise` | `{id, promise}` / stale marker | diagnostics | `run(lane, task)`, `isCurrent(lane,id)`, `abort(lane)` |
| `tmdbAdapter.js` | Build requests, map errors, normalise | params + `signal` | `MovieSummary[]` / `MovieDetails` | fetch, config | `search`, `discover`, `trending`, `details`, `genres`, `configuration` |
| `movieService.js` | Stable app API; caching; fallback to defaults | params + `signal` | normalised data | adapter, cache | same names, vendor-agnostic |
| `searchController.js` | Bridge input ↔ debounce ↔ requestManager ↔ state | DOM events, URL params | state transitions | all above | `onInput`, `onSubmit`, `loadMore`, `applyFilters`, `retry`, `restoreFromUrl` |
| `store.js` | Tiny observable store | initial state | `getState/setState/subscribe` | — | |
| `storage.js` | Safe localStorage | key, default, validator | parsed value | — | `readJSON`, `writeJSON`, `isAvailable` |
| `router.js` | Map path → page; manage history | URL | mounted page | pages | `navigate`, `replace`, `start` |
| `diagnostics.js` | Counters, last-request info | events | snapshot | — | `emit`, `subscribe`, `snapshot`, `reset` |

## 3. State model (summary; full machine in STATE_AND_ASYNC_FLOW)

```js
state = {
  search: {
    status: 'idle'|'debouncing'|'loading'|'success'|'empty'|'error',
    rawInput: '',            // exactly what user typed
    query: '',               // normalised, committed to the active request
    committedQuery: '',      // last query whose results are displayed
    filters: { genre: null, year: null, minRating: 0, sort: 'relevance' },
    page: 1, totalPages: 0, totalResults: 0,
    results: [],             // MovieSummary[]
    loadingMore: false,
    error: null,             // {category, message, retryable}
    requestId: 0,            // latest issued
  },
  discovery: { status, trending: [], error },
  details:   { status, movieId, data, sections: { cast, videos, images, similar } , error },
  watchlist: { items: [], available: true },
  history:   { items: [], available: true },
  ui:        { modal: null, toast: null, diagnosticsOpen: false },
}
```

`AbortController` instances and timer handles are **not** in the store (non-serialisable, not render inputs). They live inside `requestManager` / `debounce` closures. Diagnostics reads them via events.

## 4. Request lifecycle (search)

1. `input` event → `searchController.onInput(raw)`
2. Update `rawInput`; compute `normalised = normalizeQuery(raw)`.
3. Invalid (empty / < MIN) → `debounced.cancel()`, `requestManager.abort('search')`, status → `idle` (+ hint for 1 char). **No request.**
4. Valid → status → `debouncing`; `debounced(normalised)` (resets timer).
5. After 300 ms quiet → `executeSearch(normalised, page=1)`:
   a. If `normalised === committedQuery` && filters same && status `success` → skip (duplicate).
   b. If cache hit (fresh) → commit from cache (no request).
   c. `requestManager.run('search', signal => movieService.search(params, signal))` → returns `{id}` and abort previous.
   d. status → `loading`.
6. On resolve: `if (!requestManager.isCurrent('search', id)) return;` (**stale guard**) → normalise already done in adapter → results.length ? `success` : `empty`; update `committedQuery`, history.
7. On reject: `AbortError` → ignore silently. Else if current → `error`.
8. `finally`: only clear loading flags if current.

See STATE_AND_ASYNC_FLOW for code and sequence diagrams.

## 5. Movie details lifecycle

```
Route /movie/:id → validate id (positive integer)
 → abort previous details lane → status 'loading' (skeleton)
 → movieService.details(id, signal)   // one call: details + credits + videos + images + similar
 → adapter normalises; each optional section defaults to [] / null
 → status 'success' → render hero immediately; sections render if non-empty
 → 404 → NotFound-style "Movie not found"; network → ErrorState with retry
```

Navigating Details A → Back → Details B uses the **same** `details` lane, so slow A can't overwrite B.

## 6. Router

| Route | Page | Params |
|---|---|---|
| `/` | HomePage | — |
| `/search` | SearchPage | `q, genre, year, rating, sort, page` (optional) |
| `/movie/:id` | MovieDetailsPage | `id` |
| `/watchlist` | WatchlistPage | — |
| `*` | NotFoundPage | — |

- Link interception: `a[data-link]` click → `preventDefault` + `navigate`. Respect modifier keys (Ctrl/⌘/middle-click open new tab).
- `popstate` → re-resolve route. Pages expose `mount(params)` and `unmount()`; **unmount must abort lanes and cancel debounce** owned by the page.
- Typing in search: `history.replaceState` (keeps Back usable). Enter / history item / suggestion click: `pushState`.
- On `/search` load with `?q=`: `restoreFromUrl()` → skip debounce, call `executeSearch` directly once.
- Hosting: SPA fallback (`/* /index.html 200`).

## 7. Error taxonomy

| Category | Source | Retryable | UI copy (short) |
|---|---|---|---|
| `network` | `fetch` TypeError / offline | ✔ | "You appear to be offline." |
| `timeout` | internal 10 s `AbortSignal.timeout`/timer | ✔ | "Request took too long." |
| `rate_limit` | HTTP 429 | ✔ after delay (`Retry-After` if present) | "Too many requests. Try again shortly." |
| `server` | HTTP 5xx | ✔ | "Movie service is having trouble." |
| `auth` | HTTP 401 | ✘ | "API key rejected" (dev message; generic in prod) |
| `not_found` | HTTP 404 | ✘ | "Movie not found." |
| `malformed` | JSON parse error / missing `results` array | ✔ (once) | "Unexpected response." |
| `aborted` | our own abort | — (never shown) | — |

Timeout vs user-abort must be distinguishable: use a distinct reason (`controller.abort(new DOMException('timeout','TimeoutError'))` or a local flag) so the catch block can tell them apart.

## 8. Cache (small, optional but cheap)

- Map key: `search:${query}|${year}|${page}` (filters applied client-side aren't in the key).
- LRU 30 entries, TTL 5 min. Returns structured-cloned or frozen data.
- Purpose: Back navigation and repeat queries don't re-request. **Not** a substitute for the race guard (cached commits still go through the same `requestId` flow).

## 9. Diagnostics hooks

Hook points (emit events only; no logic in hot path):
`input` (keystroke) · `timer_created` · `timer_cancelled` · `timer_fired` · `request_start{id,query}` · `request_abort{id}` · `request_success{id,ms,count}` · `request_error{id,category}` · `stale_discarded{id}` · `cache_hit` · `duplicate_skipped`.

`diagnostics.js` aggregates counters; the panel subscribes. Disabled by default in production unless `?debug=1` or toggled (Ctrl+Shift+D).

## 10. Build/Env

| Mode | `VITE_TMDB_MODE` | Behaviour |
|---|---|---|
| Local dev | `direct` | Adapter calls `https://api.themoviedb.org/3` with token from `.env.local` (never committed) |
| Deployed | `proxy` | Adapter calls `/api/tmdb?path=…`; serverless function adds `Authorization` header |
| Offline demo / tests | `mock` | `mockAdapter` with fixtures + configurable latency per query (e.g. `bat`=1500 ms, `batman`=200 ms) to make race reproducible |

## 11. Tooling

Vite, Vitest (utils only), ESLint + Prettier (optional), Lighthouse for final audit. No other runtime dependencies required.
