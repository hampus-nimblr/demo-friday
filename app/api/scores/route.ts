import { Redis } from "@upstash/redis";
import { NextResponse } from "next/server";

import { keyFor, normalizeBoard } from "@/app/board";
import { isValidEmail } from "@/app/email";

export const runtime = "nodejs";
/** The board changes on every run, so nothing here may be cached. */
export const dynamic = "force-dynamic";

/**
 * The shape held in the store. `email` is collected when a pilot starts a run
 * and stays server-side — it is deliberately absent from PublicScore below.
 */
type Score = {
  name: string;
  email: string;
  score: number;
  cleared: number;
  bestCombo: number;
  playedAt: string;
};

/**
 * The shape GET is allowed to serve.
 *
 * Stored and served are separate types on purpose. The board is world-readable
 * and `force-dynamic`, so anything that reaches this response is public — and
 * GET used to hand the stored objects straight to NextResponse.json. Omitting
 * `email` here turns "did we remember to strip it?" into a compile error, and
 * does the same for the next private field someone adds to Score.
 */
type PublicScore = Omit<Score, "email">;

/**
 * One sorted set per board: the member is the run, the ZSET score is the
 * player's points. Ranking is a property of the store, so concurrent finishes
 * can never overwrite each other the way a read-modify-write JSON file did.
 * The key is versioned so a scoring change can start a fresh season, and
 * suffixed per board so `/polan` and `/` never see each other's runs — see
 * keyFor() in app/board.ts.
 */
const BOARD_LIMIT = 100; 

/**
 * Which board a request is talking about.
 *
 * Both verbs read it from `?board=`, not from the request path — the API lives
 * at a fixed route while the board comes from the *page's* URL, so the client
 * has to say which one it is on. Absent means the house board, which keeps old
 * clients and a bare `curl /api/scores` working.
 */
function boardFrom(request: Request): string | null {
  return normalizeBoard(new URL(request.url).searchParams.get("board"));
}

/**
 * Built per request rather than at module scope. Module-level construction runs
 * during the build, where the store's credentials may legitimately be absent —
 * and a missing URL there surfaces as an unrelated "Invalid URL /pipeline" at
 * the first write instead of naming the variable that isn't set.
 */
function getRedis(): Redis {
  const url = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN;
  if (!url || !token) {
    throw new Error(
      `Upstash is not configured: ${[
        !url && "KV_REST_API_URL",
        !token && "KV_REST_API_TOKEN",
      ]
        .filter(Boolean)
        .join(" and ")} missing. Link the store to this project in Vercel, then redeploy.`,
    );
  }
  return new Redis({ url, token });
}

/**
 * Upstash deserialises JSON members automatically, so a member comes back as an
 * object — but a raw string is still possible if it was written by another
 * client. Accept both and drop anything malformed rather than failing the read.
 */
function toScore(member: unknown): Score | null {
  const value = typeof member === "string" ? safeParse(member) : member;
  if (!value || typeof value !== "object") return null;
  const entry = value as Partial<Score>;
  if (typeof entry.name !== "string" || typeof entry.score !== "number") return null;
  return {
    name: entry.name,
    // Runs written before email collection (and the two seeded from
    // data/scores.json) have no address. They are still valid board entries,
    // so default rather than reject.
    email: typeof entry.email === "string" ? entry.email : "",
    score: entry.score,
    cleared: entry.cleared ?? 0,
    bestCombo: entry.bestCombo ?? 0,
    playedAt: entry.playedAt ?? "",
  };
}

/**
 * Strips an address out of text on its way to the client. Only applied to error
 * strings, where the address can turn up because the driver quoted the command
 * that failed — the member it choked on is now PII.
 */
/**
 * The single gate between the stored shape and the wire. Every response body
 * goes through here, so there is exactly one place to audit.
 *
 * Listing the fields rather than deleting `email` is what keeps the boundary
 * honest in both directions: a new *public* field on Score fails to compile
 * until it is added here, and a new *private* one is simply never copied.
 */
function toPublic(entry: Score): PublicScore {
  return {
    name: entry.name,
    score: entry.score,
    cleared: entry.cleared,
    bestCombo: entry.bestCombo,
    playedAt: entry.playedAt,
  };
}

function redact(message: string, email: string): string {
  if (!email) return message;
  return message.split(email).join("[email redacted]");
}

