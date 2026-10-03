/**
 * services/mockAdapter.js
 * Fake adapter for offline demos and deterministic race-condition tests.
 *
 * Enabled when VITE_TMDB_MODE=mock or ?mock=1 in URL.
 *
 * Latency table (AC-RC-8, TEST_PLAN R-1):
 *   bat      → 1800 ms  (slow older request — for race demo)
 *   batman   → 250 ms   (fast newer request — arrives first)
 *   zzzzqx   → 200 ms   (returns empty list)
 *   fail     → 300 ms   (throws server error)
 *   slow     → 12000 ms (triggers timeout)
 *
 * All requests honour the AbortSignal — they reject with AbortError when aborted.
 */

import { AppError, ErrorCategory } from './errors.js';
import { normalisePage } from './tmdbAdapter.js';

// ─── Latency table ─────────────────────────────────────────────────────────

/** Query prefix → delay in ms. Checked with startsWith for partial matches. */
const LATENCY_TABLE = [
  // Order matters: check more-specific strings first.
  { prefix: 'batman', ms: 250 },
  { prefix: 'bat',    ms: 1800 },
  { prefix: 'zzzzqx', ms: 200 },
  { prefix: 'fail',   ms: 300 },
  { prefix: 'slow',   ms: 12_000 },
];

const DEFAULT_LATENCY_MS = 300;

/**
 * Look up the latency for a query string.
 * @param {string} query
 * @returns {number} milliseconds
 */
function latencyFor(query) {
  const q = query.toLowerCase();
  const match = LATENCY_TABLE.find(({ prefix }) => q.startsWith(prefix));
  return match ? match.ms : DEFAULT_LATENCY_MS;
}

// ─── Sleep helper ─────────────────────────────────────────────────────────

/**
 * Wait for `ms` milliseconds, but reject early if `signal` is aborted.
 * This is what makes the mock adapter realistic — it cancels like a real fetch.
 *
 * @param {number} ms
 * @param {AbortSignal | null} signal
 * @returns {Promise<void>}
 */
