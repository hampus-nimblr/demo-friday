"use client";

import { useEffect, useRef, useState } from "react";
import { VERDICTS, type MailTemplate, type Verdict } from "./mail-pool";
import {
  BUFFER_CAP,
  SLOT_COUNT,
  levelFor,
  useInboxGame,
  type Slot,
} from "./use-inbox-game";

/**
 * Which design-system color each verdict borrows on hover.
 *
 * The mapping is a product decision, not a styling one — it tells the player
 * how alarmed to be before they've read a word. Current reading:
 *   spam     → neutral. Junk, not a threat. Stays quiet so it doesn't compete.
 *   phishing → destructive (red). The one outcome with real consequences.
 *   legit    → success (green). The all-clear.
 *
 * TODO(you): this is worth a second opinion — see the note in chat. Your token
 * set distinguishes `alert` (orange) from `warning` (red), and pulling spam or
 * phishing onto orange changes how the whole board reads.
 */
const VERDICT_TONE: Record<Verdict, string> = {
  spam: "hover:border-gray-300 hover:bg-accent hover:text-accent-foreground",
  phishing: "hover:border-destructive hover:bg-red-50 hover:text-destructive dark:hover:bg-red-950/40",
  legit: "hover:border-success-600 hover:bg-green-50 hover:text-success-700 dark:hover:bg-green-950/40 dark:hover:text-success-400",
};

type ScoreEntry = {
  name: string;
  score: number;
  cleared: number;
  bestCombo: number;
};

