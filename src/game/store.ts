"use client";
import { create } from "zustand";
import type { PublicState } from "@/lib/game-types";

export type Mood =
  | "lobby" | "intro" | "question" | "tension" | "locked" | "suspense"
  | "correct" | "wrong" | "miss" | "lifeline" | "walk" | "jackpot";
export type Crowd = "idle" | "clap" | "cheer" | "gasp";
export type Plate = "idle" | "selected" | "locked" | "correct" | "wrong" | "eliminated";
export type Screen = "title" | "loading" | "play" | "over";

export interface TimerView {
  timed: boolean;
  remainingMs: number;
  running: boolean;
  at: number; // performance.now() when synced
  totalMs: number;
}

export interface GameView {
  screen: Screen;
  server: PublicState | null;
  voice: boolean;
  host: { text: string; visible: boolean; key: number };
  talking: boolean;
  /** Host is reading the question off the desk monitor (looks down at it). */
  hostReading: boolean;
  /** Contestant speech bubble (says the chosen answer, asks for a lifeline...). */
  player: { text: string; visible: boolean; key: number };
  questionVisible: boolean;
  optionsShown: number;
  plates: Plate[];
  suggestion: number | null;
  reconfirm: { index: number; endsAt: number; totalMs: number } | null;
  phone: { endsAt: number; totalMs: number } | null;
  walkConfirm: boolean;
  timer: TimerView;
  explanation: string | null;
  canNext: boolean;
  busy: boolean;
  error: string | null;
  mood: Mood;
  crowd: Crowd;
  crowdAt: number;
  confettiAt: number;
  stageReady: boolean;
  quality: number; // 0..3, set by the performance monitor
  muted: boolean;
}

export const initialView = (): GameView => ({
  screen: "title",
  server: null,
  voice: false,
  host: { text: "", visible: false, key: 0 },
  talking: false,
  hostReading: false,
  player: { text: "", visible: false, key: 0 },
  questionVisible: false,
  optionsShown: 0,
  plates: ["idle", "idle", "idle", "idle"],
  suggestion: null,
  reconfirm: null,
  phone: null,
  walkConfirm: false,
  timer: { timed: false, remainingMs: 0, running: false, at: 0, totalMs: 0 },
  explanation: null,
  canNext: false,
  busy: false,
  error: null,
  mood: "lobby",
  crowd: "idle",
  crowdAt: 0,
  confettiAt: -1,
  stageReady: false,
  quality: 3,
  muted: false,
});

export const useGame = create<GameView>(() => initialView());

export const setView = (p: Partial<GameView> | ((s: GameView) => Partial<GameView>)) =>
  useGame.setState(typeof p === "function" ? p(useGame.getState()) : p);

export function timerRemaining(t: TimerView, now = performance.now()): number {
  if (!t.timed) return Infinity;
  return Math.max(0, t.running ? t.remainingMs - (now - t.at) : t.remainingMs);
}

export interface Anchor { x: number; y: number; scale: number; on: boolean }

/** Shared per-frame values read without React re-renders. anchors = head positions in CSS px (speech bubbles). */
export const frame = {
  mouth: 0,
  anchors: {
    host: { x: 0, y: 0, scale: 0, on: false } as Anchor,
    player: { x: 0, y: 0, scale: 0, on: false } as Anchor,
  },
};
