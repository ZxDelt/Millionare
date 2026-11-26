"use client";
import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import { BoxGeometry, CylinderGeometry, Vector3, type BufferGeometry, type Mesh, type MeshBasicMaterial } from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { frame, useGame, type Anchor } from "../store";
import { audio } from "../audio";
import { fx } from "./fx";
import { hostAtlas, playerAtlas } from "./textures";
import { FACE_ANGLE, HEAD_Y, HOST, PLAYER } from "./layout";

// Chairs draw after the scene without writing depth, and sprites draw after the chairs: the character
// is always painted onto the chair, so it can sit right on the cushion with no clipping.
const SPRITE_FWD = 0.1;
const READ_YAW = 0.32; // how far a character turns toward its monitor while reading
const v = new Vector3();
const toCam = new Vector3();

/** Chair facing: toward the other seat, turned FACE_ANGLE toward the camera. Returns Y rotation. */
function chairYaw(side: number) {
  const fx_ = -side * Math.cos(FACE_ANGLE);
  const fz = Math.sin(FACE_ANGLE);
  return Math.atan2(-fx_, -fz); // local -Z = front
}

function box(w: number, h: number, d: number, x: number, y: number, z: number) {
  return new BoxGeometry(w, h, d).translate(x, y, z);
}

/** Hot-seat chair: chrome frame, upholstery, glowing trim. 3 draw calls. */
function useChairGeometry() {
  return useMemo(() => {
    const chrome = mergeGeometries([
      new CylinderGeometry(0.34, 0.38, 0.06, 16).translate(0, 0.03, 0),
      new CylinderGeometry(0.05, 0.06, 0.48, 8).translate(0, 0.28, 0),
      box(0.04, 0.22, 0.04, 0.5, 0.67, 0.02),
      box(0.04, 0.22, 0.04, -0.5, 0.67, 0.02),
    ]) as BufferGeometry;
    // order matters (no depth write): back first, then cushion, then armrests
    const pad = mergeGeometries([
      box(0.96, 1.15, 0.12, 0, 1.12, 0.3),
      box(0.96, 0.12, 0.62, 0, 0.54, 0),
      box(0.1, 0.08, 0.5, 0.5, 0.82, 0.02),
      box(0.1, 0.08, 0.5, -0.5, 0.82, 0.02),
    ]) as BufferGeometry;
    const trim = box(0.98, 0.05, 0.13, 0, 1.71, 0.3);
    return { chrome, pad, trim };
  }, []);
}

function Chair({ x, z, side, color, geo, trimRef }: {
  x: number; z: number; side: number; color: string;
  geo: ReturnType<typeof useChairGeometry>; trimRef: React.RefObject<MeshBasicMaterial | null>;
}) {
  return (
    <group position={[x, 0, z]} rotation-y={chairYaw(side)}>
      <mesh geometry={geo.chrome} renderOrder={4}>
        <meshStandardMaterial color="#9aa3c8" metalness={0.85} roughness={0.25} depthWrite={false} />
      </mesh>
      <mesh geometry={geo.pad} renderOrder={5}>
        <meshStandardMaterial color={color} roughness={0.55} depthWrite={false} />
      </mesh>
      <mesh geometry={geo.trim} renderOrder={5}>
        <meshBasicMaterial ref={trimRef} toneMapped={false} depthWrite={false} />
      </mesh>
    </group>
  );
}

/**
 * Pixel-art host and contestant, seated. Sprites face the camera but turn toward their desk monitor
 * while reading. Host mouth follows the voice loudness (ElevenLabs) or flaps while a bubble types.
 * Head positions are projected to screen pixels every frame for the speech bubbles.
 */
