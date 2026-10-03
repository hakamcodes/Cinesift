# Project: Cinesift (movie search app, FLUX Technical Club evaluation)

Read /docs before coding. Sources of truth, in this order:
docs/STATE_AND_ASYNC_FLOW.md, docs/ARCHITECTURE.md, docs/API_SPEC.md, docs/PRD.md,
docs/UI_UX_SPEC.md, docs/DATABASE_AND_STORAGE.md, docs/ACCEPTANCE_CRITERIA.md, docs/TEST_PLAN.md.

## Hard rules
- Vanilla JS (ES modules) + Vite. No frameworks. No new dependency without asking me first.
- Follow the folder structure in docs/ARCHITECTURE.md §2 exactly.
- UI code never imports tmdbAdapter and never calls fetch. Only storage.js touches localStorage.
- Never invent TMDB endpoints, params, or response fields. Anything marked [VERIFY] in docs/API_SPEC.md:
  open the official TMDB docs, check it, and report. If unsure, stop and ask.
- Debounce delay = 300 ms, defined once as DEBOUNCE_MS in src/config.js.
- Never put API/user/storage text into innerHTML. Use textContent or escaped templates.
- No secrets in code, commits, logs, or the diagnostics panel. Token lives in .env.local / host env vars only.
- Work ONLY on the phase or task I name. Do not build ahead. Do not edit files outside the task's scope.
- Keep files under ~200 lines. JSDoc on exported functions. Plain, readable code a first-year student can explain.

## After every task, report
1. Files created/changed.
2. Exact commands/steps for me to verify it.
3. Which TEST_PLAN / ACCEPTANCE_CRITERIA IDs you believe are satisfied, and which you could NOT verify.
4. Anything you skipped, assumed, or are unsure about.
Do not claim tests pass unless you actually ran them and show the output.