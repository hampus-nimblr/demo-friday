"use client";

import { useEffect, useReducer, useRef } from "react";
import type { MailTemplate, Verdict } from "./mail-pool";

export const SLOT_COUNT = 8;
export const BUFFER_START = 6_000;
export const BUFFER_CAP = 10_000;
export const BUFFER_REWARD = 1_000;
const CORRECT_BASE = 100;
const COMBO_BONUS = 20;
const WRONG_PENALTY = 75;
const TICK_MS = 100;

/** A level advances every 30 seconds or 15 correct classifications. */
export function levelFor(elapsed: number, handled: number): number {
  return Math.max(1, Math.floor(elapsed / 30_000) + 1, Math.floor(handled / 15) + 1);
}

/** Arrival cadence accelerates with every level and settles into a rapid late-game floor. */
export function nextSpawnDelay(level: number): number {
  if (level === 1) return 2_500;
  if (level === 2) return 2_200;
  if (level === 3) return 1_800;
  if (level === 4) return 1_500;
  return Math.max(550, 1_100 - (level - 5) * 90);
}

export type Slot = {
  uid: number;
  template: MailTemplate;
  /** True once this mail has been misclassified and bounced back. */
  bounced: boolean;
  /** A correct classification gets a brief, text-free green confirmation. */
  resolving?: boolean;
  resolveTimer?: number;
  /** Times the player has expanded this mail. */
  views: number;
};

export type GameStatus = "idle" | "running" | "over";

export type GameState = {
  status: GameStatus;
  slots: Slot[];
  queue: MailTemplate[];
  queueIndex: number;
  nextUid: number;
  score: number;
  combo: number;
  bestCombo: number;
  handled: number;
  mistakes: number;
  /** Milliseconds until the next arrival. */
  spawnTimer: number;
  /** Remaining reading buffer, in milliseconds. */
  buffer: number;
  expandedUid: number | null;
  elapsed: number;
  /** Drives one-shot audio and arcade feedback after a classification. */
  lastResult: { id: number; kind: "correct" | "wrong"; combo: number } | null;
};

export type GameAction =
  | { type: "START"; queue: MailTemplate[] }
  | { type: "TICK"; dt: number }
  | { type: "EXPAND"; uid: number }
  | { type: "COLLAPSE" }
  | { type: "CLASSIFY"; uid: number; verdict: Verdict };

const initialState: GameState = {
  status: "idle",
  slots: [],
  queue: [],
  queueIndex: 0,
  nextUid: 1,
  score: 0,
  combo: 0,
  bestCombo: 0,
  handled: 0,
  mistakes: 0,
  spawnTimer: 0,
  buffer: BUFFER_START,
  expandedUid: null,
  elapsed: 0,
  lastResult: null,
};

/**
 * Arrivals pause while a mail is expanded, but only for as long as the buffer
 * lasts. At zero the clock keeps running and reading becomes a gamble.
 */
function isPaused(state: GameState): boolean {
  return state.expandedUid !== null && state.buffer > 0;
}

/** Each band gets its own mailbox flavour; level 5 remains the late-game pool. */
function templateLevel(template: MailTemplate): number {
  if (template.id.startsWith("drill-")) {
    return Number(template.id.split("-")[2]) || 5;
  }
  if (["p-03", "p-06", "p-08", "p-12", "p-14", "p-15", "p-21", "p-27", "p-28"].includes(template.id)) return 1;
  if (["p-02", "p-04", "p-10", "p-17", "p-19"].includes(template.id)) return 2;
  if (["p-09", "p-11", "p-16", "p-22", "p-23", "p-24"].includes(template.id)) return 3;
  if (["p-05", "p-07", "p-13", "p-18"].includes(template.id)) return 4;
  return 5;
}

function nextTemplate(state: GameState, level: number) {
  const targetLevel = Math.min(level, 5);
  for (let offset = 0; offset < state.queue.length; offset += 1) {
    const index = (state.queueIndex + offset) % state.queue.length;
    const template = state.queue[index];
    if (templateLevel(template) === targetLevel) return { template, offset };
  }
  return { template: state.queue[state.queueIndex % state.queue.length], offset: 0 };
}

