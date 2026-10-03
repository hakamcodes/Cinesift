# DEMO_AND_VIVA — Cinesift

## 1. Demo script (≈5 minutes, 60 % on the three graded areas)

**Prep (before evaluator arrives):** deployed URL + localhost fallback open; DevTools Network tab docked, filter `search`/`Fetch`, "Preserve log" on; diagnostics panel open (`?debug=1`); mock mode URL in second tab; storage cleared; backup video ready; phone with the URL.

| # | Time | Do | Say (key sentence) | Proves |
|---|---|---|---|---|
| 1 | 0:00 | Open Home | "Focused movie-discovery app: search is the core, built around three guarantees — debounce, race safety, honest empty states." | Product feel, trending not empty |
| 2 | 0:20 | Type `batman` fast, stop | "Six keystrokes, one request. The timer resets on each key and fires 300 ms after the last." Point at Network (1 request) and panel (Keystrokes 6, Requests 1, Prevented 4). | **Debounce** |
| 3 | 1:00 | Open `?mock=1` tab. Type `bat`, wait ~0.4 s, type `man` | "`bat` is mocked to take 1.8 s, `batman` 250 ms. Watch Network: `bat` is **cancelled**; only batman renders." | **Race / AbortController** |
| 4 | 1:40 | Same, but add `?noabort=1` | "I disabled abort on purpose. The slow response still arrives — and gets discarded by the request-ID guard. Counter: Stale discarded 1." | **Defence in depth** |
| 5 | 2:10 | Search `zzqxjkv` | "Not blank, not an error: a distinct empty state, query echoed, input still focused." Edit text → results return. | **Empty handling** |
| 6 | 2:30 | DevTools Offline → search → Retry after back online | "Network failure is its own state with Retry; nothing crashes." | Error handling |
| 7 | 2:50 | Click a result → details | "Route `/movie/:id`; one API call with `append_to_response`, not one per section." Refresh page. | Routing, efficiency |
| 8 | 3:20 | Trailer → close (Esc); heart → refresh | "Watchlist in localStorage, validated on load — corrupted JSON recovers instead of crashing." | Storage, a11y modal |
| 9 | 3:50 | (If time) Similar → click; Share | | Polish |
| 10 | 4:15 | Show architecture diagram / `requestManager.js` | "UI → controller → debounce → request manager → service → adapter → TMDB. Adapter means UI never sees TMDB field names." Mention proxy for key. | Engineering depth |

**Don't:** tour all 18 features; open gallery/filters unless asked; type slowly during the debounce demo; apologise for polish gaps — pivot to the graded behaviour.

**Fallback plan:** if network dies → mock mode (all graded behaviours demonstrable offline). If deployed site fails → localhost. If everything fails → 90 s backup video.

## 2. Viva Q&A (accurate, student-presentable)

**1. What is debouncing?**
Delaying a function until a quiet period has passed since the last call. Every new call resets the timer. For search, it means we send a request only for what the user finally typed, not for each intermediate character.

**2. Why 300 ms?**
It was the assignment's requirement, and it's a common compromise: people often type with gaps of ~100–250 ms, so 300 ms usually bridges a burst of typing but still feels instant. Shorter → more wasted requests; longer → the UI feels sluggish. It's one constant in `config.js`, so it's tunable.

**3. Why debounce instead of throttle?**
Throttle runs at a fixed rate *during* the activity, so it would still send partial queries like `ba` or `batm`. Debounce waits for the user to finish, so we send only the final intent. Throttle suits scroll/resize; debounce suits "wait until typing stops".

**4. What is a race condition here?**
Two async requests whose results compete to update the same UI state. The final UI depends on which response arrives last rather than which query is newest.

**5. How can responses arrive out of order?**
Different requests take different network paths and server times; a short query like `bat` may be heavier to search than `batman`; retries, connection reuse, and congestion vary. HTTP doesn't guarantee completion in start order.

**6. How does AbortController work?**
You create a controller, pass `controller.signal` to `fetch`, and call `controller.abort()` later. The pending `fetch` promise rejects with an `AbortError` and the browser stops waiting/processing that response. I catch that error and deliberately ignore it. It cancels the client side; the server may already have started working.

**7. Why isn't debounce alone enough?**
Debounce controls when requests *start*, not which response may *update the UI*. If I pause 400 ms after `bat`, a request starts; then I continue typing and a second one starts. Two requests are in flight even with debounce.