function sleep(ms, signal) {
  return new Promise((resolve, reject) => {
    // If already aborted, reject immediately.
    if (signal?.aborted) {
      return reject(new DOMException('Aborted', 'AbortError'));
    }

    const handle = setTimeout(resolve, ms);

    // When the signal fires, cancel the sleep.
    const onAbort = () => {
      clearTimeout(handle);
      reject(new DOMException('Aborted', 'AbortError'));
    };
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

// ─── Fixture data ─────────────────────────────────────────────────────────

/** Minimal TMDB-shaped fixture entries used for every non-empty, non-error search. */
const FIXTURES = [
  { id: 268, title: 'Batman', original_title: 'Batman', poster_path: '/tAzPFwIHkAmdqHEBGLCFiWmhFYP.jpg', release_date: '1989-06-23', vote_average: 7.2, vote_count: 7200, genre_ids: [14, 28], original_language: 'en', overview: 'The Dark Knight of Gotham City begins his war on crime.' },
  { id: 414906, title: 'The Batman', original_title: 'The Batman', poster_path: '/74xTEgt7R36Fpooo50r9T25onhq.jpg', release_date: '2022-03-01', vote_average: 7.8, vote_count: 11000, genre_ids: [80, 9648, 28], original_language: 'en', overview: 'Batman ventures into Gotham City\'s underworld.' },
  { id: 272, title: 'Batman Begins', original_title: 'Batman Begins', poster_path: '/dr6x8Y4G1RGMoIXP6Y9shj7pFjv.jpg', release_date: '2005-06-10', vote_average: 7.7, vote_count: 21000, genre_ids: [28, 80, 18], original_language: 'en', overview: 'After witnessing his parents\' murder, Bruce Wayne becomes the Batman.' },
  { id: 49026, title: 'The Dark Knight Rises', original_title: 'The Dark Knight Rises', poster_path: '/hr0L2aueqlP2BYUblTTjmtn0hw4.jpg', release_date: '2012-07-16', vote_average: 7.8, vote_count: 23000, genre_ids: [28, 80, 18], original_language: 'en', overview: 'Eight years after the Joker\'s reign of chaos, Batman resumes his role.' },
  { id: 155, title: 'The Dark Knight', original_title: 'The Dark Knight', poster_path: '/qJ2tW6WMUDux911r6m7haRef0WH.jpg', release_date: '2008-07-14', vote_average: 8.5, vote_count: 32000, genre_ids: [28, 80, 18], original_language: 'en', overview: 'Batman raises the stakes in his war on crime with the Joker.' },
];

// ─── Mock adapter functions ────────────────────────────────────────────────

/**
 * Mock search — simulates latency, special query behaviours, and AbortSignal.
 *
 * @param {{ query: string, page?: number }} params
 * @param {AbortSignal | null} signal
 * @returns {Promise<{ page, totalPages, totalResults, items }>}
 */
export async function search({ query, page = 1 }, signal = null) {
  const q = query.toLowerCase().trim();
  const ms = latencyFor(q);

  // Wait the configured latency (or abort early if signal fires).
  await sleep(ms, signal);

  // 'fail' → throw a server error.
  if (q.startsWith('fail')) {
    throw new AppError(ErrorCategory.SERVER, 'Mock server error', { retryable: true });
  }

  // 'zzzzqx' or any unknown garbage → return empty results.
  if (q.startsWith('zzzzqx') || !q) {
    return normalisePage({ page: 1, total_pages: 0, total_results: 0, results: [] });
  }

  // Return fixture items filtered by the query string (simple prefix match).
  const filtered = FIXTURES.filter(f =>
    f.title.toLowerCase().includes(q) ||
    f.original_title.toLowerCase().includes(q),
  );

  // If nothing matches the fixture, return all (so "batman" etc. always show results).
  const results = filtered.length > 0 ? filtered : FIXTURES;

  return normalisePage({
    page,
    total_pages: 1,
    total_results: results.length,
    results,
  });
}

/**
 * Mock trending — returns the same fixtures instantly.
 *
 * @param {{ window?: string, page?: number }} [params]
 * @param {AbortSignal | null} signal
 * @returns {Promise<{ page, totalPages, totalResults, items }>}
 */
export async function trending({ page = 1 } = {}, signal = null) {
  await sleep(200, signal);
  return normalisePage({
    page,
    total_pages: 1,
    total_results: FIXTURES.length,
    results: FIXTURES,
  });
}

/**
 * Mock details — returns a dummy movie detail based on the fixture.
 *
 * @param {number} id
 * @param {AbortSignal | null} signal
 * @returns {Promise<object>}
 */
export async function details(id, signal = null) {
  await sleep(200, signal);
  const numId = Number(id);
  const base = FIXTURES.find(f => f.id === numId) || FIXTURES[0];

  return {
    id: numId,
    title: base.title,
    originalTitle: base.original_title,
    posterPath: base.poster_path,
    releaseDate: base.release_date,
    year: parseInt(base.release_date?.substring(0, 4)) || null,
    rating: base.vote_average,
    voteCount: base.vote_count,
    overview: base.overview,
    genreIds: base.genre_ids,
    language: base.original_language,
    backdropPath: base.poster_path, // Mock uses poster as backdrop
    tagline: 'Mock tagline for ' + base.title,
    runtime: 120,
    genres: base.genre_ids.map(gid => ({ id: gid, name: 'Genre ' + gid })),
    status: 'Released',
    imdbId: 'tt1234567',
    director: 'Christopher Nolan',
    cast: [
      { id: 1, name: 'Christian Bale', character: 'Bruce Wayne', profilePath: null },
      { id: 2, name: 'Michael Caine', character: 'Alfred', profilePath: null }
    ],
    trailer: { key: 'dQw4w9WgXcQ', site: 'YouTube', type: 'Trailer', name: 'Trailer', official: true },
    videos: [],
    backdrops: [
      { filePath: base.poster_path, width: 1280, height: 720 },
      { filePath: base.poster_path, width: 1280, height: 720 }
    ],
    similar: [],
    writers: ['Bob Kane', 'Bill Finger'],
    producers: ['Charles Roven', 'Emma Thomas'],
    composers: ['Hans Zimmer'],
    productionCountries: ['United States', 'United Kingdom'],
    watchProviders: { stream: ['Netflix'], rent: ['Apple TV'], buy: ['Amazon Video'] },
    reviews: [
      { author: 'Mock Reviewer', content: 'This movie is absolutely amazing! A masterpiece.', rating: 9 }
    ]
  };
}

/**
 * Mock discover — returns fixtures sorted/filtered randomly for demo.
 *
 * @param {object} params
 * @param {AbortSignal | null} signal
 * @returns {Promise<{ page, totalPages, totalResults, items }>}
 */
export async function discover(params = {}, signal = null) {
  await sleep(250, signal);
  return normalisePage({
    page: params.page || 1,
    total_pages: 5,
    total_results: 100,
    results: FIXTURES, // just return fixtures for discover mock
  });
}

/**
 * Mock genres.
 *
 * @param {AbortSignal | null} signal
 * @returns {Promise<Map<number, string>>}
 */
export async function genres(signal = null) {
  await sleep(100, signal);
  const map = new Map();
  map.set(28, 'Action');
  map.set(80, 'Crime');
  map.set(18, 'Drama');
  map.set(9648, 'Mystery');
  map.set(14, 'Fantasy');
  return map;
}
