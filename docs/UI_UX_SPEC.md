# UI_UX_SPEC — Cinesift

## 1. Design direction ("cinematic, minimal")

Concrete meaning of "premium/cinematic/minimal" (no vague adjectives):
- Dark theme only in V1 (near-black surfaces, one accent). Posters carry the colour; UI chrome stays neutral.
- One accent colour used only for primary actions, focus rings, and rating star.
- Large poster imagery, tight type scale, generous whitespace (8-pt grid).
- Motion only for: hover lift on cards (≤ 4 px), fade/slide of modals, skeleton shimmer, toast in/out. Max 200 ms for interactions, 300 ms for overlays. Respect `prefers-reduced-motion` (disable shimmer/transform, keep opacity fades ≤ 100 ms).
- No glassmorphism, no multi-stop gradients except the single **scrim gradient** over backdrops (needed for text legibility).

## 2. Design tokens

```css
:root {
  /* colour */
  --bg: #0b0c10;           --surface: #14161c;     --surface-2: #1c1f27;
  --border: #2a2e39;       --text: #eceff4;        --text-muted: #a3a9b8;  /* ≥4.5:1 on --bg */
  --accent: #f5c518;       --accent-ink: #14110a;  /* gold; ink on accent ≥ 7:1 */
  --success: #3ecf8e;      --warn: #f5a524;        --danger: #ff5c6c;      --info: #6aa9ff;
  --focus: #8ab4ff;        /* 3:1+ vs bg and vs surface */

  /* type */
  --font-ui: "Inter", system-ui, -apple-system, "Segoe UI", sans-serif;
  --font-display: "Inter", system-ui, sans-serif; /* optional: "Fraunces"/"Playfair Display" for hero titles */
  --fs-xs: 12px; --fs-sm: 14px; --fs-md: 16px; --fs-lg: 20px; --fs-xl: 28px; --fs-2xl: 40px; /* clamp on mobile */
  --lh-tight: 1.2; --lh-body: 1.5;

  /* spacing (8-pt) */
  --s-1: 4px; --s-2: 8px; --s-3: 12px; --s-4: 16px; --s-5: 24px; --s-6: 32px; --s-7: 48px; --s-8: 64px;

  /* shape */
  --r-sm: 6px; --r-md: 12px; --r-lg: 20px; --r-pill: 999px;
  --shadow-1: 0 2px 8px rgb(0 0 0 / .35);   /* only on modals/toasts/hovered cards */

  /* motion */
  --t-fast: 120ms; --t-med: 200ms; --t-slow: 300ms; --ease: cubic-bezier(.2,.8,.2,1);

  /* layout */
  --container: 1280px; --gutter: clamp(16px, 4vw, 40px);
}
```

Breakpoints (mobile-first): `≥ 600px` tablet · `≥ 960px` desktop · `≥ 1280px` wide.

Typography hierarchy: H1 (page/hero) `--fs-2xl`/700 · H2 (section) `--fs-xl`/600 · H3 (card/subsection) `--fs-lg`/600 · Body `--fs-md` · Meta `--fs-sm` muted · Caption `--fs-xs`.
Only one `<h1>` per route.

Buttons: **Primary** (accent bg, accent-ink text) · **Secondary** (surface-2 bg, border) · **Ghost** (transparent, text) · **Icon** (40×40 min, 44×44 on touch) · all `min-height: 44px` on touch devices; loading variant (spinner replaces icon, `aria-busy`, disabled).
Inputs: 48 px tall, `--surface`, 1 px border, radius `--r-pill` for search, focus ring `2px solid var(--focus)` offset 2 px (never remove outline without replacement).
Badges: pill, `--surface-2`; rating badge uses accent star + number.
Status colours only for toasts/inline states, always paired with icon + text (not colour alone).

## 3. Global shell

