import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

type Score = {
  name: string;
  score: number;
  cleared: number;
  bestCombo: number;
  playedAt: string;
};

const scoresFile = path.join(process.cwd(), "data", "scores.json");
let pendingWrite = Promise.resolve();

async function readScores(): Promise<Score[]> {
  try {
    return JSON.parse(await readFile(scoresFile, "utf8")) as Score[];
  } catch {
    return [];
  }
}

export async function GET() {
  const scores = await readScores();
  return NextResponse.json(scores.slice(0, 20));
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
    playedAt: new Date().toISOString(),
  };

  // Serialise writes in this server process so simultaneous finishes are not lost.
  pendingWrite = pendingWrite.then(async () => {
    const scores = await readScores();
    scores.push(entry);
    scores.sort((a, b) => b.score - a.score || b.cleared - a.cleared);
    await mkdir(path.dirname(scoresFile), { recursive: true });
    await writeFile(scoresFile, `${JSON.stringify(scores.slice(0, 100), null, 2)}\n`);
  });

  await pendingWrite;
  return NextResponse.json(entry, { status: 201 });
}
