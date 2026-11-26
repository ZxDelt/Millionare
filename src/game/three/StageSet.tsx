"use client";
import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import { BackSide, DoubleSide, type Group, type Mesh, type MeshBasicMaterial, type MeshStandardMaterial, type Texture } from "three";
import { fx } from "./fx";
import { backdropTexture, floorTexture, logoTexture } from "./textures";

/** Static studio: floor, rings, LED wall, logo, atom centrepiece, seating tiers, desk. ~20 draw calls. */
export default function StageSet() {
  const floor = useMemo(floorTexture, []);
  const wall = useMemo(backdropTexture, []);
  const logoMat = useRef<MeshBasicMaterial>(null);
  const ringOuter = useRef<MeshBasicMaterial>(null);
  const ringInner = useRef<MeshBasicMaterial>(null);
  const floorMat = useRef<MeshStandardMaterial>(null);
  const wallMat = useRef<MeshBasicMaterial>(null);
  const atom = useRef<Group>(null);
  const core = useRef<Mesh>(null);

  useEffect(() => {
    let t: Texture | null = null;
    let alive = true;
    logoTexture().then((tx) => {
      if (!alive) return tx.dispose();
      t = tx;
      if (logoMat.current) { logoMat.current.map = tx; logoMat.current.needsUpdate = true; }
    }).catch(() => undefined);
    return () => { alive = false; t?.dispose(); floor.dispose(); wall.dispose(); };
  }, [floor, wall]);

  useFrame((_, dt) => {
    const glow = 0.6 + fx.heartbeat * 0.8;
    ringOuter.current?.color.copy(fx.ring).multiplyScalar(glow);
    ringInner.current?.color.copy(fx.ring).multiplyScalar(0.8 + fx.heartbeat);
    floorMat.current?.emissive.copy(fx.ring).multiplyScalar(0.08 + fx.heartbeat * 0.1);
    wallMat.current?.color.copy(fx.key).multiplyScalar(0.55);
    wall.offset.x += dt * 0.02 * (1 + fx.speed);
    if (atom.current) {
      atom.current.rotation.y += dt * (0.4 + fx.speed * 0.6);
      atom.current.children.forEach((c, i) => { if (i > 0) c.rotation.z += dt * (0.5 + i * 0.3); });
    }
    if (core.current) core.current.scale.setScalar(1 + fx.heartbeat * 0.25);
  });

  return (
    <group>
      {/* studio floor */}
      <mesh rotation-x={-Math.PI / 2} position-y={-0.41}>
        <circleGeometry args={[30, 32]} />
        <meshStandardMaterial color="#070a22" roughness={1} />
      </mesh>
      {/* stage disc */}
      <mesh position-y={-0.2}>
        <cylinderGeometry args={[5.5, 5.8, 0.4, 48]} />
        <meshStandardMaterial ref={floorMat} map={floor} roughness={0.6} metalness={0.2} />
      </mesh>
      <mesh rotation-x={Math.PI / 2} position-y={0.01}>
        <torusGeometry args={[5.5, 0.06, 6, 64]} />
        <meshBasicMaterial ref={ringOuter} toneMapped={false} />
      </mesh>
      <mesh rotation-x={Math.PI / 2} position-y={0.02}>
        <torusGeometry args={[2.1, 0.05, 6, 48]} />
        <meshBasicMaterial ref={ringInner} toneMapped={false} />
      </mesh>

      {/* LED wall behind the audience */}
      <mesh position-y={3}>
        <cylinderGeometry args={[14, 14, 9, 48, 1, true, Math.PI * 0.55, Math.PI * 0.9]} />
        <meshBasicMaterial ref={wallMat} map={wall} side={BackSide} toneMapped={false} />
      </mesh>
      {/* logo */}
      <mesh position={[0, 6.3, -12.2]}>
        <planeGeometry args={[7.2, 3.8]} />
        <meshBasicMaterial ref={logoMat} transparent toneMapped={false} />
      </mesh>

      {/* atom centrepiece */}
      <group ref={atom} position={[0, 5.4, -2]}>
        <mesh ref={core}>
          <icosahedronGeometry args={[0.35, 1]} />
          <meshBasicMaterial color="#ffc83d" toneMapped={false} />
        </mesh>
        {[0, 1, 2].map((i) => (
          <mesh key={i} rotation={[Math.PI / 2 + i * 1.05, i * 0.9, 0]}>
            <torusGeometry args={[0.95, 0.03, 4, 40]} />
            <meshBasicMaterial color="#22e1ff" toneMapped={false} />
          </mesh>
        ))}
      </group>

      {/* lighting truss */}
      <mesh rotation-x={Math.PI / 2} position-y={7.2}>
        <torusGeometry args={[6, 0.12, 4, 32]} />
        <meshStandardMaterial color="#20243a" metalness={0.8} roughness={0.4} />
      </mesh>

      {/* audience seating tiers (behind the stage) */}
      {[0, 1, 2].map((i) => (
        <mesh key={i} rotation-x={-Math.PI / 2} position-y={0.05 + i * 0.6}>
          <ringGeometry args={[8 + i * 1.2, 9.2 + i * 1.2, 32, 1, Math.PI * 1.05, Math.PI * 0.9]} />
          <meshStandardMaterial color={i % 2 ? "#141a45" : "#10153a"} side={DoubleSide} roughness={1} />
        </mesh>
      ))}

      {/* hot-seat desk */}
      <Seat x={-1.4} color="#3a1a7a" />
      <Seat x={1.4} color="#0b7f96" />
      <mesh position={[0, 0.45, 0]}>
        <cylinderGeometry args={[0.35, 0.45, 0.9, 6]} />
        <meshStandardMaterial color="#1a2060" metalness={0.5} roughness={0.4} />
      </mesh>
      <mesh position={[0, 0.92, 0]} rotation-x={-Math.PI / 2}>
        <circleGeometry args={[0.36, 6]} />
        <meshBasicMaterial color="#22e1ff" toneMapped={false} />
      </mesh>
    </group>
  );
}

function Seat({ x, color }: { x: number; color: string }) {
  return (
    <group position={[x, 0, 0]}>
      <mesh position-y={0.35}>
        <cylinderGeometry args={[0.08, 0.22, 0.7, 6]} />
        <meshStandardMaterial color="#202640" metalness={0.7} roughness={0.3} />
      </mesh>
      <mesh position-y={0.75}>
        <cylinderGeometry args={[0.4, 0.38, 0.12, 12]} />
        <meshStandardMaterial color={color} roughness={0.5} />
      </mesh>
    </group>
  );
}