```
┌────────────────────────────────────────────────────────────┐
│ [logo Cinesift]   [ 🔍 Search movies…   ⌘K ]   Watchlist(3) │  sticky header
└────────────────────────────────────────────────────────────┘
 <main id="main"> … page … </main>
 <footer> TMDB attribution · GitHub · Diagnostics toggle </footer>
 <div role=status class=sr-only id=live></div>
 <div id=toast-root>  <div id=modal-root>  <aside id=diag-root>
```
Skip link "Skip to content" first in DOM. Header is sticky on all breakpoints (search always reachable). On mobile the header is two rows: logo + watchlist icon, then full-width search.

## 4. Routes → screens

### 4.1 Home / Discover (`/`)
Sections in order:
1. **Hero** (desktop: 360 px tall; mobile: auto): headline "Find any movie, instantly." + large search input (the *same* header search is hidden here to avoid two inputs; hero input is the one) + helper line.
2. **Recent searches** chips (only if history non-empty): `[batman ✕] [inception ✕]  Clear all`.
3. **Trending this week**: 12 posters, grid (desktop 6 cols; tablet 4; mobile horizontal scroll-snap row or 2 cols). Title H2, loading = 12 skeleton cards.
4. Optional "Browse by genre" chips → `/search?genre=28` (browse mode).
Failure of trending → inline ErrorState within section (title + Retry); hero/search remain usable.

### 4.2 Search results (`/search`)
```
Header
 Results for “batman”  · 40 loaded of 312        [Filters ▾ (mobile)]
 [Genre ▾] [Year ▾] [Min rating ▾] [Sort ▾]  [Reset]
 note: "Filters apply to loaded results" (search mode)
 ┌ grid ──────────────────────────┐
 │ card card card card card card  │
 └────────────────────────────────┘
 [ Load more ]  / "End of results"
```
Mobile: filters collapse into a bottom sheet (`<dialog>`), applied on "Show results".

### 4.3 Details (`/movie/:id`)
Desktop:
```
┌───────────────── backdrop (w1280) + scrim ─────────────────┐
│  ← Back                                                     │
│  [poster]  Title (Year)  tagline                            │
│            ★ 8.4 (12k) · 2h 32m · PG-13? (omit: not in v3 basic) · EN
│            [genre][genre]                                   │
│            [▶ Watch trailer] [＋ Watchlist] [⤴ Share]       │
└─────────────────────────────────────────────────────────────┘
 Overview (max-width 70ch)         | Facts: Director, Release date, Status, Language
 Cast (horizontal list, 12)
 Gallery (thumb strip, ≤12)
 Similar movies (row, ≤12)
```
Mobile: backdrop 16:9 at top, poster overlaps bottom-left (88 px), title beneath, actions full-width stacked 2-up, facts as definition list, sections stacked.

**Required vs optional sections**

| Section | Required? | If data missing |
|---|---|---|
| Title, poster (fallback ok) | Required | Title "Untitled"; fallback art |
| Backdrop | Optional | Use poster blurred? → No (heavy). Use flat `--surface-2` header with poster |
| Overview | Required block | "No overview available." |
| Rating | Optional | Show "Not rated" |
| Runtime/year/genres | Optional each | Hide stat individually |
| Director | Optional | Hide row |
| Cast | Optional | Hide whole section |
| Trailer button | Always rendered | Disabled + "Trailer unavailable" text (visible, not tooltip-only) |
| Gallery | Optional | Hide section |
| Similar | Optional | Hide section (or "No similar movies found" muted) |

### 4.4 Watchlist (`/watchlist`)
Grid of saved cards (snapshot data). Each card has "Remove" (with undo toast, 5 s). Header: "Your watchlist (N)" + Clear all (confirm dialog). Empty: illustration + "Nothing saved yet" + [Discover movies] button.

### 4.5 404
"Page not found" + link Home.

## 5. Component specs

