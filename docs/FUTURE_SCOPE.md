# FUTURE_SCOPE — Deferred beyond V1

| Feature | Why deferred | Revisit when |
|---|---|---|
| User accounts / cloud-synced watchlist | Needs auth, DB, privacy handling; doesn't strengthen debounce/race/empty-state | After V1 is graded and you want a portfolio extension (e.g., Supabase/Firebase) |
| Infinite scroll | Harder a11y (focus, footer reach), duplicate/stale pitfalls; Load More is simpler and demonstrably correct | If analytics show Load More friction |
| TV shows & people pages | Different data models; scope doubles | Phase 2 |
| Streaming availability ("where to watch") | Extra endpoint/region logic and attribution rules | After checking TMDB terms |
| AI recommendations | Unrelated to graded skills; adds cost and complexity | Never for this assignment |
| PWA / offline / service worker | Caching rules can mask race/stale bugs during evaluation | After tests are automated |
| E2E automated tests (Playwright) | Time; manual + unit tests suffice for V1 | Before any public release |
| Light theme / theme switcher | Doubles visual QA | When tokens are stable |
| i18n / localisation | TMDB supports `language`; UI strings need extraction | When there's a target audience |
| Server-side caching/proxy features (rate limiting, CDN cache) | Minimal proxy is enough | If traffic grows |
| Reviews, ratings submission, comments | Needs backend + moderation | — |
| Compare movies | Nice but unrelated to core | Phase 2 |
| Advanced search (multi-search, person search, fuzzy typo-correction) | Extra API surface and ranking edge cases | After V1 |
| Analytics SaaS | Privacy + overhead; local diagnostics cover needs | Production only |
| Scroll-position restoration (if cut) | Fiddly with async content | Polish pass |
| Suggestions combobox (if cut) | A11y complexity | Polish pass |
| Gallery (if cut) | Lowest value per effort | Polish pass |
| Virtualised grid | Needed only for hundreds of cards | If Load More lists get long |
| Sentry-style error monitoring | Production concern | Public launch |
