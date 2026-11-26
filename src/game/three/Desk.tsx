"use client";
import { useFrame } from "@react-three/fiber";
import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { Vector3, type Group, type Mesh, type MeshBasicMaterial } from "three";
import { useGame, type GameView } from "../store";
import { formatCoins } from "@/lib/speech";
import { fx } from "./fx";
import { liveCanvas } from "./textures";
import { CONSOLE_Z, HEAD_Y, HOST, MONITOR_X, MONITOR_Y, PLAYER } from "./layout";

const W = 192, H = 120;
const LETTERS = ["A", "B", "C", "D"];
const PLATE_COL: Record<string, [string, string]> = {
  idle: ["#121a5c", "#eef1ff"],
  selected: ["#ffb02e", "#1a1033"],
  locked: ["#ff7a1a", "#1a1033"],
  correct: ["#2ee66b", "#04210e"],
  wrong: ["#d01a3a", "#ffffff"],
  eliminated: ["#0a0d26", "#3a4070"],
};

function wrap(g: CanvasRenderingContext2D, text: string, maxW: number, maxLines: number) {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    const tryLine = cur ? `${cur} ${w}` : w;
    if (g.measureText(tryLine).width > maxW && cur) { lines.push(cur); cur = w; } else cur = tryLine;
  }
  if (cur) lines.push(cur);
  if (lines.length > maxLines) { lines.length = maxLines; lines[maxLines - 1] += "…"; }
  return lines;
}

function fit(g: CanvasRenderingContext2D, text: string, maxW: number) {
  if (g.measureText(text).width <= maxW) return text;
  let s = text;
  while (s.length > 1 && g.measureText(s + "…").width > maxW) s = s.slice(0, -1);
  return s + "…";
}

/** The contestant/host monitor: live question, options, lock/correct states. */
function drawMonitor(g: CanvasRenderingContext2D, s: GameView) {
  const bg = g.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, "#0b1450");
  bg.addColorStop(1, "#050824");
  g.fillStyle = bg;
  g.fillRect(0, 0, W, H);
  g.textBaseline = "middle";
  const sv = s.server;
  if (!sv?.question || s.screen === "title" || s.screen === "loading") {
    g.fillStyle = "#ffc83d";
    g.font = "bold 20px sans-serif";
    g.textAlign = "center";
    g.fillText("JOULE", W / 2, 46);
    g.fillText("JACKPOT", W / 2, 70);
    g.fillStyle = "#22e1ff";
    g.font = "bold 10px sans-serif";
    g.fillText("STAND BY", W / 2, 96);
    return;
  }
  // header
  g.fillStyle = "#22e1ff";
  g.fillRect(0, 0, W, 16);
  g.fillStyle = "#050824";
  g.font = "bold 10px sans-serif";
  g.textAlign = "left";
  g.fillText(`Q${sv.level}`, 6, 8.5);
  g.textAlign = "right";
  g.fillText(`◆ ${formatCoins(sv.ladder[sv.level - 1].coins)}`, W - 6, 8.5);
  if (!s.questionVisible) {
    g.fillStyle = "#9aa3d6";
    g.textAlign = "center";
    g.font = "bold 11px sans-serif";
    g.fillText("NEXT QUESTION…", W / 2, 66);
    return;
  }
  g.fillStyle = "#eef1ff";
  g.font = "bold 10px sans-serif";
  g.textAlign = "center";
  wrap(g, sv.question.text, W - 14, 3).forEach((l, i) => g.fillText(l, W / 2, 27 + i * 12));
  // 2×2 option grid
  g.font = "bold 9px sans-serif";
  for (let i = 0; i < 4; i++) {
    const x = 5 + (i % 2) * 93, y = 66 + Math.floor(i / 2) * 26;
    const shown = i < s.optionsShown;
    const [fill, ink] = PLATE_COL[shown ? s.plates[i] : "eliminated"];
    g.fillStyle = s.suggestion === i && s.plates[i] === "idle" ? "#22e1ff" : "#2a3a9a";
    g.fillRect(x, y, 89, 22);
    g.fillStyle = fill;
    g.fillRect(x + 1, y + 1, 87, 20);
    if (!shown) continue;
    g.textAlign = "left";
    g.fillStyle = s.plates[i] === "idle" ? "#ffc83d" : ink;
    g.fillText(LETTERS[i], x + 5, y + 11.5);
    g.fillStyle = ink;
    g.fillText(fit(g, sv.question.options[i], 70), x + 15, y + 11.5);
  }
}

/** Jumbotron: level, prize and timer state. */
function drawJumbo(g: CanvasRenderingContext2D, s: GameView) {
  g.fillStyle = "#06092a";
  g.fillRect(0, 0, W, H);
  g.strokeStyle = "#22e1ff";
  g.lineWidth = 2;
  g.strokeRect(3, 3, W - 6, H - 6);
  g.textAlign = "center";
  g.textBaseline = "middle";
  const sv = s.server;
  if (!sv || s.screen !== "play") {
    g.fillStyle = "#ffc83d";
    g.font = "bold 22px sans-serif";
    g.fillText("ENERGY", W / 2, 44);
    g.fillText("QUIZ SHOW", W / 2, 72);
    return;
  }
  g.fillStyle = "#9aa3d6";
  g.font = "bold 12px sans-serif";
  g.fillText(`QUESTION ${sv.level} OF 16`, W / 2, 28);
  g.fillStyle = "#ffc83d";
  g.font = "bold 24px sans-serif";
  g.fillText(`◆ ${formatCoins(sv.ladder[sv.level - 1].coins)}`, W / 2, 60);
  g.fillStyle = "#22e1ff";
  g.font = "bold 12px sans-serif";
  g.fillText(sv.over ? "GAME OVER" : sv.level >= sv.walkAwayFromLevel ? "NO TIMER · WALK AWAY OPEN" : "45 SECOND CLOCK", W / 2, 92);
}