### 5.1 MovieCard
| Element | Spec |
|---|---|
| Container | `<article>` with a **single** primary link (`<a href="/movie/ID">`) wrapping poster+title (stretched-link pattern: `::after` covers card). Watchlist button sits above with `position:relative; z-index:1` so clicking it doesn't navigate — no JS `stopPropagation` hacks needed |
| Poster | 2:3 aspect box (prevents layout shift), `loading="lazy"`, `decoding="async"`, `srcset` w185/w342/w500, `alt=""` when title is adjacent text (decorative) — **or** `alt="Poster for {title}"` if no adjacent text; choose one consistently: use `alt=""` since title is visible |
| Title | 2-line clamp, `title` attr for full text |
| Meta | `2010 · ★ 8.8` ; missing year → "—"; no rating → "NR" |
| Watchlist button | Icon-only, `aria-pressed`, `aria-label="Add {title} to watchlist"` / "Remove … from watchlist"; 44×44 hit area |
| Hover | translateY(-4px) + border accent-50%, 120 ms; **keyboard focus** shows same + focus ring on the link |
| Missing data | never throws; each field defaulted |

### 5.2 ImageWithFallback
Render `<img>`; on `error` event swap to inline SVG placeholder (film-reel glyph + first letters of title) of same aspect. No broken-image icon ever; set `width/height`/aspect-ratio to avoid CLS. Poster missing from start → render placeholder directly (no request).
Backdrop missing → solid `--surface-2` + subtle pattern. Gallery image errors → remove that thumb from list.

### 5.3 SkeletonGrid / skeletons
Card skeleton = 2:3 block + two text bars. Shimmer: background-position animation 1.2 s linear infinite (disabled under reduced motion). Details skeleton mirrors hero layout. Skeleton regions `aria-hidden="true"`; the container has `aria-busy="true"`.

Loading states by area:
| Area | Loader |
|---|---|
| Home trending | 12 card skeletons |
| Search first page | 12 card skeletons |
| Load More | button shows spinner + "Loading…", disabled; existing grid stays |
| Details | hero skeleton + text bars |
| Similar | 6 card skeletons (only if lazily fetched; with `append_to_response` it arrives with details) |
| Gallery | grey tiles until `<img>` `load` |
| Trailer | modal with spinner until iframe `load`; poster behind |

### 5.4 EmptyState (search)
```
        [illustration: film strip with magnifier]
   No movies found for “xyzqwerty”
   Check the spelling or try a shorter title.
   [Clear search]   Try: Inception · Parasite · Batman
```
- Query is echoed (escaped via `textContent`).
- Input keeps focus and value; typing immediately re-enters the flow.
- "Try:" chips are static popular titles (no API call until clicked).
- Distinct from error: neutral tone, no red, no Retry.
- `role=status` content announced once via live region.
- Filtered-empty variant: "No loaded results match your filters" + [Reset filters] [Load more].
- Watchlist-empty and trending-empty are separate components copy-wise.

### 5.5 ErrorState
Icon + title by category + one-line detail + `[Try again]` (primary) + (for `network`) "Check your connection". Shows retry countdown for `rate_limit`. Preserves the query in the input. Non-blocking variants: inline row (Load More failure), section-level (trending, similar, cast).

### 5.6 Toast
Bottom-center (mobile) / bottom-right (desktop), `role=status`, auto-dismiss 3 s (5 s with Undo), pause on hover/focus, max 1 visible (replace). Used for: watchlist add/remove(+Undo), link copied, share failed, storage unavailable.

### 5.7 Modal (trailer, gallery, confirm, filter sheet)
Use native `<dialog>` + `showModal()` where possible: gives focus trap, Esc, inert background. Requirements: `aria-labelledby`; focus to close button on open; restore focus to trigger on close; lock body scroll; close on Esc, backdrop click, ✕; on mobile trailer is full-width 16:9 centred (landscape: near full-screen).

### 5.8 FilterBar
Selects (native `<select>` — accessible, mobile-friendly): Genre (from `/genre/movie/list`), Year (current year → 1950 + "Any"), Min rating (Any, 5+, 6+, 7+, 8+), Sort. Active filters show count badge; Reset visible when non-default. Changing a select runs immediately (see API §4).

