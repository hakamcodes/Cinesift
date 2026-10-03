# PRD — Cinesift: Movie Search with Debounced Input

> Working name: **Cinesift** (rename freely). Version 1.0 · Doc date 2026-10-03
> Evaluated by: FLUX Technical Club · Chosen API: **TMDB v3** · Chosen stack: **Vanilla JS (ES modules) + Vite**
> Companion docs: ARCHITECTURE · API_SPEC · UI_UX_SPEC · STATE_AND_ASYNC_FLOW · DATABASE_AND_STORAGE · TEST_PLAN · ACCEPTANCE_CRITERIA · IMPLEMENTATION_PLAN · DEMO_AND_VIVA · FUTURE_SCOPE

---

## 1. Summary

Cinesift is a focused movie-discovery web app. Core: type in a search box, results appear after the user stops typing for **300 ms**, stale responses can never overwrite fresh ones, and zero-result searches show an intentional empty state. Around that core sit a polished discovery page, a movie details page, a local watchlist, and recent searches.

**One-line product positioning:** *A movie-discovery app whose search is provably correct under fast typing, slow networks, and failing APIs.*

### 1.1 The three graded areas (first-class requirements)

| # | Official criterion | What "first-class" means here | Where specified |
|---|---|---|---|
| 1 | Debouncing technique | Hand-written `debounce()` with `cancel()`/`flush()`, counted timers, visible in diagnostics | STATE_AND_ASYNC_FLOW §2 |
| 2 | Race-condition prevention | `AbortController` per request **plus** monotonically increasing request ID guard **plus** committed-query guard | STATE_AND_ASYNC_FLOW §3–5 |
| 3 | Empty-result handling | Dedicated `empty` state ≠ `idle` ≠ `error`, with message, query echo, suggestions, immediate re-edit | UI_UX_SPEC §6.4 |

### 1.2 Goals
1. Pass all three graded areas with **demonstrable, verifiable** behaviour.
2. Feel like a small real product (skeletons, fallbacks, routes, a11y, responsive).
3. Be explainable by the student line-by-line in a viva.
4. Stay shippable: every P1/P2 feature must be cuttable without breaking P0.

### 1.3 Non-goals (V1)
Auth, user accounts, remote DB, social features, AI recommendations, payments, TV shows/people pages, streaming-availability, reviews/comments, PWA/offline, i18n. (See FUTURE_SCOPE.)

---

## 2. Users

| | Primary — "Quick Searcher" | Secondary — "Movie Enthusiast" |
|---|---|---|
| Who | Wants facts about a specific film fast | Browses, compares, builds a to-watch list |
| Needs | Instant feedback while typing; correct result on top; works on phone | Discovery feed, filters, trailer, cast, similar movies, saved list |
| Frustrations | Flicker, wrong results flashing in, blank screens, lag per keystroke | Losing saved items, dead-end pages, broken images, losing place after Back |
| Expected behaviour | Type → wait briefly → see results; Enter works; Esc clears focus/overlays | Click card → rich details; Back returns to same results; refresh keeps page |
| Success signal | Found the movie in < 3 s from first keystroke | Saved ≥1 movie, opened a similar movie |

**Third user (hidden, important): the FLUX evaluator.** Needs to *see* debounce and cancellation working in < 3 minutes → diagnostics panel + demo script (DEMO_AND_VIVA).

---

## 3. Scope tiers

### 3.1 P0 — Mandatory (assignment core). Ship first. Nothing else starts until P0 passes.
| ID | Feature | Rationale |
|---|---|---|
| P0-1 | Search input → TMDB `/search/movie` | The assignment |
| P0-2 | 300 ms debounce (real, cancelable) | Graded #1 |
| P0-3 | Race-condition protection (AbortController + request ID) | Graded #2 |
| P0-4 | Empty-result state | Graded #3 |
| P0-5 | Loading state (skeleton grid) | Required by journey B |
| P0-6 | Success state: movie cards (poster, title, year, rating) | Must render results |
| P0-7 | Error state with retry | Journey E; part of "every request can fail" |
| P0-8 | Query validation (trim, min length, max length) | Avoid pointless requests |
| P0-9 | Poster fallback | No broken-image icons |

### 3.2 P1 — High-impact enhancements (ordered by build priority)
Routing (`/`, `/search`, `/movie/:id`, `/watchlist`) → Movie details (+ cast, director) → Watchlist → Search history → Trending/discovery home → Pagination (Load More) → Filters/sort → Trailer modal → Similar movies → Share → Gallery → Responsive + a11y pass → Robust error handling for each section.

