import { DEFAULT_BOARD } from "./board";
import Inbox from "./inbox";
import { mailPool } from "./mail-pool";

/** The house board. Campaign boards live at /[board] — see app/board.ts. */
export default function Home() {
  return <Inbox pool={mailPool} board={DEFAULT_BOARD} />;
}