export default function Inbox({ pool }: { pool: MailTemplate[] }) {
  const { state, dispatch, start } = useInboxGame(pool);
  const { slots, expandedUid, status } = state;
  const audioContext = useRef<AudioContext | null>(null);
  const musicTimer = useRef<number | null>(null);
  const submittedRun = useRef(false);
  const [playerName, setPlayerName] = useState("");
  const [activePlayer, setActivePlayer] = useState("");
  const [scores, setScores] = useState<ScoreEntry[]>([]);

  function getAudioContext() {
    const context = audioContext.current ?? new AudioContext();
    audioContext.current = context;
    return context;
  }

  function playMusicNote(context: AudioContext, frequency: number) {
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    const now = context.currentTime;
    oscillator.type = "triangle";
    oscillator.frequency.setValueAtTime(frequency, now);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.018, now + 0.025);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.2);
    oscillator.connect(gain).connect(context.destination);
    oscillator.start(now);
    oscillator.stop(now + 0.22);
  }

  useEffect(() => {
    void fetch("/api/scores")
      .then((response) => response.ok ? response.json() : [])
      .then((entries: ScoreEntry[]) => setScores(entries))
      .catch(() => undefined);
  }, []);

  // Number keys always act on the first mail in the inbox for quick triage.
  useEffect(() => {
    if (status !== "running") return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        dispatch({ type: "COLLAPSE" });
        return;
      }
      const match = VERDICTS.find((v) => v.key === event.key);
      const topMail = slots.find((slot) => !slot.resolving);
      if (match && topMail) {
        dispatch({ type: "CLASSIFY", uid: topMail.uid, verdict: match.id });
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [status, slots, dispatch]);

  useEffect(() => {
    if (!state.lastResult) return;

    const context = getAudioContext();
    void context.resume();

    const playTone = (frequency: number, start: number, duration: number) => {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = "square";
      oscillator.frequency.setValueAtTime(frequency, start);
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(0.045, start + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
      oscillator.connect(gain).connect(context.destination);
      oscillator.start(start);
      oscillator.stop(start + duration);
    };

    const now = context.currentTime;
    if (state.lastResult.kind === "wrong") {
      playTone(130, now, 0.14);
      playTone(95, now + 0.12, 0.18);
    } else {
      playTone(520, now, 0.09);
      playTone(state.lastResult.combo >= 3 ? 880 : 660, now + 0.08, 0.14);
    }
  }, [state.lastResult]);

  useEffect(() => {
    if (status !== "running") return;

    const context = getAudioContext();
    void context.resume();
    const melody = [262, 330, 392, 330, 294, 349, 440, 349];
    let beat = 0;
    const playBeat = () => {
      playMusicNote(context, melody[beat % melody.length]);
      if (beat % 4 === 0) playMusicNote(context, 131);
      beat += 1;
    };
    playBeat();
    musicTimer.current = window.setInterval(playBeat, 360);

    return () => {
      if (musicTimer.current !== null) window.clearInterval(musicTimer.current);
      musicTimer.current = null;
    };
  }, [status]);

  useEffect(() => {
    if (status !== "over" || !activePlayer || submittedRun.current) return;
    submittedRun.current = true;
    const entry = {
      name: activePlayer,
      score: state.score,
      cleared: state.handled,
      bestCombo: state.bestCombo,
    };
    void fetch("/api/scores", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(entry),
    })
      .then((response) => response.ok ? response.json() : Promise.reject())
      .then(() =>
        fetch("/api/scores")
          .then((response) => response.ok ? response.json() : [])
          .then((entries: ScoreEntry[]) => setScores(entries)),
      )
      .catch(() => undefined);
  }, [activePlayer, state.bestCombo, state.handled, state.score, status]);

  function handleStart() {
    const name = playerName.trim();
    if (!name) return;
    const context = getAudioContext();
    void context.resume();
    setPlayerName(name);
    setActivePlayer(name);
    submittedRun.current = false;
    start();
  }
  

  function playAgain() {
    const context = getAudioContext();
    void context.resume();
    submittedRun.current = false;
    start();
  }

  const empty = Math.max(0, SLOT_COUNT - slots.length);
  const bufferPct = Math.round((state.buffer / BUFFER_CAP) * 100);
  const pressure = slots.length >= SLOT_COUNT - 1;
  const level = levelFor(state.elapsed, state.handled);
  const levelBrief =
    level <= 2
      ? "Warm-up: obvious tells"
      : level <= 4
        ? "Watch closely: Nordic lures"
        : "Expert mode: subtle signals";
  const streakLabel =
    state.combo >= 10
      ? "INBOX LEGEND"
      : state.combo >= 5
        ? "FIREWALL FRENZY"
        : state.combo >= 3
          ? "HOT STREAK"
          : null;

  return (
    <div className="flex flex-1 flex-col overflow-hidden bg-background text-foreground">
      <main className="relative flex-1 overflow-y-auto bg-[radial-gradient(circle_at_top,_var(--color-primary-100),_transparent_35rem)] scrollbar-hide dark:bg-[radial-gradient(circle_at_top,_var(--color-primary-950),_transparent_35rem)]">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-3 pb-4 pt-5 sm:px-6 sm:pt-8 lg:flex-row lg:items-start">
          <aside className="order-2 w-full shrink-0 lg:sticky lg:top-5 lg:order-1 lg:w-64">
            <LiveLeaderboard
              scores={scores}
              playerName={activePlayer}
              score={state.score}
              cleared={state.handled}
              combo={state.combo}
              active={status === "running"}
            />
          </aside>

          <div className="order-1 min-w-0 flex-1 lg:order-2">
          <section className="relative mb-4 overflow-hidden rounded-dialog border border-primary-400/40 bg-card shadow-card">
            <div className="flex flex-wrap items-center gap-3 border-b border-border bg-primary px-4 py-3 text-primary-foreground">
              <div className="flex min-w-0 items-center gap-2">
                <span className="flex size-8 items-center justify-center rounded-full bg-primary-foreground/15 text-base">
                  🛡️
                </span>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.18em] opacity-70">
                    Nimblr security arcade
                  </p>
                  <h1 className="text-base font-bold tracking-tight">
                    Inbox Overflow
                  </h1>
                </div>
              </div>
              <p className="ml-auto text-xs font-medium">
                {status === "running" ? "Emails incoming!" : "Ready when you are"}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-px bg-border sm:grid-cols-4">
              <GameStat label="Score" value={state.score} />
              <GameStat label="Combo" value={`×${state.combo}`} highlight={state.combo > 2} />
              <GameStat label="Level" value={level} highlight={level >= 5} />
              <GameStat
                label="Inbox slots"
                value={`${slots.length}/${SLOT_COUNT}`}
                danger={pressure}
              />
            </div>
            <div className="flex items-center gap-3 bg-card px-4 py-2.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                Inbox pressure
              </span>
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-input">
                <div
                  className={`h-full rounded-full transition-[width] duration-300 motion-reduce:transition-none ${
                    pressure ? "bg-destructive" : "bg-primary"
                  }`}
                  style={{ width: `${Math.max(8, (slots.length / SLOT_COUNT) * 100)}%` }}
                />
              </div>
              <span className="text-xs font-bold tabular-nums text-muted-foreground">
                {bufferPct}% focus
              </span>
            </div>
            <p className="border-t border-border bg-secondary px-4 py-2 text-center text-xs font-medium text-muted-foreground">
              {levelBrief} · Level up every 30 seconds or 15 correct calls
            </p>
            {streakLabel && (
              <div
                key={state.combo}
                aria-live="polite"
                className="pointer-events-none absolute inset-x-3 top-1/2 z-10 -translate-y-1/2 rotate-[-3deg] rounded-card border-4 border-primary-foreground bg-primary px-4 py-3 text-center font-mono text-2xl font-black leading-none tracking-[-0.06em] text-primary-foreground shadow-xl animate-arcade-pop sm:inset-x-10 sm:text-4xl"
              >
                <span className="block text-[10px] tracking-[0.28em] opacity-70 sm:text-xs">COMBO BONUS</span>
                {streakLabel} ×{state.combo}!
              </div>
            )}
          </section>

          <div className="mb-2 flex items-center justify-between px-1">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-muted-foreground">
              Live inbox
            </p>
            <p className="text-xs text-muted-foreground">Keys 1 / 2 / 3 classify the top mail</p>
          </div>
          <ul className="space-y-2">
          {slots.map((slot, index) => (
            <MailRow
              // Flipping to bounced remounts the row, which is what retriggers
              // the shake. New arrivals get a fresh uid and animate in.
              key={`${slot.uid}-${slot.bounced ? "returned" : "new"}`}
              slot={slot}
              index={index}
              expanded={expandedUid === slot.uid}
              onToggle={() =>
                dispatch(
                  expandedUid === slot.uid
                    ? { type: "COLLAPSE" }
                    : { type: "EXPAND", uid: slot.uid },
                )
              }
              onClassify={(verdict) =>
                dispatch({ type: "CLASSIFY", uid: slot.uid, verdict })
              }
            />
          ))}
          {Array.from({ length: empty }, (_, i) => (
            <li
              key={`empty-${i}`}
              aria-hidden
              className="flex h-[3.75rem] items-center rounded-card border border-dashed border-input px-4 text-xs font-medium uppercase tracking-wide text-muted-foreground/50"
            >
              <span className="mr-2 text-base">✦</span> Open slot {slots.length + i + 1}
            </li>
          ))}
          </ul>
          </div>
        </div>

        {status !== "running" && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/80 px-6 backdrop-blur-sm">
            <div className="w-full max-w-md rounded-dialog border border-border bg-card p-6 text-center shadow-dialog">
              {status === "idle" ? (
                <>
                  <img
                    src="https://www.monterro.com/media/z5kolqpb/nimblr-martin.png"
                    alt="Martin, Nimblr's security manager"
                    width={112}
                    height={112}
                    className="mx-auto mb-4 size-28 rounded-full border-4 border-primary bg-primary-100 object-cover shadow-button"
                  />
                  <h2 className="text-xl font-medium tracking-tight">
                    Welcome to Nimblr Inbox Overflow!
                  </h2>
                  <p className="mt-3 text-sm text-muted-foreground">
                    Hey, I&apos;m Martin, Nimblr&apos;s security manager. My inbox is
                    filling up fast, and I need your sharp eyes to help keep the
                    bad stuff out.
                  </p>
                  <div className="mt-5 rounded-card border border-border bg-secondary p-4 text-left">
                    <p className="text-sm font-medium">Your mission</p>
                    <p className="mt-1.5 text-sm text-muted-foreground">
                      Open each email, spot the clues, and decide whether it&apos;s
                      spam, phishing, or the real deal. Clear messages quickly
                      to build a combo—but don&apos;t rush a suspicious one.
                    </p>
                  </div>
                  <div className="mt-5 flex flex-wrap items-center justify-center gap-2 border-t border-border pt-5">
                    {VERDICTS.map((v) => (
                      <span
                        key={v.id}
                        className="inline-flex items-center gap-1.5 text-xs text-muted-foreground"
                      >
                        <kbd className="rounded-xs border border-input bg-secondary px-1.5 py-0.5 font-mono text-[10px] text-secondary-foreground">
                          {v.key}
                        </kbd>
                        {v.label}
                      </span>
                    ))}
                  </div>
                  <p className="mt-4 text-xs text-muted-foreground">
                    You have eight inbox slots. A wrong call sends the email back
                    to the queue, so make every decision count.
                  </p>
                  <label className="mt-5 block text-left">
                    <span className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      Pilot name
                    </span>
                    <input
                      value={playerName}
                      onChange={(event) => setPlayerName(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") handleStart();
                      }}
                      maxLength={24}
                      autoComplete="nickname"
                      placeholder="Enter your name"
                      className="w-full rounded-input border border-input bg-background px-3 py-2.5 text-sm font-medium text-foreground outline-none placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/30"
                    />
                  </label>
                </>
              ) : (
                <>
                  <img
                    src="https://www.monterro.com/media/z5kolqpb/nimblr-martin.png"
                    alt="Martin, Nimblr's security manager"
                    width={88}
                    height={88}
                    className="mx-auto mb-3 size-[5.5rem] rounded-full border-4 border-destructive bg-red-100 object-cover"
                  />
                  <p className="font-mono text-[10px] font-black uppercase tracking-[0.2em] text-destructive">
                    Inbox overflow
                  </p>
                  <p className="mt-2 text-xs font-bold text-muted-foreground">
                    Martin · Nimblr security manager
                  </p>
                  <h2 className="mt-1 text-xl font-bold tracking-tight">
                    {state.handled >= 20
                      ? "That was some seriously sharp triage!"
                      : state.handled >= 10
                        ? "Nice work — you kept the attackers busy."
                        : "That inbox got the better of us this time."}
                  </h2>
                  <p className="mt-3 text-sm text-muted-foreground">
                    {state.handled >= 20
                      ? "I knew I could count on you. Take a breath, then let’s see if you can push the next run even further."
                      : "I’ll hold the fort while you reset. Watch those sender domains — the sneaky ones are getting through."}
                  </p>
                  <dl className="mt-5 grid grid-cols-3 gap-2">
                    <Stat label="Score" value={state.score} size="lg" />
                    <Stat label="Cleared" value={state.handled} size="lg" />
                    <Stat label="Best run" value={`×${state.bestCombo}`} size="lg" />
                  </dl>
                </>
              )}
              <button
                onClick={status === "idle" ? handleStart : playAgain}
                disabled={status === "idle" && !playerName.trim()}
                className="mt-6 w-full rounded-button bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground shadow-button transition-colors hover:bg-primary-900 disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transition-none dark:hover:bg-primary-300"
              >
                {status === "idle" ? "Start game" : "Play again"}
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

function GameStat({
  label,
  value,
  highlight = false,
  danger = false,
}: {
  label: string;
  value: string | number;
  highlight?: boolean;
  danger?: boolean;
}) {
  return (
    <div className="bg-card px-4 py-3">
      <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <p
        className={`mt-0.5 text-lg font-bold tabular-nums ${
          danger ? "text-destructive" : highlight ? "text-success-700 dark:text-success-400" : "text-foreground"
        }`}
      >
        {value}
      </p>
    </div>
  );
}

function LiveLeaderboard({
  scores,
  playerName,
  score,
  cleared,
  combo,
  active,
}: {
  scores: ScoreEntry[];
  playerName: string;
  score: number;
  cleared: number;
  combo: number;
  active: boolean;
}) {
  return (
    <section className="overflow-hidden rounded-[1.25rem] border-2 border-primary-400 bg-card shadow-lg">
      <div className="relative overflow-hidden bg-primary px-4 py-4 text-primary-foreground">
        <span className="absolute -right-3 -top-5 text-7xl opacity-20" aria-hidden>🏆</span>
        <div className="relative flex items-center gap-3">
          <span className="flex size-10 items-center justify-center rounded-full border-2 border-primary-foreground/40 bg-primary-foreground/15 text-xl" aria-hidden>
            🏆
          </span>
          <div>
            <p className="font-mono text-[10px] font-black uppercase tracking-[0.2em] opacity-70">
              Nimblr arcade
            </p>
            <h2 className="text-lg font-black tracking-tight">Top inbox guards</h2>
          </div>
        </div>
      </div>

      <div className="m-3 rounded-card bg-foreground p-3 text-background shadow-md">
        <div className="flex items-center justify-between gap-2">
          <p className="font-mono text-[10px] font-black uppercase tracking-[0.16em] text-primary-300">
            {active ? "● Live score" : "Your score bay"}
          </p>
          {active && <span className="rounded-full bg-success-500 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-black">Live</span>}
        </div>
        <div className="mt-2 flex items-end justify-between gap-2">
          <span className="min-w-0 truncate text-base font-bold">
            {playerName || "Waiting for pilot"}
          </span>
          <span className="font-mono text-3xl font-black leading-none tabular-nums text-primary">
            {score}
          </span>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2 border-t border-white/15 pt-2.5 text-center">
          <span className="rounded-xs bg-white/10 py-1 text-[10px] font-bold uppercase tracking-wider">
            {cleared} cleared
          </span>
          <span className="rounded-xs bg-white/10 py-1 text-[10px] font-bold uppercase tracking-wider">
            ×{combo} streak
          </span>
        </div>
      </div>

      <div className="flex items-center justify-between px-4 pb-2">
        <p className="text-[10px] font-black uppercase tracking-[0.16em] text-muted-foreground">Hall of fame</p>
        <span className="text-xs">✦</span>
      </div>
      <ol className="space-y-1 px-3 pb-3">
        {scores.length > 0 ? (
          scores.slice(0, 8).map((entry, index) => (
            <li
              key={`${entry.name}-${entry.score}-${index}`}
              className="flex items-center gap-2 rounded-card border border-transparent px-2 py-2 text-sm even:bg-secondary hover:border-primary-300"
            >
              <span className={`flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-black ${
                index === 0
                  ? "bg-primary text-primary-foreground"
                  : index === 1
                    ? "bg-gray-300 text-gray-800"
                    : index === 2
                      ? "bg-orange-300 text-orange-900"
                      : "bg-secondary text-muted-foreground"
              }`}>
                {index === 0 ? "1" : index === 1 ? "2" : index === 2 ? "3" : index + 1}
              </span>
              <span className="min-w-0 flex-1 truncate font-semibold">{entry.name}</span>
              <span className="rounded-xs bg-foreground px-1.5 py-0.5 font-mono text-xs font-black tabular-nums text-background">{entry.score}</span>
            </li>
          ))
        ) : (
          <li className="rounded-card border border-dashed border-input px-2 py-5 text-center text-xs text-muted-foreground">
            <span className="mb-1 block text-2xl">🚀</span>
            Be the first pilot on the board.
          </li>
        )}
      </ol>
    </section>
  );
}

/** Header/summary metric on a filled tile, matching the platform's stat blocks. */
function Stat({
  label,
  value,
  tone,
  size = "sm",
}: {
  label: string;
  value: string | number;
  tone?: string;
  size?: "sm" | "lg";
}) {
  return (
    <div className="rounded-card bg-secondary px-3 py-1.5 text-center">
      <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </dt>
      <dd
        className={`tabular-nums ${size === "lg" ? "text-lg" : "text-base"} ${
          tone ?? "text-foreground"
        }`}
      >
        {value}
      </dd>
    </div>
  );
}

function MailRow({
  slot,
  index,
  expanded,
  onToggle,
  onClassify,
}: {
  slot: Slot;
  index: number;
  expanded: boolean;
  onToggle: () => void;
  onClassify: (verdict: Verdict) => void;
}) {
  const { template, bounced } = slot;
  // A bounced mail gives up its decisive signal when reopened, so a wrong
  // read can never trap the player in a loop.
  const showHint = bounced && slot.views > 1;

  return (
    <li
      className={`relative overflow-hidden rounded-card border bg-card shadow-card transition-[transform,box-shadow,border-color] duration-200 motion-reduce:transition-none ${
        slot.resolving
          ? "border-success-600 bg-green-50 animate-mail-arrive dark:bg-green-950/40"
          : bounced
          ? "border-destructive/40 animate-mail-bounce"
          : expanded
            ? "border-primary-400 shadow-md"
            : "border-border animate-mail-arrive hover:-translate-y-0.5 hover:shadow-md"
      }`}
    >
      <span
        aria-hidden
        className={`absolute left-0 top-0 h-full w-[3px] ${
          slot.resolving ? "bg-success-600" : bounced ? "bg-destructive" : "bg-primary-300 dark:bg-primary-800"
        }`}
      />
      <div className="py-3 pl-5 pr-3">
        <button
          onClick={onToggle}
          aria-expanded={expanded}
          className="flex w-full min-w-0 items-start gap-3 rounded-xs text-left"
        >
          <span
            aria-hidden
            className={`mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full text-xs font-medium ${
              bounced
                ? "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300"
                : "bg-primary-100 text-primary-700 dark:bg-primary-950 dark:text-primary-300"
            }`}
          >
            {template.initials}
          </span>
          <span className="min-w-0 flex-1">
            <span className="mb-1 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
              <span className={`size-1.5 rounded-full ${slot.resolving ? "bg-success-600" : bounced ? "bg-destructive" : "bg-primary"}`} />
              {slot.resolving ? "Cleared" : bounced ? "Needs another look" : "New transmission"}
            </span>
            <span className="flex min-w-0 flex-wrap items-baseline gap-x-2">
              <span className="text-sm font-bold text-foreground">{template.sender}</span>
              <span className="truncate font-mono text-xs font-medium text-muted-foreground">
                {template.address}
              </span>
              {bounced && (
                <span
                  className="inline-flex items-center rounded-full bg-destructive px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-destructive-foreground"
                  title="Misclassified — still in your inbox"
                >
                  Returned
                </span>
              )}
              <span className="ml-auto shrink-0 rounded-full bg-secondary px-2 py-0.5 font-mono text-[10px] font-bold tabular-nums text-secondary-foreground">
                #{String(index + 1).padStart(2, "0")}
              </span>
            </span>
            <span className="mt-1 block truncate text-[15px] font-semibold leading-snug text-foreground">
              {template.subject}
            </span>
            <span className="mt-1 block text-xs font-medium text-muted-foreground">
              to you <span className="mx-1 text-border">•</span> Click to read
            </span>
            {!expanded && (
              <span className="mt-1.5 block truncate text-sm leading-snug text-muted-foreground">
                {template.preview}
              </span>
            )}
          </span>
        </button>

        {!slot.resolving && <div className="mt-3 flex flex-wrap gap-2 border-t border-border pt-3">
          <span className="mr-1 self-center text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            Classify
          </span>
          {VERDICTS.map((v) => (
            <button
              key={v.id}
              onClick={() => onClassify(v.id)}
              title={`${v.label} (${v.key})`}
                className={`rounded-button border border-input bg-secondary px-3 py-1.5 text-xs font-bold text-secondary-foreground shadow-xs transition-[transform,colors] hover:-translate-y-0.5 motion-reduce:transition-none ${VERDICT_TONE[v.id]}`}
            >
              {v.label}
              <span className="ml-1.5 hidden font-mono text-[10px] opacity-50 sm:inline">
                {v.key}
              </span>
            </button>
          ))}
        </div>}
      </div>

      {bounced && (
        <p className="border-t border-destructive/20 bg-red-50 px-5 py-2 text-xs text-destructive dark:bg-red-950/30">
          <span className="font-bold">Try again:</span> {template.hint}
        </p>
      )}

      {expanded && (
        <div className="border-t border-border px-5 py-4">
          {template.body.map((paragraph, i) => (
            <p key={i} className="mb-3 max-w-prose text-sm text-card-foreground">
              {paragraph}
            </p>
          ))}
          {template.link && (
            <p className="mt-1 inline-block max-w-full truncate rounded-input border border-input bg-secondary px-2 py-1 font-mono text-xs text-secondary-foreground">
              {template.link}
            </p>
          )}
          {showHint && (
            <p className="mt-4 flex items-start gap-2 rounded-card bg-alert-50 px-3 py-2 text-xs text-alert-800 dark:bg-alert-950/50 dark:text-alert-200">
              <LightbulbIcon />
              <span>{template.hint}</span>
            </p>
          )}
        </div>
      )}
    </li>
  );
}

function LightbulbIcon() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="mt-px size-4 shrink-0"
    >
      <path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9V16h7v-2.1A6 6 0 0 0 12 3z" />
    </svg>
  );
}
