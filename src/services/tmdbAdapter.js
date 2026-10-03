/**
 * services/tmdbAdapter.js
 * Vendor-specific layer: builds URLs, adds auth, maps TMDB JSON → internal model.
 *
 * Rules:
 *   - Only this file may call fetch().
 *   - Only this file knows TMDB field names like poster_path, genre_ids, etc.
 *   - Returns frozen plain objects — no TMDB keys leak past this file.
 *
 * VERIFY results (checked against developer.themoviedb.org/reference on 2026-10-03):
 *   - /search/movie: params are query, include_adult, language, primary_release_year, year, page, region.
 *     Both `year` (any release year) and `primary_release_year` (strict) exist. We use `year`.
 *     NO genre, rating, or sort params on search — confirmed.
 *   - Response envelope: { page, results[], total_pages, total_results } — confirmed.
 *   - Error body: { status_code, status_message, success: false } — confirmed.
 *   - Max page: 500 — confirmed.
 *   - Image URL: https://image.tmdb.org/t/p/{size}{file_path} — confirmed.
 *   - append_to_response: credits,videos,images,similar — confirmed working.
 *   - original_title.asc is a valid sort_by value for /discover/movie — confirmed.
 */

import { TMDB_BASE, TMDB_TOKEN, TMDB_API_KEY } from '../config.js';
import { AppError, ErrorCategory, mapHttpError } from './errors.js';

// ─── Auth headers ────────────────────────────────────────────────────────────

/**
 * Build the Authorization header or api_key query param.
 * Prefers Bearer token; falls back to api_key query string.
 * NEVER log these values.
 */
function getAuthHeaders() {
  if (TMDB_TOKEN) {
    return { Authorization: `Bearer ${TMDB_TOKEN}` };
  }
  return {}; // api_key added to URL in buildUrl if needed
}

/**
 * Build a full TMDB URL with query parameters.
 * @param {string} path  - e.g. '/search/movie'
 * @param {object} params - key/value query params
 * @returns {string}
 */
function buildUrl(path, params = {}) {
  const fullPath = `${TMDB_BASE}${path}`;
  const base = fullPath.startsWith('/') && typeof window !== 'undefined' ? window.location.origin : undefined;
  const url = new URL(fullPath, base);

  // Add api_key only when Bearer token is absent.
  if (!TMDB_TOKEN && TMDB_API_KEY) {
    url.searchParams.set('api_key', TMDB_API_KEY);
  }

  // Append all provided params, skipping null/undefined.
  for (const [k, v] of Object.entries(params)) {
    if (v !== null && v !== undefined) {
      url.searchParams.set(k, String(v));
    }
  }
  return url.toString();
}

// ─── HTTP helper ──────────────────────────────────────────────────────────────

/**
 * Fetch a TMDB endpoint and return parsed JSON.
 * Throws AppError on network failure, non-OK status, or invalid JSON.
 *
 * @param {string} path
 * @param {object} params
 * @param {AbortSignal | null} signal
 * @returns {Promise<object>}
 */
async function http(path, params, signal) {
  const url = buildUrl(path, params);
  console.log('TMDB_FETCH_URL:', url);
  let res;
  try {
    res = await fetch(url, {
      signal,
      headers: {
        accept: 'application/json',
        ...getAuthHeaders(),
      },
    });
  } catch (e) {

    // AbortError means the caller cancelled us — rethrow unchanged.
    if (e.name === 'AbortError') throw e;
    // TimeoutError means requestManager aborted due to timeout.
    if (e.name === 'TimeoutError') throw new AppError(ErrorCategory.TIMEOUT, 'Request timed out', { retryable: true });
    // TypeError typically means offline / DNS failure.
    throw new AppError(ErrorCategory.NETWORK, e.message, { cause: e, retryable: true });
  }

  if (!res.ok) throw await mapHttpError(res);

  let json;
  try {
    json = await res.json();
  } catch (e) {
    throw new AppError(ErrorCategory.MALFORMED, 'Invalid JSON', { retryable: true });
  }
  return json;
}

// ─── Normalisers ──────────────────────────────────────────────────────────────

/**
 * Parse a TMDB release_date string into a year number.
 * Returns null if the date is missing or clearly invalid.
 *
 * @param {string | undefined} raw - e.g. "1999-10-15" or ""
 * @returns {number | null}
 */
function parseYear(raw) {
  if (!raw) return null;
  const y = parseInt(raw.slice(0, 4), 10);
  return Number.isFinite(y) && y > 1880 ? y : null;
}

/**
 * Normalise a single raw TMDB movie result into our MovieSummary shape.
 * Drops items without an id.
 *
 * @param {object} raw - One item from results[]
 * @returns {object | null} - MovieSummary, or null if item should be dropped
 */
