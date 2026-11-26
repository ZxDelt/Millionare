"use client";
import { useEffect, useRef } from "react";
import { perf } from "../three/perf";
import { useGame } from "../store";

/** ?debug=1 — FPS, frame times, draw calls, quality level (GDD §14.5). Polls at 4 Hz, no per-frame React. */
export default function DebugOverlay() {
  const ref = useRef<HTMLPreElement>(null);
  useEffect(() => {
    const id = setInterval(() => {
      if (!ref.current) return;
      const q = useGame.getState().quality;
      ref.current.textContent =
        `FPS ${perf.fps.toFixed(0)}  avg ${perf.avgMs.toFixed(1)}ms  worst ${perf.worstMs.toFixed(1)}ms\n` +
        `>16.7ms ${perf.slowPct.toFixed(1)}%  >33ms ${perf.hitches}\n` +
        `draws ${perf.calls}  tris ${perf.tris}  quality ${q}  res ${perf.resH}p  crowd ${perf.crowd}`;
    }, 250);
    return () => clearInterval(id);
  }, []);
  return <pre className="debug" ref={ref} />;
}
