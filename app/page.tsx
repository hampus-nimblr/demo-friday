import Inbox from "./inbox";
import { mailPool } from "./mail-pool";

export default function Home() {
  return <Inbox pool={mailPool} />;
}