**8. How do you ignore stale responses?**
Three layers: (1) abort the previous request; (2) each request gets an incrementing ID and after every `await` I check `isCurrent(id)`; (3) the reducer only accepts results whose query matches the current query. Even if abort were missed, the ID guard drops the late response — I can demonstrate this with `?noabort=1`.

**9. What if the API fails?**
Errors are classified (network, timeout, 429, 5xx, malformed). The UI shows a specific message and a Retry button, keeps the input usable, and never shows an error for aborted or superseded requests. No automatic retry loops while typing.

**10. How do you handle empty results?**
Empty is a separate state from idle and error: message with the escaped query, suggestions, Clear button, and focus stays in the input. It's announced once to screen readers.

**11. Why localStorage for the watchlist?**
It's per-device, synchronous, simple, and needs no backend or accounts — enough for V1. Trade-offs: ~5 MB limit, no sync across devices, user can edit it. So I validate on load, version the schema, and recover from corruption.

**12. Why not fetch details for every card?**
Search results already include the fields cards need. Fetching details for 20 cards = 20 extra requests for data most users never view. Details load only when a movie is opened, in one request with `append_to_response`.

**13. Why a movie ID in the URL?**
IDs are stable and unique, so refresh, back/forward, bookmarking, and sharing all work. Titles aren't unique and change by language.

**14. How do you prevent duplicate API requests?**
Debounce; minimum length; skipping when the query+filters equal what's already displayed; a small cache; disabling buttons while loading; and the manager aborting older requests.

**15. What if a poster is missing?**
Adapter keeps `posterPath = null`; the image component renders an on-brand placeholder at the same aspect ratio. If a URL exists but fails, the `error` handler swaps in the placeholder — no broken-image icon and no layout shift.

**16. How do you handle corrupted localStorage?**
`JSON.parse` is in try/catch; shape and each item are validated; bad items dropped; if the whole payload is unusable it resets to empty with a one-time notice. Every storage access is wrapped because even reading `localStorage` can throw.

**17. Where is the API key stored?**
Not in the repo. Locally in a git-ignored `.env.local`. In deployment, in the host's environment variables, used by a small serverless proxy so the browser never sees the token. Anything in client JS is public — a `VITE_` variable is bundled — so I only use direct mode for local dev. *(If you used direct mode in production, say so honestly: "the key is exposed in the client; for a read-only free key the risk is quota abuse; I'd move it behind the proxy.")*

**18. What would you change for production?**
Server-side proxy with caching and rate limiting; error monitoring; automated end-to-end tests (Playwright); proper accessibility audit; image CDN tuning; i18n; maybe user accounts with a database if cross-device watchlists were needed.

**19. What happens on slow networks?**
Skeletons show as soon as a request starts; there's a 10-second timeout leading to a retryable error; further typing aborts the slow request and starts a fresh one; images are lazy-loaded and sized via `srcset`.

**20. How does pagination interact with a new search?**
A new query or filter resets `page` to 1, clears the list, aborts any pending Load More, and the reducer rejects page results whose query/page don't match the current state, so old pages can't append to new results.

### Extra tough questions
- **"Is your debounce leading or trailing?"** Trailing (fires after the quiet period). Enter triggers an immediate flush.
- **"Why does `Requests Prevented` = 4 for 6 keystrokes?"** Defined as valid keystrokes (5) minus requests sent (1); the first keystroke `b` is invalid (<2 chars) and never schedules a timer.
- **"Does abort stop the server?"** No — it stops the browser from waiting for/processing the response. The server may still complete it.
- **"Why not just use lodash debounce?"** Wanted to show the mechanism; a custom version also exposes `cancel/flush/pending` and hooks for diagnostics. In production, a vetted library is fine.
- **"What if two tabs edit the watchlist?"** `storage` event syncs tabs; writes are small and whole-document, so last write wins — acceptable for V1.
- **"Why vanilla JS?"** Makes the async mechanics explicit; framework not needed for 4 routes. (If React: explain effect cleanup = abort.)
- **"What's the weakest part?"** Be honest: filters in text-search mode apply only to loaded results because TMDB's search endpoint doesn't support them — I made that explicit in the UI rather than faking it.

## 3. Last-minute checklist
- [ ] Deployed build passes TEST_PLAN §8
- [ ] Panel numbers match D-1 exactly (6 / 1 / 4)
- [ ] `?mock=1` and `?noabort=1` work on deployed URL (or localhost)
- [ ] Backup video on phone
- [ ] Storage cleared; no personal watchlist junk
- [ ] Token not visible in DevTools sources (proxy mode)
- [ ] You can open `debounce.js`, `requestManager.js`, `searchController.js` and explain every line