### 3.3 P2 — Polish (cut first if time runs out)
Diagnostics panel · Ctrl/⌘+K focus shortcut · suggestions dropdown (reuses main response, no extra requests) · toast notifications · scroll restoration · micro-interactions.

> **Honest ranking note:** diagnostics is labelled P2 by the brief, but it is the single feature that makes P0 *visible* to an evaluator. Build it right after P0 is stable (Phase 7b in IMPLEMENTATION_PLAN). Treat it as "P0.5".

### 3.4 Explicitly excluded from V1
Accounts/login, cloud sync, TV/people, ratings submission, reviews, comparison tool, AI picks, infinite scroll, service workers, SSR, analytics SaaS, backend DB. Reasons in FUTURE_SCOPE.

---

## 4. Feature rationale table (what / why / skill shown / complexity / depends / failure modes / V1?)

| Feature | What | Why / problem solved | Skill demonstrated | Cx | Depends on | Main failure cases | V1 |
|---|---|---|---|---|---|---|---|
| Debounced search | Fire request 300 ms after last keystroke | Cut request volume, avoid flicker | Timers, closures | S | Search input | Timer leak, not cleared on route change | ✅ P0 |
| Race guard | Abort + ID check | Stop stale overwrite | Async, AbortController | M | Debounce, request manager | Treating AbortError as real error; forgetting to guard `finally` | ✅ P0 |
| Empty state | Distinct UI for 0 results | Users must know search worked | State modelling | S | Search state | Showing it on error/idle; flashing before load | ✅ P0 |
| Loading skeletons | Card-shaped placeholders | Perceived performance, no layout jump | UX engineering | S | Search state | Skeleton stuck after abort | ✅ P0 |
| Error + retry | Categorised error UI | Real APIs fail | Defensive coding | M | Request manager | Infinite retry; hiding the query | ✅ P0 |
| Movie service + adapter | Normalise TMDB → internal model | Decouple UI from vendor | Architecture | M | — | Missing field crashes UI | ✅ P0 |
| Router | History API routes | Refresh/share/back work | SPA fundamentals | M | Pages | 404 on refresh (hosting rewrite) | ✅ P1 |
| Details page | Hero + metadata + cast | The "product" feel | Data fetching, composition | M | Router, service | One failed sub-section kills page | ✅ P1 |
| Watchlist | localStorage list | Persist without backend | Storage, validation | S | Movie model | Corrupt JSON, quota, duplicate | ✅ P1 |
| Search history | Last 8 queries | Repeat searches | Storage, dedupe | S | Search | Saving junk/partial queries | ✅ P1 |
| Trending home | `/trending/movie/week` | No dead first screen | API use | S | Service | API down → blank home | ✅ P1 |
| Load More | Page+1, append | Reliable pagination | State, dedupe | M | Search state | Duplicate items, page not reset | ✅ P1 |
| Filters/sort | Genre/year/rating/sort | Refinement | State ↔ URL ↔ API mapping | L | Discover, search | Filter semantics differ search vs discover (§API 4) | ✅ P1 |
| Trailer modal | YouTube embed | Engagement | Accessible modal | M | Details | No trailer; focus trap bugs | ✅ P1 |
| Similar movies | Row on details | Exploration loop | Data reuse | S | Details | Empty list; self-reference | ✅ P1 |
| Gallery | Backdrops lightbox | Visual depth | Lightbox a11y | M | Details | Missing images, keyboard trap | ⚠️ P1-low (cut early) |
| Share | Web Share + clipboard | Canonical URLs | Progressive enhancement | S | Router | Unsupported API; permission denied | ✅ P1 |
| Diagnostics | Live async counters | Make graded work visible | Observability | M | Request manager hooks | Counters wrong → worse than none | ✅ P2 (do early) |
| Suggestions | Top-5 dropdown | Faster selection | ARIA combobox | M | Search | A11y mistakes; extra traffic | ⚠️ P2 (cut-able) |
| Ctrl/⌘+K | Focus search | Power users | Keyboard handling | S | Search | Conflicts with browser | ✅ P2 |

**Risk-ranked features most likely to introduce bugs (delay these):** suggestions combobox, gallery lightbox, filters on search results, scroll restoration. Ship P0 + core P1 first.

---

## 5. User journeys (summary; full flows in linked docs)

