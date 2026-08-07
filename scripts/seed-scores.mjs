/**
 * One-off: copies the two runs from the old data/scores.json into Redis so the
 * board doesn't start empty. Safe to run twice — ZADD on an identical member is
 * an update, not a duplicate.
 *
 *   node --env-file=.env.local scripts/seed-scores.mjs
 */
import { readFile } from "node:fs/promises";
import { Redis } from "@upstash/redis";

const KEY = "leaderboard:v1";

const redis = new Redis({
  url: process.env.KV_REST_API_URL,
  token: process.env.KV_REST_API_TOKEN,
});

const scores = JSON.parse(await readFile("data/scores.json", "utf8"));

for (const entry of scores) {
  await redis.zadd(KEY, { score: entry.score, member: JSON.stringify(entry) });
  console.log(`seeded ${entry.name} — ${entry.score}`);
}

const total = await redis.zcard(KEY);
console.log(`\nboard now holds ${total} run(s)`);
