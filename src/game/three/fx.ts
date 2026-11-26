import { Color } from "three";
import type { Mood } from "../store";

/** Target look per mood (GDD §12.3). Colors are blended toward these every frame by <MoodDriver>. */
interface Look {
  beam: string;
  key: string;
  ring: string;
  crowd: string;
  speed: number; // beam sweep speed
  intensity: number; // beam opacity
  pulse: number; // 0..1 heartbeat pulse amount
  rainbow?: boolean;
}

export const LOOKS: Record<Mood, Look> = {
  lobby: { beam: "#7b4dff", key: "#6f7cff", ring: "#22e1ff", crowd: "#8a90c8", speed: 0.25, intensity: 0.5, pulse: 0 },
  intro: { beam: "#ffc83d", key: "#ffffff", ring: "#22e1ff", crowd: "#c8ccff", speed: 1.4, intensity: 0.9, pulse: 0, rainbow: true },
  question: { beam: "#2a56ff", key: "#8fa6ff", ring: "#22e1ff", crowd: "#5a608f", speed: 0.18, intensity: 0.38, pulse: 0 },
  tension: { beam: "#ff3355", key: "#ff8f9f", ring: "#ff3355", crowd: "#6a4a5a", speed: 0.3, intensity: 0.5, pulse: 0.6 },
  locked: { beam: "#ff7a1a", key: "#ffc07a", ring: "#ff7a1a", crowd: "#5a4a40", speed: 0.1, intensity: 0.6, pulse: 0 },
  suspense: { beam: "#6a1bff", key: "#b48aff", ring: "#ff7a1a", crowd: "#3a3050", speed: 0.06, intensity: 0.45, pulse: 1 },
  correct: { beam: "#2ee66b", key: "#c9ffd9", ring: "#2ee66b", crowd: "#c8f0d0", speed: 1.2, intensity: 0.9, pulse: 0 },
  wrong: { beam: "#801020", key: "#ff5a6a", ring: "#ff3355", crowd: "#40252a", speed: 0.05, intensity: 0.3, pulse: 0 },
  miss: { beam: "#ff3355", key: "#ff9aa8", ring: "#ff3355", crowd: "#6a4a5a", speed: 0.4, intensity: 0.7, pulse: 0.4 },
  lifeline: { beam: "#22e1ff", key: "#b9f6ff", ring: "#22e1ff", crowd: "#7aa0b0", speed: 0.5, intensity: 0.7, pulse: 0 },
  walk: { beam: "#fff2d6", key: "#fff2d6", ring: "#ffc83d", crowd: "#c8c0a8", speed: 0.15, intensity: 0.6, pulse: 0 },
  jackpot: { beam: "#ffc83d", key: "#ffffff", ring: "#ffc83d", crowd: "#ffffff", speed: 2, intensity: 1, pulse: 0, rainbow: true },
};

/** Current blended values. Mutated in place each frame (no allocations). */
export const fx = {
  beam: new Color(LOOKS.lobby.beam),
  key: new Color(LOOKS.lobby.key),
  ring: new Color(LOOKS.lobby.ring),
  crowd: new Color(LOOKS.lobby.crowd),
  speed: LOOKS.lobby.speed,
  intensity: LOOKS.lobby.intensity,
  pulse: 0,
  heartbeat: 0, // 0..1 current pulse value
  time: 0,
};
