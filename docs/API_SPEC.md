# API_SPEC — TMDB v3 integration

> **Verification status (2026-10-03):** Auth methods, rate-limit stance, and image-URL construction below were checked against developer.themoviedb.org (pages: *Authentication → Application*, *Rate Limiting*, *Images → Basics*). Endpoint paths and parameters marked **[VERIFY]** come from widely used documented behaviour but **you must confirm each in the official API Reference** (`https://developer.themoviedb.org/reference`) before coding — do not trust this document over the official docs. An OpenAPI spec is linked from the docs header (`/openapi`) and is the fastest way to check parameter names.

## 1. OMDb vs TMDB

| Criterion | OMDb | TMDB | Winner |
|---|---|---|---|
| Search quality | Title search, simple | Title search, popularity-weighted, localised | TMDB |
| Details | Plot, actors, ratings (IMDb/RT) | Rich details + credits + crew | TMDB |
| Images | Single poster URL | Posters, backdrops, sizes, galleries | TMDB |
| Trailers | None | `videos` (YouTube keys) | TMDB |
| Similar movies | None | `similar` / `recommendations` | TMDB |
| Discovery/trending | None | `trending`, `discover`, popular lists | TMDB |
| Filtering / sorting | Year, type only | `discover` supports genre, rating, year, sort | TMDB |
| Pagination | 10/page | 20/page, `total_pages` | TMDB |
| Docs | Short | Extensive + OpenAPI | TMDB |
| Rate limits | Free tier daily cap (check site) | No hard legacy limit; soft upper limit ≈ 40 req/s, respect `429` (per Rate Limiting page) | TMDB |
| Key model | API key query param | API key **or** Bearer read token | tie |
| Frontend complexity | Low | Medium (config, image URLs, genre map) | OMDb |
| Student suitability | Quick but cannot support the product vision | Needs a free TMDB account; best fit | **TMDB** |

**Decision: TMDB.** Cost: more adapter work (image URL building, genre id→name map, `append_to_response`). That work is the point — it justifies the adapter layer.

**Attribution requirement:** TMDB's terms require attributing TMDB and not implying endorsement. Add footer text: *"This product uses the TMDB API but is not endorsed or certified by TMDB."* (and logo if required — check current terms of use).

## 2. Authentication

TMDB v3 supports (verified):
- `api_key` query parameter, **or**
- `Authorization: Bearer <API Read Access Token>` header. Same access level; Bearer works for v3 and v4.

Obtain both under TMDB account → Settings → API.

**Chosen:** Bearer token **server-side only** (proxy) for deployment; for local dev use token in `.env.local`. See §8.

## 3. Endpoints used

Base: `https://api.themoviedb.org/3` · Images: `https://image.tmdb.org/t/p/{size}{file_path}` (verified)

| Purpose | Method + path | Key params | Notes |
|---|---|---|---|
| Search | `GET /search/movie` | `query`, `page`, `include_adult=false`, `language=en-US`, `year` or `primary_release_year` **[VERIFY which]** | **No** genre/rating/sort params **[VERIFY]** |
| Discover (filters) | `GET /discover/movie` | `with_genres`, `primary_release_year`, `vote_average.gte`, `vote_count.gte`, `sort_by`, `page`, `include_adult=false` | Used when no text query |
| Trending | `GET /trending/movie/{day\|week}` | `language`, `page` | Home feed (use `week`) |
| Details bundle | `GET /movie/{id}` | `append_to_response=credits,videos,images,similar`, `include_image_language=en,null` **[VERIFY each name]** | One request; verified that `append_to_response` exists and combines sub-requests |
| Genre list | `GET /genre/movie/list` | `language` | Map `genre_ids` → names; cache for session |
| Configuration | `GET /configuration` | — | `images.base_url`, sizes; may hardcode `https://image.tmdb.org/t/p/` + cache config |

Common response envelope for lists: `{ page, results[], total_pages, total_results }` **[VERIFY]**.
Error body: `{ status_code, status_message, success:false }` **[VERIFY]**.
Max page for search/discover is capped (historically 500) → clamp `page` and hide Load More beyond `totalPages` **[VERIFY]**.

### 3.1 Image sizes (verify list via `/configuration`)

| Use | Kind | Suggested size |
|---|---|---|
| Card poster | poster | `w342` (with `srcset` `w185` / `w342` / `w500`) |
| Details poster | poster | `w500` |
| Hero backdrop | backdrop | `w1280` (mobile `w780`) |
| Gallery thumb / full | backdrop | `w300`→ thumb, `w1280`/`original` → lightbox |
| Cast photo | profile | `w185` |

Never request `original` for grids.

## 4. Filters & sorting — the capability mismatch (critical design point)

`/search/movie` filters only by text (+ year-type params). `/discover/movie` filters by genre/rating/year/sort but has **no text query** **[VERIFY both]**. They are **different endpoints with different capabilities**. The PRD handles this explicitly instead of pretending filters "just work":