function safeParse(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/**
 * Keeps the board from growing without bound.
 *
 * This matters more than it did: GET now reads the entire ZSET (0..-1) on every
 * request because the board shows all players, and `force-dynamic` means no
 * response is ever cached. Board size is now read cost.
 *
 * TODO(you): decide the retention policy — see the note in chat. The obvious
 * move is ZREMRANGEBYRANK down to the top BOARD_LIMIT runs, but note how that
 * interacts with bestPerName(): trimming ranks *runs* while the board displays
 * *players*, so one strong player with many runs can occupy every surviving slot
 * and evict everyone else — the board would collapse to a handful of rows.
 */
async function trimBoard(key: string): Promise<void> {
  // Intentionally left to you. Note the parameter: retention is now per board,
  // so whatever policy you pick applies to each campaign independently — and
  // the number of boards is itself unbounded (see ALLOWED in app/board.ts).
  void key;
}

/**
 * The ZSET stores one member per *run*, so a player who plays five times owns
 * five rows. The board shows people, not attempts: keep each player's best run
 * and drop the rest.
 *
 * Names are folded to lowercase for grouping so "Hampus" and "hampus" don't
 * split into two rows — but the entry that wins keeps its own casing, so the
 * board displays the name as that player typed it.
 */
function bestPerName(scores: Score[]): Score[] {
  const best = new Map<string, Score>();
  for (const entry of scores) {
    const key = entry.name.toLowerCase();
    const current = best.get(key);
    const wins =
      !current ||
      entry.score > current.score ||
      (entry.score === current.score && entry.cleared > current.cleared);
    if (wins) best.set(key, entry);
  }
  return [...best.values()];
}

export async function GET(request: Request) {
  const board = boardFrom(request);
  // An unusable slug gets an empty board rather than the house board's runs —
  // falling back would quietly show one campaign's scores under another's name.
  if (!board) return NextResponse.json([]);

  try {
    // 0..-1 is the whole board — the client scrolls it rather than showing a
    // truncated top-N, so the read can't be capped here either.
    const members = await getRedis().zrange(keyFor(board), 0, -1, { rev: true });
    const scores: PublicScore[] = bestPerName(
      members.map(toScore).filter((entry): entry is Score => entry !== null),
    )
      // The ZSET orders by points alone; break ties on mails cleared, as before.
      .sort((a, b) => b.score - a.score || b.cleared - a.cleared)
      .map(toPublic);
    return NextResponse.json(scores);
  } catch (error) {
    console.error("Leaderboard read failed", error);
    return NextResponse.json([]);
  }
}

export async function POST(request: Request) {
  const board = boardFrom(request);
  // Writes get a hard error where reads degrade: a run posted against a bad
  // slug would otherwise land on a board nobody is looking at.
  if (!board) return NextResponse.json({ error: "Unknown board" }, { status: 404 });

  const body = (await request.json()) as Partial<Score>;
  const name = body.name?.trim().replace(/\s+/g, " ");
  // Lowercased so the same person typing "H@x.se" and "h@x.se" is one contact.
  const email = body.email?.trim().toLowerCase();
  const score = body.score;
  const cleared = body.cleared;
  const bestCombo = body.bestCombo;

  if (
    !name ||
    name.length > 24 ||
    !email ||
    !isValidEmail(email) ||
    typeof score !== "number" ||
    typeof cleared !== "number" ||
    typeof bestCombo !== "number" ||
    !Number.isInteger(score) ||
    !Number.isInteger(cleared) ||
    !Number.isInteger(bestCombo)
  ) {
    return NextResponse.json({ error: "Invalid score" }, { status: 400 });
  }

  const entry: Score = {
    name,
    email,
    score: Math.max(0, score),
    cleared: Math.max(0, cleared),
    bestCombo: Math.max(0, bestCombo),
    // Also what makes each run a distinct ZSET member.
    playedAt: new Date().toISOString(),
  };

  try {
    const key = keyFor(board);
    await getRedis().zadd(key, { score: entry.score, member: JSON.stringify(entry) });
    await trimBoard(key);
  } catch (error) {
    // Surface the failure so the client can tell the player, instead of the
    // run vanishing silently.
    console.error("Leaderboard write failed", error);
    return NextResponse.json(
      {
        error: "Could not save score",
        // Echoed so a broken deploy can be diagnosed from the response itself
        // rather than by hunting through Vercel logs. No secrets in here —
        // but an Upstash error can quote the command it choked on, and the
        // member is now PII, so scrub the address before it goes out.
        detail: redact(error instanceof Error ? error.message : String(error), entry.email),
      },
      { status: 502 },
    );
  }

  // The client only needs its run back to render it; it already knows the
  // address it just typed, and this response is as public as GET's.
  return NextResponse.json(toPublic(entry), { status: 201 });
}