export function normaliseMovieSummary(raw) {
  // Items without an id are unusable — drop them (AC-LS-3).
  if (!raw?.id) return null;

  const releaseDate = raw.release_date || null;
  const voteCount = raw.vote_count ?? 0;

  return Object.freeze({
    id:            raw.id,
    title:         raw.title || raw.original_title || 'Untitled',
    originalTitle: raw.original_title || null,
    posterPath:    raw.poster_path || null,      // null → fallback art
    releaseDate:   releaseDate || null,           // "" → null
    year:          parseYear(releaseDate),
    // rating is null when voteCount is 0 (shows "NR" in UI)
    rating:        voteCount > 0 ? Math.round((raw.vote_average ?? 0) * 10) / 10 : null,
    voteCount,
    overview:      raw.overview || '',
    genreIds:      Array.isArray(raw.genre_ids) ? raw.genre_ids : [],
    language:      raw.original_language || null,
  });
}

/**
 * Normalise the TMDB page envelope into our Page<MovieSummary> shape.
 *
 * @param {object} json - Parsed TMDB response
 * @returns {{ page, totalPages, totalResults, items }}
 */
export function normalisePage(json) {
  // results must be an array — anything else is malformed.
  if (!Array.isArray(json?.results)) {
    throw new AppError(ErrorCategory.MALFORMED, 'Missing results array', { retryable: true });
  }

  // Normalise each item, dropping nulls (items without id).
  const items = json.results
    .map(normaliseMovieSummary)
    .filter(Boolean);

  return Object.freeze({
    page:         json.page ?? 1,
    totalPages:   json.total_pages ?? 0,
    totalResults: json.total_results ?? 0,
    items,
  });
}

// ─── Adapter exports ──────────────────────────────────────────────────────────

/**
 * Search for movies by text query.
 *
 * @param {{ query: string, page?: number, year?: string|number|null }} params
 * @param {AbortSignal | null} signal
 * @returns {Promise<{ page, totalPages, totalResults, items: MovieSummary[] }>}
 */
export async function search({ query, page = 1, year = null }, signal = null) {
  const json = await http('/search/movie', {
    query,
    page,
    include_adult: false,
    language: 'en-US',
    // `year` matches any release year — more permissive than primary_release_year.
    ...(year ? { year: String(year) } : {}),
  }, signal);

  return normalisePage(json);
}

/**
 * Fetch trending movies (used on the Home page).
 *
 * @param {{ window?: 'day'|'week', page?: number }} [params]
 * @param {AbortSignal | null} signal
 * @returns {Promise<{ page, totalPages, totalResults, items }>}
 */
export async function trending({ window: win = 'week', page = 1 } = {}, signal = null) {
  const json = await http(`/trending/movie/${win}`, { page, language: 'en-US' }, signal);
  return normalisePage(json);
}

// ─── Movie Details ────────────────────────────────────────────────────────────

/**
 * Normalise a single cast member.
 * @param {object} raw
 * @returns {object}
 */
function normaliseCastMember(raw) {
  return Object.freeze({
    id:          raw.id,
    name:        raw.name || 'Unknown',
    character:   raw.character || null,
    profilePath: raw.profile_path || null,
  });
}

/**
 * Normalise a single video entry.
 * @param {object} raw
 * @returns {object}
 */
function normaliseVideo(raw) {
  return Object.freeze({
    key:      raw.key,
    site:     raw.site,
    type:     raw.type,
    name:     raw.name || '',
    official: raw.official ?? false,
  });
}

/**
 * Pick the best trailer from the videos list.
 * Priority: official Trailer → any Trailer → Teaser → null.
 *
 * @param {object[]} videos - Already filtered to YouTube only.
 * @returns {object|null}
 */
function pickTrailer(videos) {
  const yt = videos.filter(v => v.site === 'YouTube');
  return (
    yt.find(v => v.type === 'Trailer' && v.official) ||
    yt.find(v => v.type === 'Trailer') ||
    yt.find(v => v.type === 'Teaser') ||
    null
  );
}

/**
 * Normalise the full movie details response (with append_to_response data).
 *
 * @param {object} json - Raw TMDB response
 * @param {number} selfId - The movie's own id (for self-exclusion in similar)
 * @returns {object} MovieDetails (frozen)
 */