| Mode | Trigger | Endpoint | Genre | Min rating | Year | Sort |
|---|---|---|---|---|---|---|
| **Browse** (no text) | `/search` with empty `q` but filters set, or Home "Browse" | `discover/movie` | server `with_genres` | server `vote_average.gte` (+`vote_count.gte=50` to avoid 10.0 from 1 vote) | server `primary_release_year` | server `sort_by` (popularity.desc, vote_average.desc, primary_release_date.desc, title.asc) |
| **Text search** | `q` ≥ 2 chars | `search/movie` | **client-side** on `genre_ids` | **client-side** on `rating` | server (`year`) | **client-side** sort of loaded results; default "Relevance" = API order |

UI must be honest: in text-search mode the filter bar shows a small note — *"Filters apply to loaded results"* — and the results header shows `Showing 14 of 40 loaded`. Load More may add items that pass the filter; if the filter hides everything loaded, show a **filtered-empty** state ("No loaded results match filters. Load more or reset filters") distinct from search-empty.

**Sort option set:**

| UI label | Browse mode (`sort_by`) | Search mode (client) |
|---|---|---|
| Relevance / Popular | `popularity.desc` | API order |
| Rating | `vote_average.desc` | `rating` desc (nulls last) |
| Newest | `primary_release_date.desc` | `releaseDate` desc |
| Title A–Z | `original_title.asc` **[VERIFY]** | `title.localeCompare` |

