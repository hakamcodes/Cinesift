# ACCEPTANCE_CRITERIA — Cinesift

Format: **AC-ID** — Given / When / Then. Each criterion is binary-testable. "≈300 ms" = 300 ms + normal browser timer scheduling (typically < 20 ms drift; measure with `performance.now()`, tolerate ≤ 50 ms).

## P0 — Search core

### Debounce (AC-DB)
- **AC-DB-1** Given the user types 6 characters of `batman` with < 300 ms between keystrokes, when they stop, then exactly **1** search request is sent, with `query=batman`.
- **AC-DB-2** After the last valid keystroke, the request starts no earlier than 300 ms and (on an idle main thread) no later than ~350 ms.
- **AC-DB-3** `DEBOUNCE_MS` is defined once (`config.js`) and equals `300`; no other literal `300` governs search timing.
- **AC-DB-4** Each new valid keystroke cancels the previous pending timer (timersCancelled increments; no two timers pending simultaneously).
- **AC-DB-5** Pressing Enter cancels the pending timer and runs the search immediately, producing exactly one request.
- **AC-DB-6** Navigating away with a pending timer results in zero requests after unmount.
- **AC-DB-7** The `debounce` utility has unit tests for: last-args-wins, cancel, flush, pending, reset-on-new-call.

### Query validation (AC-QV)
- **AC-QV-1** Empty/whitespace-only/1-character input sends **0** requests and moves state to `idle`.
- **AC-QV-2** Query is trimmed and inner whitespace collapsed before comparison and before the request.
- **AC-QV-3** Query sent is URL-encoded via `URLSearchParams`; special characters never break the URL or inject markup.
- **AC-QV-4** Input has `maxlength=100`; no request exceeds 100 chars.
- **AC-QV-5** Re-submitting the same normalised query + filters while results (or empty) for it are displayed sends **0** requests.

