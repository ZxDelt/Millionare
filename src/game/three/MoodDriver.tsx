"use client";
import { useFrame } from "@react-three/fiber";
import { Color } from "three";
import { useGame } from "../store";
import { fx, LOOKS } from "./fx";

const target = { beam: new Color(), key: new Color(), ring: new Color(), crowd: new Color() };
const tmp = new Color();

/** Blends stage colors toward the current mood's look. Runs first each frame. */
export default function MoodDriver() {
  useFrame((_, dt) => {
    const look = LOOKS[useGame.getState().mood];
    fx.time += dt;
    const k = 1 - Math.exp(-dt * 4);
    target.beam.set(look.beam);
    target.key.set(look.key);
    target.ring.set(look.ring);
    target.crowd.set(look.crowd);
    if (look.rainbow) {
      tmp.setHSL((fx.time * 0.25) % 1, 0.9, 0.6);
      target.beam.copy(tmp);
      tmp.setHSL((fx.time * 0.25 + 0.5) % 1, 0.9, 0.6);
      target.ring.copy(tmp);
    }
    fx.beam.lerp(target.beam, k);
    fx.key.lerp(target.key, k);
    fx.ring.lerp(target.ring, k);
    fx.crowd.lerp(target.crowd, k);
    fx.speed += (look.speed - fx.speed) * k;
    fx.intensity += (look.intensity - fx.intensity) * k;
    fx.pulse += (look.pulse - fx.pulse) * k;
    // heartbeat: two quick thumps per ~0.8 s cycle
    const c = (fx.time % 0.8) / 0.8;
    const beat = Math.exp(-((c - 0.05) ** 2) / 0.002) + 0.6 * Math.exp(-((c - 0.3) ** 2) / 0.002);
    fx.heartbeat = beat * fx.pulse;
  }, -1);
  return null;
}
