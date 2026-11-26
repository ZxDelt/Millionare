"use client";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { PerformanceMonitor } from "@react-three/drei";
import { useEffect, useRef, useState } from "react";
import { setView, useGame } from "../store";
import { perf, QUALITY } from "./perf";
import MoodDriver from "./MoodDriver";
import StageSet from "./StageSet";
import Beams from "./Beams";
import Audience from "./Audience";
import Characters from "./Characters";
import Confetti from "./Confetti";
import CameraRig from "./CameraRig";
import { fx } from "./fx";

/**
 * The 3D studio. Renders at a low internal resolution (≈360 lines) and is upscaled with
 * nearest-neighbour CSS scaling: that is both the pixel-art look and the main GPU saving (GDD §14.3).
 */
export default function Stage() {
  const quality = useGame((s) => s.quality);
  const [vh, setVh] = useState(() => (typeof window === "undefined" ? 1080 : window.innerHeight));

  useEffect(() => {
    const onResize = () => setVh(window.innerHeight);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const lines = QUALITY[quality].lines;
  const dpr = Math.min(1, lines / Math.max(1, vh));
  perf.resH = Math.round(Math.min(vh, lines));

  return (
    <Canvas
      className="stage-canvas"
      dpr={dpr}
      gl={{ antialias: false, powerPreference: "high-performance", alpha: false, stencil: false }}
      camera={{ fov: 45, position: [0, 4, 11], near: 0.1, far: 80 }}
      frameloop="always"
      aria-hidden
    >
      <color attach="background" args={["#050719"]} />
      <fog attach="fog" args={["#050719", 14, 34]} />
      <PerformanceMonitor
        bounds={() => [54, 59]}
        flipflops={4}
        onDecline={() => setView((s) => ({ quality: Math.max(0, s.quality - 1) }))}
        onIncline={() => setView((s) => ({ quality: Math.min(QUALITY.length - 1, s.quality + 1) }))}
      />
      <PerfProbe />
      <Warmup />
      <MoodDriver />
      <Lights />
      <StageSet />
      <Beams />
      <Audience />
      <Characters />
      <Confetti />
      <CameraRig />
    </Canvas>
  );
}

function Lights() {
  const spot = useRef<import("three").SpotLight>(null);
  const point = useRef<import("three").PointLight>(null);
  useFrame(() => {
    if (spot.current) {
      spot.current.color.copy(fx.key);
      spot.current.intensity = 40 + fx.heartbeat * 30;
    }
    if (point.current) point.current.color.copy(fx.beam);
  });
  return (
    <>
      <ambientLight intensity={0.35} />
      <hemisphereLight args={["#6f7cff", "#0a0a20", 0.6]} />
      <spotLight ref={spot} position={[0, 9, 3]} angle={0.45} penumbra={0.6} distance={25} decay={1.5} />
      <pointLight ref={point} position={[0, 5, -2]} intensity={25} distance={18} decay={1.6} />
    </>
  );
}

/** Frame-time stats for the debug overlay and perf test (GDD §14.5). */
function PerfProbe() {
  const gl = useThree((s) => s.gl);
  const buf = useRef(new Float32Array(120));
  const idx = useRef(0);
  const last = useRef(0);
  useFrame(() => {
    const now = performance.now();
    if (last.current && !document.hidden) {
      const ms = now - last.current;
      buf.current[idx.current++ % 120] = ms;
      if (ms > 33.4 && ms < 1000) perf.hitches++;
    }
    last.current = now;
    if (idx.current % 15 === 0) {
      const n = Math.min(idx.current, 120);
      let sum = 0, worst = 0, slow = 0;
      for (let i = 0; i < n; i++) {
        const v = buf.current[i];
        sum += v;
        if (v > worst) worst = v;
        if (v > 17.5) slow++;
      }
      perf.avgMs = n ? sum / n : 0;
      perf.fps = perf.avgMs ? 1000 / perf.avgMs : 0;
      perf.worstMs = worst;
      perf.slowPct = n ? (slow / n) * 100 : 0;
      perf.calls = gl.info.render.calls;
      perf.tris = gl.info.render.triangles;
    }
  });
  return null;
}

/** Compile every shader before the show so the first reveal doesn't stutter (GDD §14.3). */
function Warmup() {
  const { gl, scene, camera } = useThree();
  const done = useRef(false);
  useFrame(() => {
    if (done.current) return;
    done.current = true;
    gl.compile(scene, camera);
    requestAnimationFrame(() => requestAnimationFrame(() => setView({ stageReady: true })));
  });
  return null;
}