### 5.9 Suggestions (P2)
ARIA 1.2 combobox: `input[role=combobox][aria-expanded][aria-controls][aria-autocomplete=list][aria-activedescendant]` + `ul[role=listbox]` of ≤5 `li[role=option]`.
- Source: **the same successful search response** (top 5). No separate request, so no second race.
- Appears only when status `success` and input focused and results non-empty. Hides on `empty`, `error`, blur (delay 100 ms to allow click), Esc.
- ↑/↓ move active option (wrap), Enter selects (navigates to `/movie/:id`), Esc closes, Enter with no active option = submit search.
- Option: poster thumb 32 px + title + year.
- Announce count via the shared live region: "5 suggestions".

### 5.10 DiagnosticsPanel (P2, eval-facing)
- Toggle: footer link, `Ctrl+Shift+D`, or `?debug=1`.
- Desktop: fixed bottom-left 320 px card; mobile: collapsible bottom drawer (collapsed shows 1 line "Req #17 · SUCCESS · 428ms").
- Content (monospace):
```
Search Diagnostics
Query:            batman
Debounce:         300ms   (pending: no)
Request ID:       #17
Previous Request: Cancelled
Current Status:   SUCCESS
Response Time:    428ms
Results:          20
──────────────
Keystrokes:       6   (valid: 5)
API Requests:     1
Timers cancelled: 4
Requests Prevented: 4
Stale discarded:  1
Aborted:          2
Cache hits:       0
Mode:             mock | direct | proxy
[Reset] [Close]
```
- Live updates throttled to rAF; `aria-hidden` off but not a live region (avoid noise). Never shows tokens/URLs containing credentials. Mock mode lets presenter set per-query latency.

## 6. Pages — state matrix

| Page | idle | loading | success | empty | error |
|---|---|---|---|---|---|
| Home trending | — | 12 skeletons | grid | "No trending data" muted | Section ErrorState + Retry |
| Search | Home-like prompt/recent | skeleton grid | grid + count + Load More | EmptyState | ErrorState |
| Details | — | hero skeleton | full | 404 "Movie not found" | ErrorState + Back |
| Watchlist | — | — (sync) | grid | Watchlist-empty | "Couldn't read saved list" + Reset option |

### 6.4 Search empty/idle specifics
See §5.4 and STATE_AND_ASYNC_FLOW §4.2.

### 6.6 Similar movies
Horizontal scroll-snap row of cards; arrow buttons on desktop (hidden on touch); each is a normal MovieCard linking to `/movie/:id`. Navigating scrolls to top and focuses the new `<h1>` (tabindex -1) for screen readers.

## 7. Overlays & extras

### 7.1 Trailer
- Selection: adapter's `trailer` (official YouTube Trailer → any Trailer → Teaser).
- Embed: `https://www.youtube-nocookie.com/embed/{key}?autoplay=1&rel=0` inside `<iframe title="Trailer: {title}" allow="autoplay; encrypted-media; picture-in-picture" allowfullscreen loading="lazy">`. Create iframe only when modal opens; remove on close (stops playback).
- Fallback: button disabled, text "No trailer available". If iframe fails to load (blocked) after 8 s: show "Open on YouTube" link (`target=_blank rel="noopener noreferrer"`).
- Validate `key` against `/^[\w-]{6,20}$/` before building URL (avoid injection from malformed data).

### 7.2 Gallery
Thumbs (`w300`) row; click opens lightbox (`<dialog>`) with `w1280` image, counter "3 / 12", ←/→ keys, swipe on touch (optional), Esc/✕ closes, preloads next image; image error → skip to next with toast "Image unavailable".

### 7.3 Share
URL = `${location.origin}/movie/${id}` (canonical, no query params). Flow: `navigator.share?.({title, text, url})` → on `AbortError` (user cancelled) do nothing; on other error or absent → `navigator.clipboard.writeText(url)` → toast "Link copied"; if clipboard rejected/unavailable → open small dialog with readonly input preselected + "Press Ctrl/⌘+C". Web Share and Clipboard need a secure context (HTTPS/localhost) and user gesture.

