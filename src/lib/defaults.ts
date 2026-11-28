import type { Difficulty } from "./constants";
export { LADDER_LEN } from "./constants";

export interface LadderStep {
  coins: number;
  tier: Difficulty;
}

export interface GameSettings {
  ladder: LadderStep[];
  questionTimerSec: number;
  timedUntilLevel: number;
  walkAwayFromLevel: number;
  phoneFriendSec: number;
  reconfirmSec: number;
  maxCancelsPerQuestion: number;
  askAiCorrectPct: number;
}

// 50 thousand → 2.5 lakh → 10 lakh → 50 lakh → 1 crore
const COINS = [50_000, 250_000, 1_000_000, 5_000_000, 10_000_000];
const TIERS: Difficulty[] = ["easy", "easy", "medium", "medium", "hard"];

/** GDD §5, §8, §11. */
export const DEFAULT_SETTINGS: GameSettings = {
  ladder: COINS.map((coins, i) => ({ coins, tier: TIERS[i] })),
  questionTimerSec: 45,
  timedUntilLevel: 5, // every question is timed
  walkAwayFromLevel: 6, // > ladder length = walking away is off
  phoneFriendSec: 60,
  reconfirmSec: 10,
  maxCancelsPerQuestion: 1,
  askAiCorrectPct: 50,
};