export default function Characters() {
  const hostTex = useMemo(() => { const t = hostAtlas(); t.repeat.set(1 / 8, 0.5); return t; }, []);
  const playerTex = useMemo(() => { const t = playerAtlas(); t.repeat.set(1 / 5, 0.5); return t; }, []);
  const host = useRef<Mesh>(null);
  const player = useRef<Mesh>(null);
  const hostTrim = useRef<MeshBasicMaterial>(null);
  const playerTrim = useRef<MeshBasicMaterial>(null);
  const geo = useChairGeometry();
  const st = useRef({ hostYaw: 0, playerYaw: 0, spokeAt: 0, blinkH: 2, blinkP: 3.3, pKey: -1, pTalkUntil: 0 });

  useEffect(() => () => {
    hostTex.dispose(); playerTex.dispose();
    geo.chrome.dispose(); geo.pad.dispose(); geo.trim.dispose();
  }, [hostTex, playerTex, geo]);

  useFrame(({ camera, size }, dt) => {
    const s = useGame.getState();
    const t = fx.time;
    const now = performance.now();
    const k = st.current;
    const happy = s.mood === "correct" || s.mood === "jackpot";
    const sad = s.mood === "wrong";

    // ---- host
    const vol = audio.voiceLevel();
    let m = 0;
    if (vol > 0.02) m = vol > 0.55 ? 3 : vol > 0.3 ? 2 : vol > 0.08 ? 1 : 0;
    else if (s.talking) m = [0, 2, 1, 3, 0, 1][Math.floor(t * 12) % 6];
    frame.mouth = m;
    if (vol > 0.02 || s.talking) k.spokeAt = now;
    const speaking = now - k.spokeAt < 700;
    const inPlay = s.screen === "play";
    const waiting = s.mood === "question" || s.mood === "tension" || s.mood === "suspense" || s.mood === "lifeline";
    // reading the question → monitor; talking → camera; quietly waiting with the player → monitor
    const hostLook = s.hostReading || (inPlay && !speaking && waiting && !s.reconfirm && !s.walkConfirm) ? 1 : 0;
    if (t > k.blinkH + 0.13) k.blinkH = t + 2.5 + Math.random() * 3;
    const hostBlink = t > k.blinkH && !(m > 0);
    hostTex.offset.set((hostLook * 4 + m) / 8, hostBlink ? 0 : 0.5);

    // ---- player
    if (s.player.key !== k.pKey) { k.pKey = s.player.key; k.pTalkUntil = s.player.visible ? now + 500 + s.player.text.length * 45 : 0; }
    const pTalking = s.player.visible && now < k.pTalkUntil;
    const reading = inPlay && s.questionVisible && s.server?.phase === "question" && !s.reconfirm && !s.player.visible && !s.phone && !s.walkConfirm;
    let pf = 0;
    if (happy) pf = 1;
    else if (pTalking) pf = Math.floor(t * 9) % 2 ? 4 : 0;
    else if (reading) pf = Math.sin(t * 0.5 + 1) > 0.35 ? 3 : 2;
    if (t > k.blinkP + 0.13) k.blinkP = t + 2.8 + Math.random() * 3.5;
    const playerBlink = t > k.blinkP && pf !== 1;
    playerTex.offset.set(pf / 5, playerBlink ? 0 : 0.5);

    // ---- place sprites in front of their chairs, facing the camera (+ a turn toward the monitor)
    const ease = 1 - Math.exp(-dt * 6);
    k.hostYaw += ((hostLook ? READ_YAW : 0) - k.hostYaw) * ease;
    k.playerYaw += ((pf === 2 || pf === 3 ? -READ_YAW : 0) - k.playerYaw) * ease;
    place(host.current, HOST.x, HOST.z, 0.012 * Math.sin(t * 2) + (happy ? Math.abs(Math.sin(t * 6)) * 0.05 : 0), k.hostYaw, camera.position);
    place(player.current, PLAYER.x, PLAYER.z, (happy ? Math.abs(Math.sin(t * 7)) * 0.08 : 0) - (sad ? 0.03 : 0), k.playerYaw, camera.position);
    if (player.current) player.current.scale.y = sad ? 0.96 : 1 + Math.sin(t * 1.7) * 0.006;

    // ---- head anchors for the DOM speech bubbles
    anchor(frame.anchors.host, host.current, camera, size);
    anchor(frame.anchors.player, player.current, camera, size);

    const glow = 0.7 + fx.heartbeat * 0.6;
    hostTrim.current?.color.copy(fx.ring).multiplyScalar(glow);
    playerTrim.current?.color.copy(fx.ring).multiplyScalar(glow);
  });

  return (
    <>
      <Chair x={HOST.x} z={HOST.z} side={HOST.side} color="#4a1f8f" geo={geo} trimRef={hostTrim} />
      <Chair x={PLAYER.x} z={PLAYER.z} side={PLAYER.side} color="#0b6f86" geo={geo} trimRef={playerTrim} />
      <mesh ref={host} position={[HOST.x, 1, HOST.z]} renderOrder={6}>
        <planeGeometry args={[1.2, 2]} />
        <meshBasicMaterial map={hostTex} transparent alphaTest={0.5} toneMapped={false} />
      </mesh>
      <mesh ref={player} position={[PLAYER.x, 1, PLAYER.z]} renderOrder={6}>
        <planeGeometry args={[1.2, 2]} />
        <meshBasicMaterial map={playerTex} transparent alphaTest={0.5} toneMapped={false} />
      </mesh>
    </>
  );
}

function place(mesh: Mesh | null, x: number, z: number, lift: number, yaw: number, cam: Vector3) {
  if (!mesh) return;
  toCam.set(cam.x - x, 0, cam.z - z).normalize();
  mesh.position.set(x + toCam.x * SPRITE_FWD, 1 + lift, z + toCam.z * SPRITE_FWD);
  mesh.rotation.y = Math.atan2(toCam.x, toCam.z) + yaw;
}

function anchor(a: Anchor, mesh: Mesh | null, camera: import("three").Camera, size: { width: number; height: number }) {
  if (!mesh) { a.on = false; return; }
  v.set(mesh.position.x, HEAD_Y + (mesh.position.y - 1), mesh.position.z).project(camera);
  const x = (v.x + 1) / 2 * size.width;
  const y = (1 - v.y) / 2 * size.height;
  const inFront = v.z > -1 && v.z < 1;
  v.set(mesh.position.x, HEAD_Y + 0.5 + (mesh.position.y - 1), mesh.position.z).project(camera);
  a.scale = Math.abs(y - (1 - v.y) / 2 * size.height) / 0.5;
  a.x = x;
  a.y = y;
  a.on = inFront && v.x > -1.15 && v.x < 1.15;
}