## 8. Responsive component matrix

| Component | Mobile (<600) | Tablet (600–959) | Desktop (≥960) |
|---|---|---|---|
| Navbar | 2 rows: logo+watchlist icon / full-width search | 1 row, search flex | 1 row, search max 560 px centred |
| Search | sticky, 48 px, ⌘K hint hidden | same | ⌘K hint shown |
| Movie grid | 2 columns (gap 12) | 3–4 cols | 5–6 cols (auto-fill minmax(160px,1fr)) |
| Filters | Bottom sheet dialog | Inline wrap row | Inline row |
| Details hero | Stacked, backdrop 16:9, poster 88 px overlap | Poster 160 + text, backdrop 21:9 | Poster 280 + text beside, backdrop 360–440 px |
| Trailer modal | Full-width 16:9; landscape fills screen | 80 vw | max 960 px |
| Cast | Horizontal scroll, 96 px avatars | 5 visible | 8 visible, no scroll |
| Gallery | 2-col thumbs → full-screen lightbox | 4 thumbs/row | 6 thumbs/row; lightbox max 90 vw |
| Watchlist | 2 cols; remove button always visible | 3–4 cols | 5–6 cols; remove on hover+focus |
| Diagnostics | Collapsible bottom drawer | Bottom-left card | Bottom-left card |

Rules: no horizontal page scroll at 320 px; tap targets ≥ 44 px; hover-only affordances must also appear on `:focus-within` and be always visible on `(hover: none)`.

## 9. Keyboard & focus

| Key | Action |
|---|---|
| `/` (not in input) or `Ctrl/⌘+K` | Focus search (prevent default) |
| `Enter` in search | Flush debounce, search now, push history |
| `Esc` | Close top overlay → else blur/clear suggestions → (second Esc in search clears input) |
| `↑ ↓` | Suggestions navigation (when open) |
| `← →` | Gallery prev/next |
| `Tab` order | Skip link → header → search → page content → footer; modals trap focus |

Focus after route change: move focus to `<h1 tabindex="-1">` and update `document.title` (`Batman (2022) — Cinesift`). Back navigation restores scroll position (store `scrollY` per history entry in `history.state`) — P2.

## 10. Accessibility checklist

- Landmarks: `header`, `nav`, `main`, `footer`; headings in order.
- Search input: visible/ sr-only `<label for>`; `type="search"`, `autocomplete="off"`, `enterkeyhint="search"`, `maxlength=100`.
- Results list: `<ul>` of cards; result count in heading; live region per §9 of async doc.
- Images: decorative posters `alt=""` when text adjacent; hero backdrop `alt=""`; cast photos `alt=""` with name text.
- Icon buttons have `aria-label`; toggle buttons use `aria-pressed`.
- Colour contrast: text ≥ 4.5:1, UI components ≥ 3:1; verify with DevTools/axe.
- Focus visible everywhere; no focus loss when content swaps (skeleton → grid keeps focus on input).
- `prefers-reduced-motion` honoured.
- Don't use `title` as the only accessible name.
- Tested with keyboard only + one screen reader pass (NVDA/VoiceOver) on search + details.
- Lighthouse a11y ≥ 95 (target), axe: 0 serious/critical.

## 11. Microcopy

| Situation | Copy |
|---|---|
| Idle hint (1 char) | "Type at least 2 characters to search." |
| Loading | (no text; skeleton) — live region silent |
| Result count | "{n} results for “{q}”" |
| Empty | "No movies found for “{q}”" / "Check the spelling or try a shorter title." |
| Error network | "You appear to be offline." / "Check your connection and try again." |
| Rate-limit | "Too many requests. You can retry in {s}s." |
| Watchlist add/remove | "Added to watchlist" / "Removed · Undo" |
| Storage unavailable | "Saving isn't available in this browser. Your list will reset when you close the tab." |
| Share copied | "Link copied" |
