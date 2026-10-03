# IMPLEMENTATION_PLAN — Cinesift

Dependency-aware order. **Gate rule:** do not start a phase until the previous gate passes. Cut from the bottom up if time runs out.

## Ordering changes vs the suggested list (and why)

| Change | Reason |
|---|---|
| Hosting/router rewrite verified in Phase 1 | Routing/refresh bugs found on deploy day are the most common late failures |
| API verification + mock adapter moved *before* race work | Race demo needs deterministic latency; you can't test aborts without controllable slowness |
| Diagnostics hooks (events only) added in Phases 4–6; panel UI in Phase 21 | Counters must come from real instrumentation, not bolted on at the end |
| Routing (Phase 10) before details (9)? → **Details built as a function first, mounted by router in 10** | Avoids rewriting nav twice |
| Storage helper before watchlist/history | Safe JSON utility is shared |

Rough time budget for a ~10–14 day effort (adjust): P0 core 35 % · P1 core 35 % · polish/tests/demo 30 %.

---

### Phase 1 — Setup (0.5 d)
- `npm create vite@latest cinesift -- --template vanilla`; init git; `.gitignore` (`.env*`, `node_modules`, `dist`).
- `.env.example`; `config.js` (`DEBOUNCE_MS=300, MIN_QUERY=2, MAX_QUERY=100, TIMEOUT_MS=10000`).
- Create TMDB account → API Read Access Token; **verify docs** (API_SPEC §10 checklist). Test one `curl` with Bearer.
- Netlify/Vercel project + SPA fallback file; deploy "Hello" immediately.
- **Gate:** deployed URL reloads on `/anything` without 404.

### Phase 2 — Design system (0.5 d)
- `tokens.css`, `base.css` (reset, focus ring, sr-only, skeleton keyframes), button/input/badge classes.
- `utils/dom.js` (`h`, `qs`, `on`, `delegate`), `format.js`.
- **Gate:** a style-guide scratch page renders tokens/buttons/inputs on mobile+desktop.

### Phase 3 — Search UI (0.5 d)
- Header + SearchBar (label, `type=search`, maxlength, clear ✕), static results container with `aria-live` region, skeleton/empty/error components rendered from hard-coded data.
- **Gate:** all visual states viewable via a temporary `?state=empty` switch.

### Phase 4 — Debounce (0.5 d)
- `debounce.js` with hooks; **unit tests** (fake timers) D-3.
- Wire `input` → `searchController.onInput` (no API yet; log "would search: X").
- **Gate:** typing `batman` logs once; Enter flushes.

### Phase 5 — API abstraction (1 d)
- `errors.js`, `tmdbAdapter.search`, normalisers, `movieService`, `cache.js`, `mockAdapter` with latency table.
- Proxy function (or direct mode with `.env.local`).
- Unit tests for normalisation (nulls, missing ids, empty string dates).
- **Gate:** `movieService.search({query:'batman'})` returns `Page<MovieSummary>` in real and mock mode.

### Phase 6 — Cancellation & race protection (1 d)
- `requestManager` (lanes, IDs, timeout, invalidate). `?noabort=1` test flag.
- Controller `executeSearch` per ASYNC §3.5; reducer guards (layer 3).
- Unit tests R-3, R-4, R-5, abort silent.
- **Gate:** R-1 and R-2 pass manually in mock mode.

### Phase 7 — Search state handling (0.5–1 d)
- Reducer/state machine (idle/debouncing/loading/success/empty/error), render per state, live region, retry, duplicate guard, URL sync (`replaceState` while typing).
- **Gate:** E-1…E-13 pass. **→ P0 complete. Tag `v0-p0`. Record a 60 s backup video.**

### Phase 7b — Diagnostics (0.5 d) *(pulled forward; cheap, high value)*
- `diagnostics.js` (events/counters) + minimal panel (no styling polish).
- **Gate:** D-1 numbers match AC-DG-2.

### Phase 8 — Movie cards (0.5 d)
- MovieCard (stretched link), ImageWithFallback, MovieGrid, srcset, lazy loading, missing-data defaults, heart button placeholder.
- **Gate:** E-14, E-15 pass.

