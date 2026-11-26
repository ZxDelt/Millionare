"use client";
import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import type { Mesh } from "three";
import { frame, useGame } from "../store";
import { audio } from "../audio";
import { fx } from "./fx";
import { hostAtlas, playerAtlas } from "./textures";

/**
 * Pixel-art host and player as camera-facing billboards.
 * Host mouth = voice loudness (ElevenLabs) via the analyser, or a flap while the text bubble types.
 */
export default function Characters() {
  const hostTex = useMemo(() => { const t = hostAtlas(); t.repeat.set(0.25, 1); return t; }, []);
  const playerTex = useMemo(() => { const t = playerAtlas(); t.repeat.set(0.5, 1); return t; }, []);
  const host = useRef<Mesh>(null);
  const player = useRef<Mesh>(null);

  useEffect(() => () => { hostTex.dispose(); playerTex.dispose(); }, [hostTex, playerTex]);

  useFrame(({ camera }) => {
    const s = useGame.getState();
    const t = fx.time;

    // --- host mouth
    const vol = audio.voiceLevel();
    let m = 0;
    if (vol > 0.02) m = vol > 0.55 ? 3 : vol > 0.3 ? 2 : vol > 0.08 ? 1 : 0;
    else if (s.talking) m = [0, 2, 1, 3, 0, 1][Math.floor(t * 12) % 6];
    frame.mouth = m;
    hostTex.offset.x = m * 0.25;

    const happy = s.mood === "correct" || s.mood === "jackpot";
    const sad = s.mood === "wrong";
    if (host.current) {
      host.current.position.y = 1.0 + Math.sin(t * 2) * 0.015 + (happy ? Math.abs(Math.sin(t * 6)) * 0.08 : 0);
      host.current.rotation.y = Math.atan2(camera.position.x - host.current.position.x, camera.position.z - host.current.position.z);
    }
    // --- player
    playerTex.offset.x = happy ? 0.5 : 0;
    if (player.current) {
      player.current.position.y = 1.0 + (happy ? Math.abs(Math.sin(t * 7)) * 0.12 : 0) - (sad ? 0.05 : 0);
      player.current.scale.y = sad ? 0.95 : 1;
      player.current.rotation.y = Math.atan2(camera.position.x - player.current.position.x, camera.position.z - player.current.position.z);
    }
  });

  return (
    <>
      <mesh ref={host} position={[-1.4, 1, 0]}>
        <planeGeometry args={[1.2, 2]} />
        <meshBasicMaterial map={hostTex} transparent alphaTest={0.5} toneMapped={false} />
      </mesh>
      <mesh ref={player} position={[1.4, 1, 0]}>
        <planeGeometry args={[1.2, 2]} />
        <meshBasicMaterial map={playerTex} transparent alphaTest={0.5} toneMapped={false} />
      </mesh>
    </>
  );
}
