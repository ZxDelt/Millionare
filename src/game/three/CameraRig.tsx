"use client";
import { useFrame } from "@react-three/fiber";
import { Vector3 } from "three";
import { useGame, type Mood } from "../store";
import { fx } from "./fx";

const pos = new Vector3();
const look = new Vector3();
const curLook = new Vector3(0, 1.4, 0);

/** Scripted TV camera shots per mood (GDD §12.1). Smoothly eased, no allocations. */
export default function CameraRig() {
  useFrame(({ camera }, dt) => {
    const s = useGame.getState();
    const t = fx.time;
    const mood: Mood = s.screen === "title" || s.screen === "loading" ? "lobby" : s.mood;
    let speed = 1.6;
    switch (mood) {
      case "lobby":
        pos.set(Math.sin(t * 0.08) * 11, 4.2, Math.cos(t * 0.08) * 11);
        look.set(0, 1.6, -2);
        speed = 0.8;
        break;
      case "intro":
      case "jackpot":
        pos.set(Math.sin(t * 0.25) * 9, 5 + Math.sin(t * 0.5), Math.cos(t * 0.25) * 9 + 1);
        look.set(0, 2, -2);
        break;
      case "locked":
      case "suspense":
        pos.set(2.6 + Math.sin(t * 0.3) * 0.4, 1.9, 4.2 - Math.sin(t * 0.2) * 0.3);
        look.set(0.6, 1.4, 0);
        speed = mood === "suspense" ? 0.5 : 2;
        break;
      case "wrong":
        pos.set(0, 3.2, 8.5);
        look.set(0, 1.2, -1);
        speed = 0.6;
        break;
      case "correct":
      case "walk":
        pos.set(-1.5, 2.6, 7);
        look.set(0, 1.5, -1);
        break;
      default: // question, tension, lifeline, miss
        pos.set(0 + Math.sin(t * 0.15) * 0.3, 2.5, 7.2);
        look.set(0, 1.5, 0);
        speed = 1.2;
    }
    const k = 1 - Math.exp(-dt * speed);
    camera.position.lerp(pos, k);
    curLook.lerp(look, k);
    camera.lookAt(curLook);
  });
  return null;
}