function reducer(state: GameState, action: GameAction): GameState {
  switch (action.type) {
    case "START":
      return {
        ...initialState,
        status: "running",
        queue: action.queue,
        spawnTimer: nextSpawnDelay(1),
      };

    case "TICK": {
      if (state.status !== "running") return state;

      const elapsed = state.elapsed + action.dt;
      const slots = state.slots
        .map((slot) =>
          slot.resolving
            ? { ...slot, resolveTimer: (slot.resolveTimer ?? 0) - action.dt }
            : slot,
        )
        .filter((slot) => !slot.resolving || (slot.resolveTimer ?? 0) > 0);

      if (isPaused(state)) {
        return {
          ...state,
          elapsed,
          slots,
          buffer: Math.max(0, state.buffer - action.dt),
        };
      }

      const spawnTimer = state.spawnTimer - action.dt;
      if (spawnTimer > 0) return { ...state, elapsed, slots, spawnTimer };

      // A mail arrives with every slot taken: the only fail state.
      if (slots.length >= SLOT_COUNT) {
        return { ...state, elapsed, slots, spawnTimer: 0, status: "over" };
      }

      const level = levelFor(elapsed, state.handled);
      const { template, offset } = nextTemplate(state, level);
      return {
        ...state,
        elapsed,
        spawnTimer: nextSpawnDelay(level),
        queueIndex: state.queueIndex + offset + 1,
        nextUid: state.nextUid + 1,
        slots: [
          ...slots,
          { uid: state.nextUid, template, bounced: false, views: 0 },
        ],
      };
    }

    case "EXPAND":
      if (state.status !== "running") return state;
      if (!state.slots.some((slot) => slot.uid === action.uid && !slot.resolving)) {
        return state;
      }
      return {
        ...state,
        expandedUid: action.uid,
        slots: state.slots.map((slot) =>
          slot.uid === action.uid ? { ...slot, views: slot.views + 1 } : slot,
        ),
      };

    case "COLLAPSE":
      return { ...state, expandedUid: null };

    case "CLASSIFY": {
      if (state.status !== "running") return state;
      const slot = state.slots.find((s) => s.uid === action.uid);
      if (!slot || slot.resolving) return state;

      const expandedUid =
        state.expandedUid === action.uid ? null : state.expandedUid;

      if (action.verdict !== slot.template.verdict) {
        // Wrong: the mail bounces to the bottom and keeps its slot.
        return {
          ...state,
          expandedUid,
          score: Math.max(0, state.score - WRONG_PENALTY),
          combo: 0,
          mistakes: state.mistakes + 1,
          lastResult: { id: (state.lastResult?.id ?? 0) + 1, kind: "wrong", combo: 0 },
          slots: [
            ...state.slots.filter((s) => s.uid !== action.uid),
            { ...slot, bounced: true },
          ],
        };
      }

      return {
        ...state,
        expandedUid,
        score: state.score + CORRECT_BASE + COMBO_BONUS * state.combo,
        combo: state.combo + 1,
        bestCombo: Math.max(state.bestCombo, state.combo + 1),
        handled: state.handled + 1,
        lastResult: {
          id: (state.lastResult?.id ?? 0) + 1,
          kind: "correct",
          combo: state.combo + 1,
        },
        buffer: Math.min(BUFFER_CAP, state.buffer + BUFFER_REWARD),
        spawnTimer: Math.min(
          state.spawnTimer,
          nextSpawnDelay(levelFor(state.elapsed, state.handled + 1)),
        ),
        slots: state.slots.map((s) =>
          s.uid === action.uid
            ? { ...s, resolving: true, resolveTimer: 300 }
            : s,
        ),
      };
    }

    default:
      return state;
  }
}

export function useInboxGame(pool: MailTemplate[]) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const lastTick = useRef(0);

  useEffect(() => {
    if (state.status !== "running") return;
    lastTick.current = performance.now();
    const id = window.setInterval(() => {
      const now = performance.now();
      const dt = now - lastTick.current;
      lastTick.current = now;
      dispatch({ type: "TICK", dt });
    }, TICK_MS);
    return () => window.clearInterval(id);
  }, [state.status]);

  /**
   * Shuffling happens here rather than in the reducer: the reducer stays pure,
   * and Math.random never runs during render, so server and client markup match.
   */
  function start() {
    const queue = [...pool];
    for (let i = queue.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [queue[i], queue[j]] = [queue[j], queue[i]];
    }
    dispatch({ type: "START", queue });
  }

  return { state, dispatch, start, paused: isPaused(state) };
}