### Phase 9 — Movie details (1–1.5 d)
- `adapter.details` with `append_to_response`; normalise cast/director/trailer/backdrops/similar.
- DetailsPage: skeleton, hero, facts, overview, cast, error/404; `details` lane.
- **Gate:** E-16…E-19, R-6.

### Phase 10 — Routing (0.5–1 d)
- `router.js`, link interception, popstate, title/focus on route change, mount/unmount lifecycle (abort + cancel debounce on unmount), URL ↔ search state, 404 page.
- **Gate:** E-24, E-25, E-33, D-5.

### Phase 11 — Watchlist (0.5–1 d)
- `storage.js`, `watchlistStore` (validate/migrate/recover), heart toggle (cards + details), header badge, Watchlist page, Undo toast, cross-tab sync.
- **Gate:** E-20…E-23, F-3…F-5.

### Phase 12 — Search history (0.5 d)
- `historyStore`, chips on Home + under search on focus, clear, remove-one.
- **Gate:** F-6, AC-SH-*.

### Phase 13 — Discovery / trending (0.5 d)
- `adapter.trending`, `genres` (cached), Home sections, section error/retry.
- **Gate:** F-7.

### Phase 14 — Filters/sort (1 d) — **risk: semantic mismatch, see API §4**
- Browse mode via `discover`; client-side filters in search mode; URL sync; filtered-empty state; reset.
- **Gate:** F-8, F-9, E-32.

### Phase 15 — Pagination (0.5 d)
- Load More with reducer guards, dedupe, end state, inline error.
- **Gate:** F-10, R-7, AC-PG-*.

### Phase 16 — Trailer (0.5 d)
- Modal base (native `<dialog>`), TrailerModal, key validation, fallback link.
- **Gate:** E-17, E-28, F-11.

### Phase 17 — Gallery (0.5 d) — **first cut candidate**
- Lightbox, thumbs, key controls, error skipping. **Gate:** F-13.

### Phase 18 — Similar movies (0.25 d)
- Row component, self-exclusion, nav + focus. **Gate:** F-12.

### Phase 19 — Share (0.25 d)
- Web Share → clipboard → manual dialog; toast. **Gate:** E-29, E-30.

### Phase 20 — Accessibility & responsive (1 d)
- Full keyboard pass, ⌘K / `/`, Esc stack, focus restore, live-region audit, axe, mobile filter sheet, 320 px pass, reduced motion.
- (Optional) suggestions combobox **only if everything else is green**.
- **Gate:** A-1…A-7, V-1.

### Phase 21 — Diagnostics polish (0.25 d)
- Final panel layout, mobile drawer, reset, mode badge, `?debug=1`.

### Phase 22 — Testing (1 d)
- Run entire TEST_PLAN on deployed build; fix; add missing unit tests; scan for secrets; Lighthouse.

### Phase 23 — Performance & polish (0.5 d)
- Image sizes/srcset audit, LCP priority, CLS, bundle size, micro-interactions, copy review, footer attribution, README (screenshots, architecture diagram, "how to verify debounce/race").

### Phase 24 — Demo prep (0.5 d)
- Rehearse DEMO_AND_VIVA script 3×; backup video; mock mode ready; offline fallback; printed cheat-sheet of Q&A; verify deployed + local both work; clear storage/seeds for clean demo.

---

## Cut list (in order, if behind schedule)
1. Suggestions combobox 2. Scroll restoration 3. Gallery 4. Cross-tab sync 5. Share dialog fallback (keep clipboard) 6. Genre chips on Home 7. Filters on text-search (keep browse filters only) 8. Proxy (use direct mode, state trade-off honestly).
**Never cut:** P0, diagnostics counters, mock mode, empty/error states, poster fallback, README with verification steps.

## Definition of done
All P0 AC pass on deployed build · test regression gate (TEST_PLAN §8) green · no console errors · README explains debounce+race in ≤ 1 page · demo rehearsed.

## Repo hygiene
Small commits per phase (`feat(search): debounce util + tests`), tag `v0-p0`, `v1`. README sections: Overview · Live demo · Run locally · Env vars · Architecture diagram · "Proving debounce & race protection" (steps) · Tech decisions · Limitations.