| Journey | Summary | Detail doc |
|---|---|---|
| A First visit | Hero + search focused-ready + trending grid + recent searches. Trending failure → inline retry, search still works. | UI_UX §5.1 |
| B Search | Keystrokes reset 300 ms timer; after quiet period → validate → request → skeleton → cards. | ASYNC §2, §6 |
| C Race | `bat` then `batman`: A aborted, B wins; late A (if abort missed) discarded by ID guard. | ASYNC §3–5 |
| D Empty | "No movies found for "xyzqwerty"" + tips + Clear button + input stays focused/editable. | UI_UX §6.4 |
| E API failure | Categorised: network / timeout / rate-limit(429) / server(5xx) / auth(401) / malformed. Retry button; auto-retry once for 429/5xx/network with backoff only on user-initiated or discovery loads, **never** silently loop on typing. | API §7 |
| F Click movie | Navigate `/movie/:id` (History API). Refresh/direct URL works. | ARCH §6 |
| G Watchlist | Toggle on card/details; key `cinesift:watchlist:v1`. | STORAGE §2 |
| H History | Max 8, newest first, dedupe case-insensitively, save only on **successful non-empty** or Enter-submitted searches. | STORAGE §3 |
| I Trending | `/trending/movie/week`, 12 items, grid. | API §3 |
| J Filters | Genre, year, min rating, sort; see split semantics (**important**) in API §4. | API §4 |
| K Load More | Button; appends; guards against stale page and duplicate IDs. | ASYNC §8 |
| L Similar | Row of ≤12; click → new details route. | UI_UX §6.6 |
| M Trailer | Prefer official YouTube "Trailer"; modal with `youtube-nocookie`; fallback = disabled button + tooltip text. | UI_UX §7.1 |
| N Gallery | ≤12 backdrops, thumbnails → lightbox, ←/→/Esc. | UI_UX §7.2 |
| O Share | `navigator.share` → clipboard → manual-copy input fallback; toast. | UI_UX §7.3 |
| P Keyboard | `/` or Ctrl/⌘+K focus; Enter submit now; Esc close overlay / clear; arrows in suggestions. | UI_UX §9 |

---

## 6. Information architecture

```
/                 Home / Discover   (hero search, recent searches, trending)
/search?q=&genre=&year=&rating=&sort=&page=   Search results
/movie/:id        Movie details
/watchlist        Saved movies
(overlays)        Trailer modal · Gallery lightbox · Toast · Diagnostics panel
```

Search input lives in the persistent header on every route. Submitting/typing navigates to `/search?q=…` (`replaceState` while typing, `pushState` on Enter / history click — avoids polluting Back stack with every debounced query).

---

## 7. Non-functional requirements (realistic for student project)

| Area | Requirement |
|---|---|
| Performance | ≥1 debounce-cancelled timer per superseded keystroke; **0** requests for invalid queries; **≤1** in-flight search at any time; images `loading="lazy"` below fold; details requested only on route open (one call using `append_to_response`) |
| Accessibility | Semantic landmarks; labelled input; visible focus; WCAG AA contrast target (4.5:1 body text); modal focus-trap + Esc; polite live region for result count (updates only when results settle) |
| Responsive | 360 px → 1440 px without horizontal scroll (except designated carousels) |
| Reliability | App never white-screens: every async path ends in success/empty/error; global `unhandledrejection` logs and shows toast |
| Maintainability | ES modules, ≤ ~200 lines/file target, JSDoc on public functions, no globals except app entry |
| Security | No secrets in repo; see API §8 |
| Graceful degradation | No localStorage → in-memory fallback + notice; no Web Share → clipboard; no trailer → disabled state |
| Usability | Back/forward/refresh behave naturally; destructive actions (clear history/watchlist) are undoable or confirmed |

---

## 8. Requirement traceability

### 8.1 Official requirements → implementation

| Official requirement | Implementation | Evaluator verification |
|---|---|---|
| Movie browser UI using TMDB | Pages + `movieService` + `tmdbAdapter` | Open app, browse |
| Auto-query as user types | `searchController.onInput` | Type without pressing Enter |
| **300 ms debounce** | `utils/debounce.js` `DEBOUNCE_MS = 300` | Source: one constant; Diagnostics: keystrokes vs requests; DevTools Network |
| Minimise unnecessary requests | Debounce + min length + dedupe + cache | Network tab: 1 request for "batman" typed fast |
| **Race conditions** | `requestManager` (AbortController + `requestId`) + committed-query guard | DevTools → throttle "Slow 3G"; type `bat`, then `batman`; Network shows `bat` as `(canceled)`; UI shows batman only |
| **Empty results** | `EmptyState` component; state `empty` | Search `zzqxjkv` |

