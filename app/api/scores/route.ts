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

const redis = new Redis({
  url: process.env.KV_REST_API_URL!,
  token: process.env.KV_REST_API_TOKEN!,
});

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

export async function GET() {
  try {
    const members = await redis.zrange(KEY, 0, 19, { rev: true });
    const scores = members
      .map(toScore)
      .filter((entry): entry is Score => entry !== null)
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
    await redis.zadd(KEY, { score: entry.score, member: JSON.stringify(entry) });
    await trimBoard();
  } catch (error) {
    // Surface the failure so the client can tell the player, instead of the
    // run vanishing silently.
    console.error("Leaderboard write failed", error);
    return NextResponse.json({ error: "Could not save score" }, { status: 502 });
  }

  return NextResponse.json(entry, { status: 201 });
}