function Monitor({ x, target, map }: { x: number; target: Vector3; map: import("three").Texture }) {
  const g = useRef<Group>(null);
  useLayoutEffect(() => { g.current?.lookAt(target); }, [target]);
  return (
    <group position={[x, MONITOR_Y, CONSOLE_Z]}>
      {/* arm down to the console */}
      <mesh position={[0, -0.16, 0]}>
        <boxGeometry args={[0.05, 0.3, 0.05]} />
        <meshStandardMaterial color="#5a6488" metalness={0.8} roughness={0.3} />
      </mesh>
      <group ref={g}>
        <mesh>
          <boxGeometry args={[0.66, 0.44, 0.05]} />
          <meshStandardMaterial color="#14182e" metalness={0.5} roughness={0.5} />
        </mesh>
        <mesh position-z={0.027}>
          <planeGeometry args={[0.6, 0.375]} />
          <meshBasicMaterial map={map} toneMapped={false} />
        </mesh>
      </group>
    </group>
  );
}

/** Centre console with the two desk monitors, energy core and side jumbotrons. */
export default function Desk() {
  const mon = useMemo(() => liveCanvas(W, H), []);
  const jumbo = useMemo(() => liveCanvas(W, H), []);
  const core = useRef<Mesh>(null);
  const topMat = useRef<MeshBasicMaterial>(null);
  const hostHead = useMemo(() => new Vector3(HOST.x, HEAD_Y - 0.15, HOST.z), []);
  const playerHead = useMemo(() => new Vector3(PLAYER.x, HEAD_Y - 0.15, PLAYER.z), []);

  useEffect(() => {
    const redraw = (s: GameView) => {
      drawMonitor(mon.g, s); mon.t.needsUpdate = true;
      drawJumbo(jumbo.g, s); jumbo.t.needsUpdate = true;
    };
    redraw(useGame.getState());
    const unsub = useGame.subscribe((s, p) => {
      if (s.server !== p.server || s.plates !== p.plates || s.optionsShown !== p.optionsShown ||
        s.questionVisible !== p.questionVisible || s.suggestion !== p.suggestion || s.screen !== p.screen) redraw(s);
    });
    return () => { unsub(); mon.t.dispose(); jumbo.t.dispose(); };
  }, [mon, jumbo]);

  useFrame((_, dt) => {
    if (core.current) {
      core.current.rotation.y += dt * (0.8 + fx.speed);
      core.current.rotation.x += dt * 0.4;
      core.current.scale.setScalar(1 + fx.heartbeat * 0.3 + Math.sin(fx.time * 3) * 0.05);
    }
    topMat.current?.color.copy(fx.ring);
  });

  return (
    <group>
      {/* console */}
      <group position={[0, 0, CONSOLE_Z]}>
        <mesh position-y={0.4}>
          <cylinderGeometry args={[0.36, 0.5, 0.8, 6]} />
          <meshStandardMaterial color="#1a2060" metalness={0.6} roughness={0.35} />
        </mesh>
        <mesh position-y={0.81}>
          <cylinderGeometry args={[0.95, 0.95, 0.04, 6]} />
          <meshStandardMaterial color="#232a6e" metalness={0.5} roughness={0.3} />
        </mesh>
        <mesh position-y={0.835} rotation-x={-Math.PI / 2}>
          <ringGeometry args={[0.78, 0.9, 6]} />
          <meshBasicMaterial ref={topMat} toneMapped={false} />
        </mesh>
        <mesh ref={core} position-y={1.12}>
          <icosahedronGeometry args={[0.11, 0]} />
          <meshBasicMaterial color="#ffc83d" toneMapped={false} />
        </mesh>
      </group>
      <Monitor x={-MONITOR_X} target={hostHead} map={mon.t} />
      <Monitor x={MONITOR_X} target={playerHead} map={mon.t} />

      {/* hanging jumbotrons */}
      {[-1, 1].map((side) => (
        <group key={side} position={[side * 6.8, 5.5, -9.6]} rotation-y={-side * 0.55}>
          <mesh>
            <boxGeometry args={[3.5, 2.3, 0.12]} />
            <meshStandardMaterial color="#10142a" metalness={0.6} roughness={0.4} />
          </mesh>
          <mesh position-z={0.065}>
            <planeGeometry args={[3.3, 2.06]} />
            <meshBasicMaterial map={jumbo.t} toneMapped={false} />
          </mesh>
          <mesh position={[0, 2.2, 0]}>
            <boxGeometry args={[0.04, 2.1, 0.04]} />
            <meshStandardMaterial color="#20243a" />
          </mesh>
        </group>
      ))}
    </group>
  );
}
