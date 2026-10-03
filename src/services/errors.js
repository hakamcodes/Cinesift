/**
 * services/errors.js
 * AppError class and helper to map HTTP responses to typed errors.
 *
 * Categories match ARCHITECTURE.md §7:
 *   network | timeout | rate_limit | server | auth | not_found | malformed | aborted
 */

/**
 * All known error categories.
 * @readonly
 */
export const ErrorCategory = /** @type {const} */ ({
  NETWORK:    'network',
  TIMEOUT:    'timeout',
  RATE_LIMIT: 'rate_limit',
  SERVER:     'server',
  AUTH:       'auth',
  NOT_FOUND:  'not_found',
  MALFORMED:  'malformed',
  ABORTED:    'aborted',
});

/** Human-readable messages shown in the UI per category. */
const MESSAGES = {
  [ErrorCategory.NETWORK]:    'You appear to be offline.',
  [ErrorCategory.TIMEOUT]:    'Request took too long.',
  [ErrorCategory.RATE_LIMIT]: 'Too many requests. Try again shortly.',
  [ErrorCategory.SERVER]:     'Movie service is having trouble.',
  [ErrorCategory.AUTH]:       'API key rejected.',
  [ErrorCategory.NOT_FOUND]:  'Movie not found.',
  [ErrorCategory.MALFORMED]:  'Unexpected response from server.',
  [ErrorCategory.ABORTED]:    '', // never shown
};

/** Categories where Retry is offered to the user. */
const RETRYABLE = new Set([
  ErrorCategory.NETWORK,
  ErrorCategory.TIMEOUT,
  ErrorCategory.RATE_LIMIT,
  ErrorCategory.SERVER,
  ErrorCategory.MALFORMED,
]);

/**
 * Typed application error, enriched beyond the plain Error.
 */
export class AppError extends Error {
  /**
   * @param {string} category  - One of ErrorCategory values.
   * @param {string} [detail]  - Optional developer-facing detail (never shown to users).
   * @param {{ cause?: Error, retryable?: boolean, retryAfter?: number }} [opts]
   */
  constructor(category, detail = '', opts = {}) {
    super(detail || MESSAGES[category] || category);
    this.name = 'AppError';
    this.category = category;
    // User-facing message (safe to display).
    this.userMessage = MESSAGES[category] || 'Something went wrong.';
    // Whether the user should be offered a Retry button.
    this.retryable = opts.retryable ?? RETRYABLE.has(category);
    // Seconds until retry is allowed (for 429 Retry-After header).
    this.retryAfter = opts.retryAfter ?? null;
    // Original error for debugging (never surfaced to UI).
    this.cause = opts.cause ?? null;
  }
}

/**
 * Convert an HTTP error response into an AppError.
 * Reads the TMDB error body when available.
 *
 * @param {Response} res - A fetch Response where res.ok === false.
 * @returns {Promise<AppError>}
 */
export async function mapHttpError(res) {
  // Try to parse the TMDB error body for the status_message.
  let detail = '';
  try {
    const body = await res.json();
    // Never expose raw server messages to users — only use for dev detail.
    detail = body?.status_message || '';
  } catch {
    // If JSON parsing fails, that's fine — we just won't have detail.
  }

  // Map HTTP status codes to categories.
  if (res.status === 401) return new AppError(ErrorCategory.AUTH, detail, { retryable: false });
  if (res.status === 404) return new AppError(ErrorCategory.NOT_FOUND, detail, { retryable: false });
  if (res.status === 429) {
    const retryAfter = parseInt(res.headers.get('Retry-After') ?? '0', 10) || null;
    return new AppError(ErrorCategory.RATE_LIMIT, detail, { retryable: true, retryAfter });
  }
  if (res.status >= 500) return new AppError(ErrorCategory.SERVER, detail, { retryable: true });

  // Unknown status code — treat as server error.
  return new AppError(ErrorCategory.SERVER, `HTTP ${res.status}: ${detail}`, { retryable: true });
}

/**
 * Wrap any unknown error in an AppError.
 * Preserves AbortErrors and existing AppErrors unchanged.
 *
 * @param {unknown} err
 * @returns {AppError}
 */
export function toAppError(err) {
  if (err instanceof AppError) return err;
  if (err instanceof Error && err.name === 'AbortError') {
    return new AppError(ErrorCategory.ABORTED, 'Request aborted', { retryable: false });
  }
  if (err instanceof TypeError) {
    // fetch() throws TypeError for network failures (offline, DNS, CORS).
    return new AppError(ErrorCategory.NETWORK, err.message, { retryable: true, cause: err });
  }
  return new AppError(ErrorCategory.SERVER, String(err), { retryable: true });
}
