/**
 * Pure game rules (GDD §4, §5, §8). No I/O: easy to unit test.
 * Time is passed in; randomness is injected.
 */
import type { GameSettings } from "./defaults";
import type { GameAction, LifelineId, OverReason, Phase, PublicState } from "./game-types";

export interface QuestionSnap {
  id: number;
  text: string;
  options: string[];
  correctIndex: number;
  explanation: string;
  cpclFact?: string;
}

export interface SessionState {
  v: 1;
  id: string;
  name: string;
  version: number;
  phase: Phase;
  level: number;
  bankedCoins: number;
  usedIds: number[];
  factsUsed?: string[];
  q: QuestionSnap;
  // timer
  timed: boolean;
  totalMs: number;
  remainingMs: number;
  runningSince: number | null;
  begun: boolean; // options shown + timer started (host finished reading)
  autoStartAt: number; // server starts the timer itself at this time if the client never sends begin
  // per-question
  eliminated: number[];
  cancels: number;
  pendingIndex: number | null;
  reconfirmDeadline: number | null;
  doubleActive: boolean;
  doubleMissUsed: boolean;
  lifelineActive: { id: "phone"; deadline: number } | { id: "askAi"; suggestion: number } | null;
  lastPick: { index: number; correct: boolean } | null;
  // session
  lifelinesUsed: Record<LifelineId, boolean>;
  reveal: { correctIndex: number; pickedIndex: number | null; correct: boolean } | null;
  over: { reason: OverReason; coins: number } | null;
  settings: GameSettings; // snapshot at start, so admin edits don't change a running game
  createdAt: number;
}

/** Network latency allowance for timer checks. */
export const GRACE_MS = 1500;
/** Max time the host may spend reading a question before the timer starts anyway. */
export const READ_MS = 25_000;

export class GameError extends Error {
  constructor(message: string, public status = 409) {
    super(message);
  }
}

// ---------- timer ----------
export function remaining(s: SessionState, now: number): number {
  if (!s.timed) return Infinity;
  return s.runningSince === null ? s.remainingMs : s.remainingMs - (now - s.runningSince);
}

function pause(s: SessionState, now: number) {
  if (s.timed && s.runningSince !== null) {
    s.remainingMs = Math.max(0, s.remainingMs - (now - s.runningSince));
    s.runningSince = null;
  }
}

function resume(s: SessionState, now: number) {
  if (s.timed && s.runningSince === null) s.runningSince = now;
}

// ---------- lifecycle ----------
export function newSession(id: string, name: string, settings: GameSettings, q: QuestionSnap, now: number): SessionState {
  const s: SessionState = {
    v: 1,
    id,
    name,
    version: 0,
    phase: "question",
    level: 1,
    bankedCoins: 0,
    usedIds: [q.id],
    q,
    timed: false,
    totalMs: 0,
    remainingMs: 0,
    runningSince: null,
    begun: false,
    autoStartAt: now + READ_MS,
    eliminated: [],
    cancels: 0,
    pendingIndex: null,
    reconfirmDeadline: null,
    doubleActive: false,
    doubleMissUsed: false,
    lifelineActive: null,
    lastPick: null,
    lifelinesUsed: { double: false, phone: false, askAi: false },
    reveal: null,
    over: null,
    settings,
    createdAt: now,
  };
  setupQuestion(s, q, now);
  return s;
}

function setupQuestion(s: SessionState, q: QuestionSnap, now: number) {
  s.q = q;
  s.phase = "question";
  s.timed = s.level <= s.settings.timedUntilLevel;
  s.totalMs = s.timed ? s.settings.questionTimerSec * 1000 : 0;
  s.remainingMs = s.totalMs;
  s.runningSince = null;
  s.begun = false;
  s.autoStartAt = now + READ_MS;
  s.eliminated = [];
  s.cancels = 0;
  s.pendingIndex = null;
  s.reconfirmDeadline = null;
  s.doubleActive = false;
  s.doubleMissUsed = false;
  s.lifelineActive = null;
  s.lastPick = null;
  s.reveal = null;
}