export function normaliseMovieDetails(json, selfId) {
  // Base fields (reuse summary normaliser).
  const summary = normaliseMovieSummary(json);

  // Credits.
  const crew    = Array.isArray(json.credits?.crew) ? json.credits.crew : [];
  const cast    = Array.isArray(json.credits?.cast) ? json.credits.cast : [];
  const director = crew.find(c => c.job === 'Director')?.name ?? null;
  const writers = [...new Set(crew.filter(c => c.department === 'Writing').map(c => c.name))].slice(0, 3);
  const producers = [...new Set(crew.filter(c => c.job === 'Producer').map(c => c.name))].slice(0, 3);
  const composers = [...new Set(crew.filter(c => c.job === 'Original Music Composer').map(c => c.name))].slice(0, 3);
  const topCast  = cast.slice(0, 12).map(normaliseCastMember);

  // Videos (YouTube only).
  const rawVideos = Array.isArray(json.videos?.results) ? json.videos.results : [];
  const videos    = rawVideos.filter(v => v.site === 'YouTube').map(normaliseVideo);
  const trailer   = pickTrailer(videos);

  // Backdrops — sort by vote_average desc, take 12.
  const rawBackdrops = Array.isArray(json.images?.backdrops) ? json.images.backdrops : [];
  const backdrops = rawBackdrops
    .sort((a, b) => (b.vote_average ?? 0) - (a.vote_average ?? 0))
    .slice(0, 12)
    .map(b => Object.freeze({ filePath: b.file_path, width: b.width ?? 0, height: b.height ?? 0 }));

  // Similar (using recommendations for better accuracy) — exclude self, take 12.
  const rawSimilar = Array.isArray(json.recommendations?.results) ? json.recommendations.results : (Array.isArray(json.similar?.results) ? json.similar.results : []);
  const similar = rawSimilar
    .filter(m => m.id !== selfId)
    .slice(0, 12)
    .map(normaliseMovieSummary)
    .filter(Boolean);

  // Genres array.
  const genres = Array.isArray(json.genres)
    ? json.genres.map(g => Object.freeze({ id: g.id, name: g.name || '' }))
    : [];

  const runtime = json.runtime > 0 ? json.runtime : null;

  // Production countries
  const productionCountries = Array.isArray(json.production_countries) ? json.production_countries.map(c => c.name) : [];

  // Watch providers
  const watchProvidersRaw = json['watch/providers']?.results?.US || json['watch/providers']?.results?.GB || {};
  const watchProviders = {
    stream: Array.isArray(watchProvidersRaw.flatrate) ? watchProvidersRaw.flatrate.map(p => p.provider_name) : [],
    rent: Array.isArray(watchProvidersRaw.rent) ? watchProvidersRaw.rent.map(p => p.provider_name) : [],
    buy: Array.isArray(watchProvidersRaw.buy) ? watchProvidersRaw.buy.map(p => p.provider_name) : []
  };

  // Reviews
  const reviews = Array.isArray(json.reviews?.results)
    ? json.reviews.results.slice(0, 3).map(r => Object.freeze({
        author: r.author,
        content: r.content,
        rating: r.author_details?.rating || null
      }))
    : [];

  return Object.freeze({
    ...summary,
    backdropPath: json.backdrop_path || null,
    tagline:      json.tagline || null,
    runtime,
    genres,
    status:       json.status || null,
    imdbId:       json.imdb_id || null,
    director,
    writers,
    producers,
    composers,
    cast:         topCast,
    trailer,
    videos,
    backdrops,
    similar,
    productionCountries,
    watchProviders,
    reviews,
  });
}

/**
 * Fetch full movie details with one request (append_to_response).
 * Verified: credits, videos, images, similar are all valid append_to_response values.
 *
 * @param {number} id - Movie id (must be a positive integer; caller validates).
 * @param {AbortSignal | null} signal
 * @returns {Promise<object>} MovieDetails
 */
export async function details(id, signal = null) {
  const json = await http(`/movie/${id}`, {
    append_to_response:    'credits,videos,images,similar,recommendations,watch/providers,reviews',
    include_image_language: 'en,null',
    language:              'en-US',
  }, signal);

  return normaliseMovieDetails(json, id);
}

// ─── Discover ─────────────────────────────────────────────────────────────────

/**
 * Discover movies via server-side filters (browse mode — no text query).
 * Verified: with_genres, primary_release_year, vote_average.gte, vote_count.gte,
 * sort_by, page, include_adult are all valid /discover/movie params.
 * sort_by values verified: popularity.desc, vote_average.desc,
 * primary_release_date.desc, original_title.asc.
 *
 * @param {{ genre?: number|null, year?: number|null, minRating?: number, sort?: string, page?: number }} params
 * @param {AbortSignal | null} signal
 * @returns {Promise<{ page, totalPages, totalResults, items }>}
 */
export async function discover({
  genre = null,
  year  = null,
  minRating = 0,
  sort = 'popularity.desc',
  page = 1,
} = {}, signal = null) {
  const p = {
    include_adult:          false,
    language:               'en-US',
    sort_by:                sort,
    page,
    // vote_count.gte=50 avoids 10.0-rated movies with 1 vote (API_SPEC §4).
    'vote_count.gte':       minRating > 0 ? 50 : undefined,
    'vote_average.gte':     minRating > 0 ? minRating : undefined,
    with_genres:            genre || undefined,
    primary_release_year:   year || undefined,
  };
  const json = await http('/discover/movie', p, signal);
  return normalisePage(json);
}

// ─── Genre list ───────────────────────────────────────────────────────────────

/**
 * Fetch the TMDB genre list and return id→name map.
 *
 * @param {AbortSignal | null} signal
 * @returns {Promise<Map<number, string>>}
 */
export async function genres(signal = null) {
  const json = await http('/genre/movie/list', { language: 'en-US' }, signal);
  const map = new Map();
  if (Array.isArray(json?.genres)) {
    for (const g of json.genres) {
      map.set(g.id, g.name);
    }
  }
  return map;
}