### Race conditions (AC-RC)
- **AC-RC-1** When a newer search starts, the previous in-flight search request is aborted via `AbortController` (visible as cancelled in DevTools Network).
- **AC-RC-2** If a response for request N arrives after request N+1 has started, then the UI state/DOM does **not** change as a result of N (stale response discarded; `staleDiscarded` increments when it wasn't aborted in time).
- **AC-RC-3** `AbortError` never produces an error UI, toast, or console error.
- **AC-RC-4** A failure of a superseded request never changes UI state.
- **AC-RC-5** Clearing the input while a request is in flight results in `idle` state and the late response is ignored.
- **AC-RC-6** At most one search request is non-aborted at any moment.
- **AC-RC-7** Reducer accepts search results only if `action.query` equals the current intended query (and, for Load More, `page === state.page + 1`).
- **AC-RC-8** With mock latencies (`bat`=1800 ms, `batman`=250 ms), final DOM after 3 s displays batman results only. The same holds with `?noabort=1` (ID guard alone).
- **AC-RC-9** Loading flags are cleared only by the outcome of the current request.
- **AC-RC-10** Movie details lane: rapid A→B navigation never shows A after B.

### Empty results (AC-ER)
- **AC-ER-1** A search returning 0 items shows the EmptyState (not blank, not error styling), including the escaped query text.
- **AC-ER-2** The search input retains value and focus; typing a new query immediately resumes normal flow.
- **AC-ER-3** EmptyState offers at least one action (Clear search) and static example titles.
- **AC-ER-4** `empty` is not entered on error or idle; skeleton is never visible concurrently with EmptyState.
- **AC-ER-5** Result announcement via live region reads "No results for …" exactly once.
- **AC-ER-6** Empty-result queries are not saved to history unless submitted with Enter.

### Loading/success/error (AC-LS)
- **AC-LS-1** When a request starts, a skeleton grid replaces the results area within one frame; `aria-busy=true`.
- **AC-LS-2** While *debouncing* (no request yet), previous results remain visible (no skeleton flash).
- **AC-LS-3** Success renders one card per valid item; items missing `id` are dropped, others render.
- **AC-LS-4** Each failure category (network, timeout, 429, 5xx, malformed) shows a distinct message and a working Retry that re-runs the current query.
- **AC-LS-5** Requests time out at 10 s ± 0.5 s with a `timeout` error.
- **AC-LS-6** No uncaught exception or unhandled rejection occurs in any of the above paths (console clean).

### Posters (AC-IM)
- **AC-IM-1** Null/empty `poster_path` renders the fallback with the same aspect ratio; no broken-image icon appears in any scenario (including blocked image host).
- **AC-IM-2** Below-the-fold images use `loading="lazy"`; images have explicit aspect ratio (CLS < 0.1).

## P1 — Features

### Routing (AC-RT)
- **AC-RT-1** Routes `/`, `/search`, `/movie/:id`, `/watchlist` render correct pages; unknown path shows 404 page.
- **AC-RT-2** Reload on any route restores the page (host rewrite configured and verified on deployed URL).
- **AC-RT-3** Back/Forward move between prior views; typing does not add history entries (replaceState); Enter/chip click does.
- **AC-RT-4** `/search?q=batman` on cold load runs exactly one search with no 300 ms delay.
- **AC-RT-5** `document.title` updates per route; focus moves to `<h1>` on route change.
- **AC-RT-6** Modifier/middle-click on links opens in a new tab normally.

### Details (AC-DT)
- **AC-DT-1** Opening a movie triggers one details request (with `append_to_response`), not one per section; no per-card detail requests in grids.
- **AC-DT-2** Hero renders title, year, rating, runtime, genres when present; each missing field is hidden individually without layout breakage.
- **AC-DT-3** Cast shows ≤ 12 members; director shown when `job==='Director'` exists.
- **AC-DT-4** Invalid id (`abc`, `0`, negative) shows "Movie not found" without any API request; 404 from API shows same.
- **AC-DT-5** Details failure shows ErrorState with Retry and Back; search state is preserved when going back.

### Watchlist (AC-WL)
- **AC-WL-1** Toggle adds/removes; button `aria-pressed` reflects state; header count updates.
- **AC-WL-2** Adding an existing id never creates a duplicate.
- **AC-WL-3** Removing a non-existent id is a no-op without errors.
- **AC-WL-4** After page reload, watchlist contents/order persist.
- **AC-WL-5** Invalid JSON in storage results in recovery to empty list, one toast, no crash; new additions then persist normally.
- **AC-WL-6** If storage is unavailable, functionality continues in memory and the user is notified once.
- **AC-WL-7** Heart click never triggers navigation.
- **AC-WL-8** Watchlist page shows empty state with CTA when empty; Undo after remove restores item.

### Search history (AC-SH)
- **AC-SH-1** Max 8 entries, newest first, case-insensitive dedupe.
- **AC-SH-2** Clicking an entry runs that search immediately and updates URL.
- **AC-SH-3** Clear all removes everything and persists.
- **AC-SH-4** Corrupt history data is discarded safely; valid entries retained.
- **AC-SH-5** Partial prefixes from typing (`ba`, `bat`) are never stored.

### Trending / discovery (AC-TR)
- **AC-TR-1** Home loads 12 trending movies on first visit; skeletons while loading.
- **AC-TR-2** Trending failure shows inline retry; search remains usable.

### Filters/sort (AC-FL)
- **AC-FL-1** Defaults: Any genre, Any year, rating Any, sort Relevance/Popular; Reset restores defaults.
- **AC-FL-2** In browse mode, selected filters map to the documented `discover` params (verified in Network tab).
- **AC-FL-3** In text-search mode, genre/rating/sort act on loaded results and the UI states this; year is sent to the API.
- **AC-FL-4** Changing a filter aborts in-flight requests, resets `page=1`, runs immediately (no debounce delay).
- **AC-FL-5** Filters are reflected in the URL and restored on load.
- **AC-FL-6** When filters hide all loaded items, a filtered-empty state (with Reset and Load more) appears, distinct from search-empty.

### Pagination (AC-PG)
- **AC-PG-1** Load More requests `page+1` for the same query/filters and appends results.
- **AC-PG-2** No duplicate movie ids in the list after appends.
- **AC-PG-3** A new search/filter resets `page` to 1 and discards pending Load More.
- **AC-PG-4** Button is disabled while loading and hidden when `page >= totalPages`.
- **AC-PG-5** Load More failure keeps existing results and shows inline Retry.

### Trailer / gallery / similar / share
- **AC-TL-1** Trailer button opens a modal with YouTube embed of preferred trailer; Esc, ✕, backdrop close it; playback stops; focus returns to the button.
- **AC-TL-2** No trailer → button disabled with visible "Trailer unavailable" text.
- **AC-TL-3** Video key is validated before embedding.
- **AC-GL-1** Gallery lightbox supports ←/→/Esc, shows position, skips broken images.
- **AC-SM-1** Similar movies exclude the current movie; clicking navigates to its details.
- **AC-SM-2** Empty similar list hides the section or shows muted message (no error).
- **AC-SH2-1** Share uses Web Share when available; otherwise clipboard + "Link copied"; if clipboard fails, manual-copy dialog; user-cancelled share shows nothing.
- **AC-SH2-2** Shared URL is `origin/movie/:id` and opens correctly in a fresh tab.

### Accessibility / responsive
- **AC-A11Y-1** Entire app usable by keyboard; focus always visible; modals trap focus and restore it.
- **AC-A11Y-2** Axe: 0 critical/serious issues on main screens.
- **AC-A11Y-3** Result summaries announced once per settled search via polite live region; no announcement per keystroke.
- **AC-A11Y-4** Contrast ≥ 4.5:1 for text.
- **AC-RS-1** No horizontal scroll at 320 px width on any route.
- **AC-RS-2** Grid columns follow the responsive matrix; touch targets ≥ 44 px.

### Diagnostics (AC-DG)
- **AC-DG-1** Panel opens via toggle/`?debug=1`; shows Query, Debounce 300ms, Request ID, previous/current status, response time, results, keystrokes, API requests, prevented, aborted, stale-discarded.
- **AC-DG-2** For D-1 (typing `batman`), panel shows Keystrokes 6, API Requests 1, Prevented 4 (valid keystrokes − requests).
- **AC-DG-3** Panel never displays tokens or credential-bearing URLs.
- **AC-DG-4** Counters derive from real events (no hard-coded numbers); Reset zeroes them.

### Security (AC-SC)
- **AC-SC-1** No secrets in repository (secret scan clean) and `.env*` git-ignored.
- **AC-SC-2** In proxy mode the production bundle and browser requests contain no TMDB token.
- **AC-SC-3** All user/API/storage text rendered via `textContent`/escaped templates; no `innerHTML` with untrusted data.
- **AC-SC-4** TMDB attribution present in footer.
