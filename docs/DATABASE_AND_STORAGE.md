# DATABASE_AND_STORAGE — localStorage architecture

No server database in V1. Reason: single-device personal lists don't need accounts; adding a DB adds auth, privacy, and hosting surface without improving the graded areas.

## 1. Keys & ownership

| Key | Owner module | Content | Size cap |
|---|---|---|---|
| `cinesift:watchlist:v1` | `watchlistStore` | Versioned envelope with items | ~200 items (~40 KB) |
| `cinesift:history:v1` | `historyStore` | Versioned envelope with queries | 8 entries |
| `cinesift:prefs:v1` (optional) | — | e.g. diagnostics open | tiny |

Namespace prefix prevents collisions on shared origins (e.g., `localhost:5173` used by other projects).

## 2. Watchlist

### 2.1 Schema

```json
{
  "v": 1,
  "items": [
    { "id": 27205, "title": "Inception", "posterPath": "/abc.jpg", "year": 2010, "rating": 8.4, "addedAt": 1767225600000 }
  ]
}
```
Newest first. `id` unique (positive integer). Snapshot only (no overview/cast).

### 2.2 Behaviour

| Action | Rule |
|---|---|
| Add | Validate summary (id integer > 0, title string) → if `id` exists: no-op (return `false`, no duplicate) → `unshift` snapshot with `addedAt=Date.now()` → persist → notify subscribers |
| Remove | Filter by id; if absent: no-op (return `false`, no error) |
| Toggle | `has(id) ? remove : add`; return new state |
| Undo remove | Re-insert at original index (kept in toast closure for 5 s) |
| Clear all | Confirm dialog; then `items=[]` |
| Cap | If > 200 items: reject add with toast "Watchlist is full (200)" |
| Cross-tab | Listen to `storage` event → reload from storage → re-render (keeps tabs consistent) |
| Persistence | Write after every mutation (synchronous, small payload) |

### 2.3 Validation on load (`readJSON(key, default, validator)`)

```js
function loadWatchlist() {
  const raw = safeGet(KEY);                    // null if missing or storage unavailable
  if (raw == null) return { items: [], available: isAvailable() };
  let parsed;
  try { parsed = JSON.parse(raw); } catch { return recover('parse'); }
  const migrated = migrate(parsed);            // see §2.4
  if (!migrated || !Array.isArray(migrated.items)) return recover('shape');
  const seen = new Set();
  const items = migrated.items.filter(x =>
    Number.isInteger(x?.id) && x.id > 0 && typeof x.title === 'string' && !seen.has(x.id) && seen.add(x.id));
  return { items, available: true };
}
function recover(reason) {
  // keep a one-time backup of the corrupt string for debugging, then reset
  try { localStorage.setItem(KEY + ':corrupt', raw.slice(0, 20000)); localStorage.removeItem(KEY); } catch {}
  diag.emit('storage_corrupt', { key: KEY, reason });
  toast('Your saved list couldn\'t be read and was reset.');
  return { items: [], available: isAvailable() };
}
```
Partial corruption (some bad items) → drop bad items, keep good ones, no toast (log only).

### 2.4 Versioning & migration

- Envelope field `v`. Current = 1.
- `migrate(obj)`: if `Array.isArray(obj)` (a hypothetical v0 stored a bare array of ids/objects) → wrap `{v:1, items: obj.map(toSnapshotOrNull).filter(Boolean)}`. If `v > CURRENT` (newer app wrote it) → do **not** overwrite; read-only fallback: use items if valid else empty without deleting; show nothing. If `v < CURRENT` → run stepwise migrations `m1→m2…`, then write back.
- Changing the shape later: bump key suffix **or** bump `v` + add migration; never silently reinterpret old data.

## 3. Search history

### 3.1 Schema
```json
{ "v": 1, "items": [ { "q": "batman", "t": 1767225600000 }, { "q": "inception", "t": 1767225000000 } ] }
```

### 3.2 Rules

| Rule | Decision |
|---|---|
| Max entries | 8 |
| Order | Newest first |
| What is saved | Normalised query, **only when**: (a) search returned `success` (≥1 result) **or** user pressed Enter (explicit intent) — and query length ≥ 2. Never save every debounced partial (`ba`, `bat`) or empty-result nonsense typed by accident (Enter-submitted nonsense is saved: explicit) |
| Dedupe | Case-insensitive on normalised query; existing entry removed then re-added at top with new timestamp |
| Click item | Navigate `/search?q=…` (pushState) and run immediately (skip debounce) |
| Remove one | ✕ on chip |
| Clear all | "Clear all" button; no confirm needed (low stakes) — optional toast Undo |
| Privacy note | Stored only on device; "Clear all" in UI |
| Corruption | Same `readJSON` + validator; entries must be `{q: string 2–100, t: number}`; drop invalid; dedupe; slice(0,8) |
| Unavailable storage | In-memory array for the session; `available=false` → show small notice once |

## 4. `storage.js` helper

```js
export function isAvailable() {
  try { const k='__t'; localStorage.setItem(k,'1'); localStorage.removeItem(k); return true; }
  catch { return false; }          // Safari private mode (old), blocked cookies, quota
}
export function safeGet(key) { try { return localStorage.getItem(key); } catch { return null; } }
export function safeSet(key, str) {
  try { localStorage.setItem(key, str); return true; }
  catch (e) { return false; }      // QuotaExceededError etc. → caller shows toast, keeps memory copy
}
```
Wrapping every access in `try/catch` is required: `localStorage` access itself can throw (disabled storage, sandboxed iframes).

## 5. Memory fallback
Stores keep an in-memory copy as source of truth for the session; persistence is a side-effect. If `safeSet` fails: continue working in memory, set `available=false`, show one toast per session.

## 6. Security / privacy notes
- Never store tokens/API keys in localStorage.
- Render stored titles with `textContent` (or escaped templates) — stored data is untrusted (user can edit it in DevTools; XSS if injected into `innerHTML`).
- Validate `posterPath` matches `/^\/[\w.-]+\.(jpg|jpeg|png|webp)$/` before building image URLs.

## 7. Tests (see TEST_PLAN)
Invalid JSON string · valid JSON wrong shape · array instead of object · duplicate ids · missing fields · huge payload · `v:99` future version · storage throws on get/set · two-tab sync · quota exceeded on set.
