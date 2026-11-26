import type { Difficulty } from "./constants";

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

const tier = (n: number): Difficulty => (n <= 5 ? "easy" : n <= 10 ? "medium" : "hard");
const COINS = [
  10_000, 20_000, 30_000, 50_000, 75_000, 100_000, 150_000, 250_000, 500_000, 1_000_000, 2_500_000, 5_000_000,
  10_000_000, 25_000_000, 50_000_000, 100_000_000,
];

/** GDD §5, §8, §11. */
export const DEFAULT_SETTINGS: GameSettings = {
  ladder: COINS.map((coins, i) => ({ coins, tier: tier(i + 1) })),
  questionTimerSec: 45,
  timedUntilLevel: 8,
  walkAwayFromLevel: 9,
  phoneFriendSec: 60,
  reconfirmSec: 10,
  maxCancelsPerQuestion: 1,
  askAiCorrectPct: 50,
};