function end(s: SessionState, reason: OverReason, coins: number, pickedIndex: number | null, now: number) {
  pause(s, now);
  s.phase = "over";
  s.over = { reason, coins };
  s.reveal = { correctIndex: s.q.correctIndex, pickedIndex, correct: reason === "win" };
  s.pendingIndex = null;
  s.reconfirmDeadline = null;
  s.lifelineActive = null;
}

/** Lazy checks that must run before any action: question timeout, reconfirm timeout. */
export function tick(s: SessionState, now: number): void {
  if (s.phase === "question" && !s.begun && now >= s.autoStartAt) {
    s.begun = true;
    if (s.timed) s.runningSince = s.autoStartAt;
  }
  if (s.phase === "question" && s.timed && remaining(s, now) < -GRACE_MS) {
    end(s, "timeout", 0, null, now);
  }
  if (s.phase === "reconfirm" && s.reconfirmDeadline !== null && now > s.reconfirmDeadline + GRACE_MS) {
    cancelPending(s, now);
  }
}

function cancelPending(s: SessionState, now: number) {
  s.cancels += 1;
  s.pendingIndex = null;
  s.reconfirmDeadline = null;
  s.phase = "question";
  resume(s, now);
}

function judge(s: SessionState, index: number, now: number) {
  pause(s, now);
  s.pendingIndex = null;
  s.reconfirmDeadline = null;
  const correct = index === s.q.correctIndex;
  s.lastPick = { index, correct };
  const ladder = s.settings.ladder;

  if (correct) {
    s.bankedCoins = ladder[s.level - 1].coins;
    if (s.level >= ladder.length) {
      end(s, "win", s.bankedCoins, index, now);
      s.reveal = { correctIndex: index, pickedIndex: index, correct: true };
      return;
    }
    s.phase = "revealed";
    s.reveal = { correctIndex: index, pickedIndex: index, correct: true };
    return;
  }

  if (s.doubleActive && !s.doubleMissUsed) {
    // Double Chance: first miss is forgiven, host announces, then one more pick from the remaining options.
    s.doubleMissUsed = true;
    s.eliminated.push(index);
    s.phase = "dcMiss";
    return;
  }

  end(s, "wrong", 0, index, now);
}

