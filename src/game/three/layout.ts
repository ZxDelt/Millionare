/**
 * Shared studio layout (world units ≈ metres). The stage top is y = 0, the studio floor y = -0.41.
 * Host sits left, contestant right; both chairs angle toward each other and slightly toward camera.
 */
export const SEAT_X = 1.55;
export const SEAT_Z = 0.3;
export const SEAT_TOP = 0.6; // cushion height = sprite hip line
export const FACE_ANGLE = 0.45; // radians the chairs turn from "facing each other" toward the camera

export const HOST = { x: -SEAT_X, z: SEAT_Z, side: -1 } as const;
export const PLAYER = { x: SEAT_X, z: SEAT_Z, side: 1 } as const;

/** Head centre height of a seated sprite (used for speech-bubble anchors and monitor aim). */
export const HEAD_Y = 1.6;

/** Desk monitors sit on the console behind the line between the two chairs so the camera sees the screens. */
export const CONSOLE_Z = -0.3;
export const MONITOR_Y = 1.02;
export const MONITOR_X = 0.56;

// ---------------------------------------------------------------- arena (full circle around the stage)
export const TIERS = [
  { inner: 9.0, top: 0.05 },
  { inner: 10.2, top: 0.6 },
  { inner: 11.4, top: 1.15 },
] as const;
export const TIER_DEPTH = 1.2;
export const ARENA_BACK = TIERS[2].inner + TIER_DEPTH; // 12.6
export const AISLES = 8;
export const AISLE_HALF = 0.55; // metres of walkway on each side of an aisle centre line
export const SEAT_PITCH = 0.62;
export const SEAT_H = 0.415; // chair cushion height above its tier

export const aisleAngle = (k: number) => -Math.PI / 2 + (k * Math.PI * 2) / AISLES;

export interface ArenaSeat { x: number; z: number; y: number; a: number; r: number; section: number }

/** Every audience seat, deterministic so chairs and people always line up. */
export function arenaSeats(): ArenaSeat[] {
  const out: ArenaSeat[] = [];
  TIERS.forEach((t, row) => {
    const r = t.inner + 0.62;
    const n = Math.floor((Math.PI * 2 * r) / SEAT_PITCH);
    for (let k = 0; k < n; k++) {
      const a = (k / n) * Math.PI * 2;
      let near = false;
      let section = 0;
      for (let j = 0; j < AISLES; j++) {
        let d = a - aisleAngle(j);
        d = Math.atan2(Math.sin(d), Math.cos(d));
        if (Math.abs(d) * r < AISLE_HALF + SEAT_PITCH * 0.4) near = true;
        if (d > 0 && d < (Math.PI * 2) / AISLES) section = j;
      }
      if (!near) out.push({ x: Math.cos(a) * r, z: Math.sin(a) * r, y: t.top, a, r, section: section + row * AISLES });
    }
  });
  return out;
}

/** Tiny seeded PRNG so the crowd looks the same every load. */
export function rng(seed = 7) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}
