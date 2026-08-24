import { notFound } from "next/navigation";

import { boardLabel, normalizeBoard } from "../board";
import Inbox from "../inbox";
import { mailPool } from "../mail-pool";

/**
 * Campaign boards: `/polan` is the same game as `/`, scored into its own
 * leaderboard. The segment is the board slug.
 *
 * This being a dynamic segment at the root means it also catches typos — hence
 * notFound() below rather than a silent fall back to the house board, which
 * would show one campaign's scores under another campaign's URL.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ board: string }>;
}) {
  const board = normalizeBoard((await params).board);
  if (!board) return {};
  return { title: `Nimblr Inbox Overflow — ${boardLabel(board)}` };
}

export default async function BoardPage({
  params,
}: {
  params: Promise<{ board: string }>;
}) {
  const board = normalizeBoard((await params).board);
  if (!board) notFound();
  return <Inbox pool={mailPool} board={board} />;
}