Defaults: `genre=null, year=null, minRating=0, sort=relevance`. Reset button sets all and re-runs.
Filter changes: cancel pending debounce, abort in-flight, reset `page=1`, run immediately (no 300 ms delay — it's a discrete click, not typing).

## 5. Normalised internal model

```ts
type MovieSummary = {
  id: number;                 // required — rows without id are dropped
  title: string;              // fallback: original_title → "Untitled"
  originalTitle: string|null;
  posterPath: string|null;    // raw path; URL built by format.imageUrl()
  releaseDate: string|null;   // 'YYYY-MM-DD' or null (TMDB may return "")
  year: number|null;
  rating: number|null;        // 0–10, one decimal; null if voteCount==0
  voteCount: number;
  overview: string;           // '' if missing
  genreIds: number[];
  language: string|null;      // ISO 639-1
};

type MovieDetails = MovieSummary & {
  backdropPath: string|null;
  tagline: string|null;
  runtime: number|null;       // minutes; null if 0/missing
  genres: {id:number; name:string}[];
  status: string|null;
  imdbId: string|null;        // only if used for external link
  director: string|null;      // from crew where job === 'Director' (first)
  cast: {id:number; name:string; character:string|null; profilePath:string|null}[];  // top 12 by order
  trailer: {key:string; site:'YouTube'; name:string}|null;   // preferred trailer
  videos: {key:string; site:string; type:string; name:string; official:boolean}[];   // YouTube-only, trimmed
  backdrops: {filePath:string; width:number; height:number}[];   // ≤ 12
  similar: MovieSummary[];    // ≤ 12, excluding current id
};

type Page<T> = { page:number; totalPages:number; totalResults:number; items:T[] };
```

### 5.1 Field → screen map (store only what's needed)

| Field | Card | Details | Watchlist item | Notes |
|---|---|---|---|---|
| id, title | ✔ | ✔ | ✔ | |
| posterPath | ✔ | ✔ | ✔ | |
| year, rating | ✔ | ✔ | ✔ | |
| genre names | opt (first 2) | ✔ | — | via genre map |
| overview | — (maybe 2-line on hover desktop) | ✔ | — | |
| runtime, tagline, director, cast, trailer, backdrops, similar | — | ✔ | — | |

**Watchlist stores a trimmed snapshot** `{id,title,posterPath,year,rating,addedAt}` (no overview/cast) to keep storage small and cards renderable offline.

## 6. Normalisation rules (adapter responsibilities)

| Raw (TMDB) | Rule |
|---|---|
| `release_date` `""`/missing | `releaseDate=null, year=null` → card shows "—" |
| `poster_path` null | `posterPath=null` → fallback art |
| `vote_average` 0 with `vote_count` 0 | `rating=null` → show "NR" |
| `runtime` 0/null | `runtime=null` → hide stat |
| `genre_ids` missing | `[]` |
| `results` not an array | throw `malformed` |
| item missing `id` | drop item, count `malformedItems` in diagnostics |
| `credits.crew` | `director = crew.find(c=>c.job==='Director')?.name ?? null` |
| `videos.results` | filter `site==='YouTube'`; trailer = first of (`type==='Trailer' && official`) → (`type==='Trailer'`) → (`type==='Teaser'`) → null |
| `images.backdrops` | sort by `vote_average` desc, take 12 |
| `similar.results` | filter out self id, take 12 |

Adapter returns frozen plain objects; **no raw TMDB keys leak past the adapter** (grep for `_path` outside adapter/format in review).

## 7. Request/error handling

```js
async function http(path, params, signal) {
  const url = buildUrl(path, params);
  let res;
  try {
    res = await fetch(url, { signal, headers });
  } catch (e) {
    if (e.name === 'AbortError') throw e;           // let caller decide (own abort vs timeout)
    throw new AppError('network', 'Network error', { cause: e, retryable: true });
  }
  if (!res.ok) throw await mapHttpError(res);       // 401/404/429/5xx → AppError
  let json;
  try { json = await res.json(); }
  catch (e) { throw new AppError('malformed', 'Invalid JSON', { retryable: true }); }
  return json;
}
```

- **Timeout:** 10 s per request via a timer that calls `controller.abort(timeoutReason)`; combine with the manager's controller (or use `AbortSignal.any([...])` where supported, with a manual fallback).
- **429:** read `Retry-After` if present; show "Try again in Ns" and enable Retry after delay. Do not auto-loop.
- **Retry policy:** user-clicked Retry always allowed. Automatic single retry (500 ms + jitter) only for discovery/details loads on `network|server|malformed`; **never** auto-retry while user is typing (the next keystroke is the retry).
- Log category + status + duration to diagnostics. Never log the token or full URL with `api_key`.

## 8. Credential handling & security

| Question | Answer |
|---|---|
| Is a key required? | Yes (free). |
| Safe to expose? | Any credential placed in browser code is public. TMDB read access is low-risk, but it is **your** quota/account; treat it as secret. Image URLs and movie IDs are public. |
| Must stay secret | API Read Access Token / API key. Never commit; never put in README/screenshots/demo URL. |
| Local dev | `.env.local` (`VITE_TMDB_TOKEN`) git-ignored. Anything `VITE_`-prefixed is **bundled into client JS** — acceptable only locally. Commit `.env.example` only. |
| Deploy | Serverless proxy holds token in host env vars (not `VITE_`). Browser calls `/api/tmdb`. |
| Proxy design | Allow-list of paths (`search/movie`, `discover/movie`, `trending/movie/*`, `movie/:id`, `genre/movie/list`, `configuration`); validate/forward only known query params; GET only; add `Cache-Control: public, max-age=60` for trending/genres; no CORS wildcard if same-origin. |
| Is proxy required? | Not for the assignment. Recommended because it's ~40 lines and answers the viva question "where is your key?" correctly. If time is short, direct mode is acceptable **if you can state the trade-off honestly.** |
| Rotation | If key was ever committed: rotate in TMDB settings, purge from git history. |

Proxy sketch (Netlify Function; adapt for Vercel):

```js
// netlify/functions/tmdb.js
const ALLOW = [/^search\/movie$/, /^discover\/movie$/, /^trending\/movie\/(day|week)$/,
               /^movie\/\d+$/, /^genre\/movie\/list$/, /^configuration$/];
export default async (req) => {
  const u = new URL(req.url);
  const path = u.searchParams.get('path') ?? '';
  if (!ALLOW.some(r => r.test(path))) return new Response('Bad path', { status: 400 });
  u.searchParams.delete('path');
  const up = await fetch(`https://api.themoviedb.org/3/${path}?${u.searchParams}`, {
    headers: { Authorization: `Bearer ${process.env.TMDB_TOKEN}`, accept: 'application/json' },
  });
  return new Response(up.body, { status: up.status, headers: { 'content-type': 'application/json' } });
};
```
(Verify your host's current function signature; Netlify/Vercel APIs change.)

## 9. Mock adapter (for demos & tests)

`mockAdapter` implements the same interface as `tmdbAdapter` with fixtures and a latency table, e.g.:

| Query | Latency | Purpose |
|---|---|---|
| `bat` | 1800 ms | slow older request |
| `batman` | 250 ms | fast newer request → arrives first |
| `zzzzqx` | 200 ms | returns empty list |
| `fail` | 300 ms | throws `server` error |
| `slow` | 12000 ms | triggers timeout |

Honours `signal` (rejects with `AbortError` when aborted) so abort behaviour is realistic. Enabled via `?mock=1` or `VITE_TMDB_MODE=mock`. Lets you demonstrate the race **deterministically** even on bad Wi-Fi.

## 10. Implementation checklist for verifying the docs

- [ ] Confirm `/search/movie` params (`query,page,include_adult,language,year,primary_release_year,region`).
- [ ] Confirm `/discover/movie` params & `sort_by` values.
- [ ] Confirm `append_to_response` accepts `credits,videos,images,similar` and the per-request limit on appended items.
- [ ] Confirm `include_image_language` behaviour for `images`.
- [ ] Confirm max page limit.
- [ ] Confirm CORS works from browser origin (or use proxy).
- [ ] Confirm attribution text/logo rules in TMDB terms.
- [ ] Confirm image sizes via `/configuration`.
