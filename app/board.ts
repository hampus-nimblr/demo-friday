/**
 * Boards are the campaign namespaces: `/` is the house board, `/polan` keeps a
 * separate set of runs and its own leaderboard.
 *
 * The slug arrives from the URL, so it is untrusted input that ends up inside a
 * storage key — the reason this lives in one shared module rather than being
 * interpolated at each call site.
 */

/** The unsuffixed board at `/`. */
export const DEFAULT_BOARD = "house";

/**
 * Only these characters, and never more than 32 of them.
 *
 * A whitelist rather than an escape: the key format is colon-delimited, so a
 * slug allowed to contain `:` could address another board's key — or something
 * else entirely in the same store. Nothing here can escape one segment.
 */
const SLUG = /^[a-z0-9][a-z0-9-]{0,31}$/;

/**
 * Any well-formed slug currently opens a board on first visit, which is what
 * makes campaign links shareable without a deploy. The cost is that the key
 * space is visitor-controlled: every distinct URL mints a ZSET that then lives
 * forever, and nothing rate-limits inventing them.
 *
 * If boards should instead be a fixed set, this is the single switch — list them
 * here and normalizeBoard() starts 404ing everything else:
 *
 *   const ALLOWED = new Set(["polan", "acme"]);
 */
const ALLOWED: Set<string> | null = null;

/**
 * Folds a raw URL segment to a canonical board name, or null if it isn't one.
 *
 * Lowercased so `/Polan` and `/polan` are one board rather than two — path
 * matching is case-sensitive, so without this the same link shared with
 * different capitalisation would split a campaign's leaderboard in half.
 */
export function normalizeBoard(raw: string | null | undefined): string | null {
  if (!raw) return DEFAULT_BOARD;
  const slug = decodeURIComponent(raw).trim().toLowerCase();
  if (slug === DEFAULT_BOARD) return DEFAULT_BOARD;
  if (!SLUG.test(slug)) return null;
  if (ALLOWED && !ALLOWED.has(slug)) return null;
  return slug;
}

/**
 * The house board deliberately keeps the bare `leaderboard:v1` key it has
 * always used — suffixing it would orphan the runs already in the store.
 */
export function keyFor(board: string): string {
  return board === DEFAULT_BOARD ? "leaderboard:v1" : `leaderboard:v1:${board}`;
}

/** How a board is labelled on screen. `polan` → `Polan`. */
export function boardLabel(board: string): string {
  return board
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}