/** Apply a player action. `nextQ` is required for the "next" action (caller picks it from the DB). */
export function apply(
  s: SessionState,
  a: GameAction,
  now: number,
  opts: { nextQ?: QuestionSnap; rng?: () => number } = {},
): SessionState {
  const rng = opts.rng ?? Math.random;
  tick(s, now);
  const fail = (msg: string) => { throw new GameError(msg); };

  const needBegun = () => { if (!s.begun) fail("Wait for the options to appear."); };
  switch (a.type) {
    case "begin": {
      if (s.phase === "question" && !s.begun) { s.begun = true; resume(s, now); }
      break;
    }
    case "select": {
      if (s.phase !== "question") fail("You can't pick an option right now.");
      needBegun();
      if (!Number.isInteger(a.index) || a.index < 0 || a.index > 3) fail("Bad option.");
      if (s.eliminated.includes(a.index)) fail("That option is already out.");
      if (s.cancels >= s.settings.maxCancelsPerQuestion) {
        judge(s, a.index, now); // "Final answer then!" — no more reconfirm
      } else {
        pause(s, now);
        s.phase = "reconfirm";
        s.pendingIndex = a.index;
        s.reconfirmDeadline = now + s.settings.reconfirmSec * 1000;
      }
      break;
    }
    case "confirm": {
      if (s.phase !== "reconfirm" || s.pendingIndex === null) fail("Nothing to confirm.");
      judge(s, s.pendingIndex!, now);
      break;
    }
    case "cancel": {
      if (s.phase !== "reconfirm") fail("Nothing to cancel.");
      cancelPending(s, now);
      break;
    }
    case "lifeline": {
      if (s.phase !== "question") fail("Lifelines can only be used while answering.");
      needBegun();
      if (!["double", "phone", "askAi"].includes(a.id)) fail("Unknown lifeline.");
      if (s.lifelinesUsed[a.id]) fail("Lifeline already used.");
      s.lifelinesUsed[a.id] = true;
      if (a.id === "double") {
        s.doubleActive = true; // timer keeps running; pauses again when an option is selected
      } else if (a.id === "phone") {
        pause(s, now);
        s.phase = "lifeline";
        s.lifelineActive = { id: "phone", deadline: now + s.settings.phoneFriendSec * 1000 };
      } else {
        pause(s, now);
        s.phase = "lifeline";
        const live = [0, 1, 2, 3].filter((i) => !s.eliminated.includes(i));
        const wrong = live.filter((i) => i !== s.q.correctIndex);
        const right = rng() * 100 < s.settings.askAiCorrectPct || !wrong.length;
        const suggestion = right ? s.q.correctIndex : wrong[Math.floor(rng() * wrong.length)];
        s.lifelineActive = { id: "askAi", suggestion };
      }
      break;
    }
    case "resume": {
      if (s.phase !== "lifeline" && s.phase !== "dcMiss") fail("Nothing to resume.");
      s.lifelineActive = null;
      s.phase = "question";
      resume(s, now);
      break;
    }
    case "walkAway": {
      if (s.phase !== "question") fail("You can only walk away before locking an answer.");
      needBegun();
      if (s.level < s.settings.walkAwayFromLevel) fail(`Walking away opens at question ${s.settings.walkAwayFromLevel}.`);
      end(s, "walk", s.bankedCoins, null, now);
      s.reveal = { correctIndex: s.q.correctIndex, pickedIndex: null, correct: false };
      break;
    }
    case "next": {
      if (s.phase !== "revealed") fail("Not ready for the next question.");
      if (!opts.nextQ) throw new GameError("No question available.", 500);
      s.level += 1;
      s.usedIds.push(opts.nextQ.id);
      setupQuestion(s, opts.nextQ, now);
      break;
    }
    case "timeout": {
      // Client says its countdown hit zero. Trust only the server clock.
      if (s.phase === "question" && s.timed && remaining(s, now) <= GRACE_MS) end(s, "timeout", 0, null, now);
      break;
    }
    default:
      fail("Unknown action.");
  }
  s.version += 1;
  return s;
}

/** Strip secrets. The correct answer only appears once revealed/over. */
export function toPublic(s: SessionState, now: number): PublicState {
  const rem = remaining(s, now);
  const la = s.lifelineActive;
  const revealVisible = s.phase === "revealed" || s.phase === "over";
  return {
    id: s.id,
    name: s.name,
    phase: s.phase,
    level: s.level,
    bankedCoins: s.bankedCoins,
    ladder: s.settings.ladder.map((l) => ({ coins: l.coins, tier: l.tier })),
    question: { text: s.q.text, options: s.q.options, eliminated: s.eliminated },
    timer: {
      timed: s.timed,
      remainingMs: s.timed ? Math.max(0, Math.round(rem)) : 0,
      running: s.timed && s.runningSince !== null,
      totalMs: s.totalMs,
    },
    lifelines: {
      double: !s.lifelinesUsed.double,
      phone: !s.lifelinesUsed.phone,
      askAi: !s.lifelinesUsed.askAi,
    },
    doubleActive: s.doubleActive,
    pendingIndex: s.pendingIndex,
    reconfirmMs: s.reconfirmDeadline !== null ? Math.max(0, s.reconfirmDeadline - now) : null,
    cancelsLeft: Math.max(0, s.settings.maxCancelsPerQuestion - s.cancels),
    lifelineActive: !la ? null : la.id === "phone" ? { id: "phone", remainingMs: Math.max(0, la.deadline - now) } : { id: "askAi", suggestion: la.suggestion },
    lastPick: s.lastPick,
    reveal: revealVisible && s.reveal ? { ...s.reveal, explanation: s.q.explanation, cpclFact: s.q.cpclFact ?? "" } : null,
    over: s.over,
    begun: s.begun,
    canWalkAway: s.phase === "question" && s.begun && s.level >= s.settings.walkAwayFromLevel,
    walkAwayFromLevel: s.settings.walkAwayFromLevel,
    phoneFriendSec: s.settings.phoneFriendSec,
    serverNow: now,
  };
}
