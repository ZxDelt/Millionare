/** Live performance numbers, written by the 3D loop and read by the debug overlay. */
export const perf = {
  fps: 0,
  avgMs: 0,
  worstMs: 0,
  slowPct: 0, // % of recent frames over 16.7 ms
  hitches: 0, // frames over 33 ms since start (visible stutter)
  calls: 0,
  tris: 0,
  resH: 0,
  crowd: 0,
};

/** Quality levels (GDD §14.4). 3 = best. */
export const QUALITY = [
  { lines: 270, crowd: 80, beams: 4 },
  { lines: 300, crowd: 150, beams: 6 },
  { lines: 360, crowd: 150, beams: 8 },
  { lines: 360, crowd: 300, beams: 8 },
] as const;
