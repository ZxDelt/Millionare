/** Client-safe game types. The server never puts the correct answer in PublicState before a reveal. */
export type Phase = "question" | "reconfirm" | "lifeline" | "dcMiss" | "revealed" | "over";
export type LifelineId = "double" | "phone" | "askAi";
export type OverReason = "wrong" | "timeout" | "walk" | "win";

export interface PublicLadderStep {
  coins: number;
  tier: string;
}

export interface PublicState {
  id: string;
  name: string;
  phase: Phase;
  level: number; // 1..ladder.length, the current question
  bankedCoins: number; // coins secured from correct answers so far
  ladder: PublicLadderStep[];
  question: { text: string; options: string[]; eliminated: number[] } | null;
  timer: { timed: boolean; remainingMs: number; running: boolean; totalMs: number };
  lifelines: Record<LifelineId, boolean>; // true = still available
  doubleActive: boolean;
  pendingIndex: number | null;
  reconfirmMs: number | null; // ms left to answer the reconfirm prompt
  cancelsLeft: number;
  lifelineActive: { id: "phone"; remainingMs: number } | { id: "askAi"; suggestion: number } | null;
  lastPick: { index: number; correct: boolean } | null;
  reveal: { correctIndex: number; pickedIndex: number | null; correct: boolean; explanation: string; cpclFact: string } | null;
  over: { reason: OverReason; coins: number } | null;
  begun: boolean;
  canWalkAway: boolean;
  walkAwayFromLevel: number;
  phoneFriendSec: number;
  serverNow: number;
}

export type GameAction =
  | { type: "begin" }
  | { type: "select"; index: number }
  | { type: "confirm" }
  | { type: "cancel" }
  | { type: "lifeline"; id: LifelineId }
  | { type: "resume" }
  | { type: "walkAway" }
  | { type: "next" }
  | { type: "timeout" };
