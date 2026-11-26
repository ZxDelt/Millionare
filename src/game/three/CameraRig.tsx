"use client";
import { useFrame } from "@react-three/fiber";
import { Vector3 } from "three";
import { useGame, type Mood } from "../store";
import { fx } from "./fx";

const pos = new Vector3();
const look = new Vector3();
const curLook = new Vector3(0, 1.2, 0);

/** Scripted TV camera shots per mood (GDD §12.1). Smoothly eased, no allocations. */
export default function CameraRig() {
  useFrame(({ camera }, dt) => {
    const s = useGame.getState();
    const t = fx.time;
    const mood: Mood = s.screen === "title" || s.screen === "loading" ? "lobby" : s.mood;
    let speed = 1.6;
    switch (mood) {
      case "lobby":
        pos.set(Math.sin(t * 0.08) * 7.8, 3.6, Math.cos(t * 0.08) * 7.8);
        look.set(0, 1.2, 0);
        speed = 0.8;
        break;
      case "intro":
      case "jackpot":
        pos.set(Math.sin(t * 0.25) * 7.6, 4 + Math.sin(t * 0.5) * 0.8, Math.cos(t * 0.25) * 7.6);
        look.set(0, 1.4, 0);
        break;
      case "locked":
      case "suspense":
        pos.set(0.7 + Math.sin(t * 0.3) * 0.25, 1.95, 5.3 - Math.sin(t * 0.2) * 0.2);
        look.set(0.8, 0.85, 0);
        speed = mood === "suspense" ? 0.5 : 2;
        break;
      case "wrong":
        pos.set(0, 3.2, 7.6);
        look.set(0, 0.6, 0);
        speed = 0.6;
        break;
      case "correct":
      case "walk":
        pos.set(-1.4, 2.2, 6.4);
        look.set(0.2, 0.7, 0);
        break;
      default: // question, tension, lifeline, miss
        pos.set(Math.sin(t * 0.15) * 0.3, 2.05, 6.6);
        look.set(0, 0.5, 0);
        speed = 1.2;
    }
    const k = 1 - Math.exp(-dt * speed);
    // Move around the studio in cylinder coordinates so cuts between shots never fly through the desk.
    const cp = camera.position;
    const cr = Math.hypot(cp.x, cp.z), ca = Math.atan2(cp.x, cp.z);
    const tr = Math.hypot(pos.x, pos.z), ta = Math.atan2(pos.x, pos.z);
    const da = Math.atan2(Math.sin(ta - ca), Math.cos(ta - ca));
    const nr = cr + (tr - cr) * k, na = ca + da * k;
    cp.set(Math.sin(na) * nr, cp.y + (pos.y - cp.y) * k, Math.cos(na) * nr);
    curLook.lerp(look, k);
    camera.lookAt(curLook);
  });
  return null;
}