### 8.2 Enhancements → concept shown

| Feature | Concept |
|---|---|
| Adapter/service layer | Separation of concerns, dependency inversion |
| Router | History API, SPA hosting rewrites |
| Watchlist/history | Persistence, schema versioning, defensive JSON parsing |
| Load More | Pagination state reset, dedupe |
| Filters | State ↔ URL sync, API capability mismatch handling |
| Trailer/gallery | Accessible modals, focus management |
| Diagnostics | Observability, instrumenting async code |

---

## 9. Decision log

| # | Decision | Alternatives | Why (student-project lens) |
|---|---|---|---|
| D1 | **TMDB** over OMDb | OMDb | TMDB has trending, discover, similar, videos, images, credits, genre list, pagination, 20/page. OMDb lacks trailers, similar, gallery, discover; search returns minimal fields. See API_SPEC §1 |
| D2 | **Vanilla JS + Vite** over React | React+Vite | Evaluator grades async fundamentals; vanilla makes debounce/abort **visible, not hidden behind hooks**. Router + templates are small. Trade-off: more manual DOM work; mitigate with tiny `h()`/template helper and a `render` per view. React is acceptable if you already know it well — then keep `useEffect` cleanup + abort pattern identical (documented in ASYNC §11). |
| D3 | Custom debounce (no lodash) | lodash | Showing you can write it; trivial to explain |
| D4 | History API router | Hash router | Required clean `/movie/:id`; needs host rewrite (Netlify `_redirects` / Vercel `rewrites`). Hash fallback documented |
| D5 | Details = **one** call with `append_to_response` | 5 calls | Fewer round trips, one failure surface; trade-off: one section failing can't be retried alone → adapter treats each sub-block as optional |
| D6 | Search filters: year server-side, genre/rating/sort **client-side** on loaded results | Force discover | `/search/movie` doesn't accept genre/rating/sort (verify). See API §4 |
| D7 | Load More over infinite scroll | Infinite | Predictable, a11y-friendly, simpler dedupe |
| D8 | Serverless proxy for API key (recommended for deploy), direct call for local dev | Client key | Key in client bundle is public by definition. See API §8 |
| D9 | Suggestions reuse main search response | Separate suggest endpoint | Zero extra traffic; no second race to manage |
| D10 | Min query length = 2 | 1 or 3 | 1 char = noisy results & many requests; 3 blocks short titles ("Up", "It") — 2 balances |

---

## 10. Risks

| Risk | Impact | Mitigation |
|---|---|---|
| Scope creep (this PRD is large) | P0 gets rushed | Phase gates in IMPLEMENTATION_PLAN; P0 done + demo-able first |
| TMDB blocked/slow on student network (some ISPs) | Demo fails | Mock mode (`?mock=1`) with fixture JSON + artificial latency to demo races offline; record a backup video |
| API key leak | Account issue | `.env` ignored; proxy; rotate key |
| Hosting 404 on refresh | Journey F fails | Add rewrite file on day 1 |
| Over-claiming | Viva exposure | Don't claim "no extra requests ever"; be accurate: abort cancels the client side; server may still process |
| Diagnostics counters wrong | Looks fake | Unit-test counters; derive from real events only |

---

## 11. Self-review against the quality bar

- **Assignment alignment:** every official line mapped (§8.1). ✔
- **Technical depth:** three independent stale-response defences, explained with failure cases. ✔
- **UX:** skeletons, fallbacks, routes, a11y. ✔ — *but* only if time allows; P0 correctness beats polish.
- **Edge cases:** matrix in TEST_PLAN (≥ 30 cases). ✔
- **Scope:** gallery and suggestions flagged cuttable. ✔
- **Demo:** 5-minute script that spends 60% of time on the 3 graded items. ✔
- **Differentiators over typical submissions:** (1) provable race handling with a throttled/mocked slow-response demo, (2) diagnostics panel with real counters, (3) adapter layer + normalised model, (4) URL-as-state, (5) distinct empty/error/idle, (6) accessible live region, (7) corrupt-storage recovery.
- **Honest warning:** 18 journeys is a lot for one student. A flawless P0 + 5 well-built P1 features beats 18 half-working features. Evaluators probing the three graded areas will find any shortcut in 30 seconds.
