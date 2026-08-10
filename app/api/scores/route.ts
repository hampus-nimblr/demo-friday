import { Redis } from "@upstash/redis";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
/** The board changes on every run, so nothing here may be cached. */
export const dynamic = "force-dynamic";

type Score = {
  name: string;
  score: number;
  cleared: number;
  bestCombo: number;
  playedAt: string;
};

/**
 * One sorted set holds the whole board: the member is the run, the ZSET score
 * is the player's points. Ranking is a property of the store, so concurrent
 * finishes can never overwrite each other the way a read-modify-write JSON
 * file did. Version the key so a scoring change can start a fresh season.
 */
const KEY = "leaderboard:v1";
const BOARD_LIMIT = 100;

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
    score: entry.score,
    cleared: entry.cleared ?? 0,
    bestCombo: entry.bestCombo ?? 0,
    playedAt: entry.playedAt ?? "",
  };
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
 * TODO(you): decide the retention policy — see the note in chat. Trimming to
 * the top BOARD_LIMIT runs is cheap and keeps reads fast, but it permanently
 * discards a player's early attempts once the board fills up.
 */
async function trimBoard(): Promise<void> {
  // Intentionally left to you.
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

export async function GET() {
  try {
    // 0..-1 is the whole board — the client scrolls it rather than showing a
    // truncated top-N, so the read can't be capped here either.
    const members = await getRedis().zrange(KEY, 0, -1, { rev: true });
    const scores = bestPerName(
      members.map(toScore).filter((entry): entry is Score => entry !== null),
    )
      // The ZSET orders by points alone; break ties on mails cleared, as before.
      .sort((a, b) => b.score - a.score || b.cleared - a.cleared);
    return NextResponse.json(scores);
  } catch (error) {
    console.error("Leaderboard read failed", error);
    return NextResponse.json([]);
  }
}

export async function POST(request: Request) {
  const body = (await request.json()) as Partial<Score>;
  const name = body.name?.trim().replace(/\s+/g, " ");
  const score = body.score;
  const cleared = body.cleared;
  const bestCombo = body.bestCombo;

  if (
    !name ||
    name.length > 24 ||
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
    score: Math.max(0, score),
    cleared: Math.max(0, cleared),
    bestCombo: Math.max(0, bestCombo),
    // Also what makes each run a distinct ZSET member.
    playedAt: new Date().toISOString(),
  };

  try {
    await getRedis().zadd(KEY, { score: entry.score, member: JSON.stringify(entry) });
    await trimBoard();
  } catch (error) {
    // Surface the failure so the client can tell the player, instead of the
    // run vanishing silently.
    console.error("Leaderboard write failed", error);
    return NextResponse.json(
      {
        error: "Could not save score",
        // Echoed so a broken deploy can be diagnosed from the response itself
        // rather than by hunting through Vercel logs. No secrets in here.
        detail: error instanceof Error ? error.message : String(error),
      },
      { status: 502 },
    );
  }

  return NextResponse.json(entry, { status: 201 });
}
