"use client";
import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import {
  AdditiveBlending, BackSide, BoxGeometry, BufferAttribute, BufferGeometry, Color, CylinderGeometry, DoubleSide,
  LatheGeometry, MeshBasicMaterial as MeshBasicMaterialCtor, Object3D, ShaderMaterial, Vector2,
  type Group, type InstancedMesh, type Mesh, type MeshBasicMaterial, type MeshStandardMaterial, type Texture,
} from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { fx } from "./fx";
import { backdropTexture, floorTexture, logoTexture } from "./textures";
import { AISLES, ARENA_BACK, aisleAngle, arenaSeats, SEAT_H, TIER_DEPTH, TIERS } from "./layout";

const dummy = new Object3D();
const SEATS = arenaSeats();
const SECTION_COLORS = ["#5a1838", "#3a1a6a", "#1a2f6a", "#5a1838", "#3a1a6a", "#1a2f6a", "#4a1a5a", "#1a3a5a"].map((c) => new Color(c));

/** Static studio: floor, stage, full-circle seating bowl, LED wall, truss, pylons, TV cameras. */
export default function StageSet() {
  const floor = useMemo(floorTexture, []);
  const wall = useMemo(() => { const t = backdropTexture(); t.repeat.set(6, 1); return t; }, []);
  const logoMat = useRef<MeshBasicMaterial>(null);
  const ringOuter = useRef<MeshBasicMaterial>(null);
  const ringInner = useRef<MeshBasicMaterial>(null);
  const floorMat = useRef<MeshStandardMaterial>(null);
  const wallMat = useRef<MeshBasicMaterial>(null);
  const stripMat = useMemo(() => new MeshBasicMaterialCtor({ toneMapped: false }), []);
  const pylonMat = useRef<MeshBasicMaterial>(null);
  const lampMat = useRef<MeshBasicMaterial>(null);
  const tally = useRef<MeshBasicMaterial>(null);
  const atom = useRef<Group>(null);
  const core = useRef<Mesh>(null);
  const seats = useRef<InstancedMesh>(null);
  const steps = useRef<InstancedMesh>(null);
  const pylons = useRef<InstancedMesh>(null);
  const lamps = useRef<InstancedMesh>(null);

  // Stepped seating bowl: one lathe = all three tiers, risers and the back wall.
  const bowl = useMemo(() => {
    const pts: Vector2[] = [new Vector2(TIERS[0].inner, -0.41)];
    TIERS.forEach((t) => { pts.push(new Vector2(t.inner, t.top), new Vector2(t.inner + TIER_DEPTH, t.top)); });
    pts.push(new Vector2(ARENA_BACK, 2.6), new Vector2(ARENA_BACK + 0.3, 2.6), new Vector2(ARENA_BACK + 0.3, -0.41));
    return new LatheGeometry(pts, 96);
  }, []);

  const chairGeo = useMemo(() => mergeGeometries([
    new BoxGeometry(0.46, 0.07, 0.4).translate(0, SEAT_H - 0.035, 0),
    new BoxGeometry(0.46, 0.5, 0.06).translate(0, SEAT_H + 0.2, 0.2),
    new BoxGeometry(0.06, SEAT_H - 0.07, 0.06).translate(0, (SEAT_H - 0.07) / 2, 0.05),
  ]) as BufferGeometry, []);

  const tvGeo = useMemo(() => ({
    body: mergeGeometries([
      new BoxGeometry(0.38, 0.32, 0.62).translate(0, 1.55, 0),
      new CylinderGeometry(0.11, 0.13, 0.32, 10).rotateX(Math.PI / 2).translate(0, 1.55, -0.45),
      new BoxGeometry(0.22, 0.16, 0.06).translate(0, 1.6, 0.34),
    ]) as BufferGeometry,
    legs: mergeGeometries([
      new CylinderGeometry(0.05, 0.05, 1.4, 6).translate(0, 0.7, 0),
      new CylinderGeometry(0.02, 0.02, 1.0, 4).rotateZ(0.5).translate(0.25, 0.4, 0),
      new CylinderGeometry(0.02, 0.02, 1.0, 4).rotateZ(-0.5).translate(-0.25, 0.4, 0),
      new CylinderGeometry(0.02, 0.02, 1.0, 4).rotateX(0.5).translate(0, 0.4, -0.25),
    ]) as BufferGeometry,
  }), []);

  useEffect(() => {
    let t: Texture | null = null;
    let alive = true;
    logoTexture().then((tx) => {
      if (!alive) return tx.dispose();
      t = tx;
      if (logoMat.current) { logoMat.current.map = tx; logoMat.current.needsUpdate = true; }
    }).catch(() => undefined);

    // audience chairs, facing the stage
    const sm = seats.current;
    if (sm) {
      SEATS.forEach((s, i) => {
        dummy.position.set(s.x, s.y, s.z);
        dummy.rotation.set(0, Math.PI / 2 - s.a, 0);
        dummy.updateMatrix();
        sm.setMatrixAt(i, dummy.matrix);
        sm.setColorAt(i, SECTION_COLORS[s.section % SECTION_COLORS.length]);
      });
      sm.instanceMatrix.needsUpdate = true;
      if (sm.instanceColor) sm.instanceColor.needsUpdate = true;
    }
    // aisle step lights on each riser
    const st = steps.current;
    if (st) {
      let i = 0;
      for (let k = 0; k < AISLES; k++) {
        const a = aisleAngle(k);
        TIERS.forEach((tier) => {
          for (const off of [-0.45, 0.45]) {
            const r = tier.inner + 0.02;
            const da = off / r;
            dummy.position.set(Math.cos(a + da) * r, tier.top - 0.08, Math.sin(a + da) * r);
            dummy.rotation.set(0, Math.PI / 2 - a, 0);
            dummy.updateMatrix();
            st.setMatrixAt(i++, dummy.matrix);
          }
        });
      }
      st.instanceMatrix.needsUpdate = true;
    }
    // LED pylons around the stage edge (behind and beside the desk, never in front of the camera)
    const py = pylons.current;
    if (py) {
      PYLON_ANGLES.forEach((deg, i) => {
        const a = (deg * Math.PI) / 180;
        dummy.position.set(Math.cos(a) * 5.75, 1.3, Math.sin(a) * 5.75);
        dummy.rotation.set(0, -a, 0);
        dummy.updateMatrix();
        py.setMatrixAt(i, dummy.matrix);
      });
      py.instanceMatrix.needsUpdate = true;
    }
    // lamp cans on the truss
    const lm = lamps.current;
    if (lm) {
      for (let i = 0; i < LAMPS; i++) {
        const a = (i / LAMPS) * Math.PI * 2;
        dummy.position.set(Math.cos(a) * 6, 6.95, Math.sin(a) * 6);
        dummy.rotation.set(0, 0, 0);
        dummy.updateMatrix();
        lm.setMatrixAt(i, dummy.matrix);
      }
      lm.instanceMatrix.needsUpdate = true;
    }
    return () => {
      alive = false; t?.dispose(); floor.dispose(); wall.dispose(); bowl.dispose(); chairGeo.dispose();
      tvGeo.body.dispose(); tvGeo.legs.dispose(); stripMat.dispose();
    };
  }, [floor, wall, bowl, chairGeo, tvGeo, stripMat]);

  useFrame((_, dt) => {
    const glow = 0.6 + fx.heartbeat * 0.8;
    ringOuter.current?.color.copy(fx.ring).multiplyScalar(glow);
    ringInner.current?.color.copy(fx.ring).multiplyScalar(0.8 + fx.heartbeat);
    floorMat.current?.emissive.copy(fx.ring).multiplyScalar(0.08 + fx.heartbeat * 0.1);
    wallMat.current?.color.copy(fx.key).multiplyScalar(0.55);
    stripMat.color.copy(fx.ring).multiplyScalar(0.75 + fx.heartbeat * 0.5);
    pylonMat.current?.color.copy(fx.beam).multiplyScalar(0.7 + Math.sin(fx.time * 2) * 0.15 + fx.heartbeat * 0.6);
    lampMat.current?.color.copy(fx.beam).multiplyScalar(1.4);
    if (tally.current) tally.current.color.setRGB(Math.sin(fx.time * 4) > -0.3 ? 1 : 0.25, 0.05, 0.08);
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
        <circleGeometry args={[ARENA_BACK + 1, 48]} />
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
        <torusGeometry args={[2.6, 0.05, 6, 48]} />
        <meshBasicMaterial ref={ringInner} toneMapped={false} />
      </mesh>

      {/* seating bowl + chairs + riser LED strips + aisle step lights */}
      <mesh geometry={bowl}>
        <meshStandardMaterial color="#121845" roughness={0.95} side={DoubleSide} />
      </mesh>
      <instancedMesh ref={seats} args={[chairGeo, undefined, SEATS.length]} frustumCulled={false}>
        <meshStandardMaterial roughness={0.7} />
      </instancedMesh>
      {TIERS.map((t, i) => (
        <mesh key={i} rotation-x={Math.PI / 2} position-y={t.top - 0.02} material={stripMat}>
          <torusGeometry args={[t.inner + 0.01, 0.025, 4, 96]} />
        </mesh>
      ))}
      <instancedMesh ref={steps} args={[undefined, undefined, AISLES * TIERS.length * 2]} frustumCulled={false}>
        <boxGeometry args={[0.12, 0.05, 0.04]} />
        <meshBasicMaterial color="#ffc83d" toneMapped={false} />
      </instancedMesh>

      {/* LED wall all the way round, above the back row */}
      <mesh position-y={5.4}>
        <cylinderGeometry args={[ARENA_BACK + 0.4, ARENA_BACK + 0.4, 5.6, 64, 1, true]} />
        <meshBasicMaterial ref={wallMat} map={wall} side={BackSide} toneMapped={false} />
      </mesh>
      {/* logo screen */}
      <mesh position={[0, 4.9, -(ARENA_BACK - 0.1)]}>
        <planeGeometry args={[6.4, 3.36]} />
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

      {/* lighting truss with lamp cans */}
      <mesh rotation-x={Math.PI / 2} position-y={7.2}>
        <torusGeometry args={[6, 0.12, 4, 32]} />
        <meshStandardMaterial color="#20243a" metalness={0.8} roughness={0.4} />
      </mesh>
      <instancedMesh ref={lamps} args={[undefined, undefined, LAMPS]} frustumCulled={false}>
        <cylinderGeometry args={[0.12, 0.16, 0.3, 8]} />
        <meshBasicMaterial ref={lampMat} toneMapped={false} />
      </instancedMesh>

      {/* LED pylons */}
      <instancedMesh ref={pylons} args={[undefined, undefined, PYLON_ANGLES.length]} frustumCulled={false}>
        <boxGeometry args={[0.16, 2.6, 0.16]} />
        <meshBasicMaterial ref={pylonMat} toneMapped={false} />
      </instancedMesh>

      {/* TV cameras on tripods, pointing at the desk */}
      {[-1, 1].map((side) => (
        <group key={side} position={[side * 6.9, -0.41, -3.6]} rotation-y={Math.atan2(side * 6.9, -3.6)}>
          <mesh geometry={tvGeo.legs}>
            <meshStandardMaterial color="#2a2f48" metalness={0.7} roughness={0.4} />
          </mesh>
          <mesh geometry={tvGeo.body}>
            <meshStandardMaterial color="#3a3f5a" metalness={0.5} roughness={0.45} />
          </mesh>
          <mesh position={[0, 1.76, 0.1]}>
            <boxGeometry args={[0.07, 0.05, 0.07]} />
            <meshBasicMaterial ref={side < 0 ? tally : undefined} color="#ff1030" toneMapped={false} />
          </mesh>
        </group>
      ))}
      <Motes />
    </group>
  );
}

const LAMPS = 16;
const PYLON_ANGLES = [160, 200, 228, 312, 340, 20];

/** Dust in the light: drifting additive points, one draw call, animated in the shader. */
function Motes() {
  const { geo, mat } = useMemo(() => {
    const n = 220;
    const pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = Math.sqrt(Math.random()) * 7.5;
      pos[i * 3] = Math.cos(a) * r;
      pos[i * 3 + 1] = 0.3 + Math.random() * 6.5;
      pos[i * 3 + 2] = Math.sin(a) * r;
    }
    const geo = new BufferGeometry();
    geo.setAttribute("position", new BufferAttribute(pos, 3));
    const mat = new ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
      uniforms: { uTime: { value: 0 }, uColor: { value: fx.beam } },
      vertexShader: /* glsl */ `
        uniform float uTime;
        varying float vA;
        void main() {
          vec3 p = position;
          float s = p.x * 1.7 + p.z * 0.9;
          p.y = mod(p.y + uTime * 0.12 + sin(s) * 0.5, 7.0) + 0.2;
          p.x += sin(uTime * 0.3 + s) * 0.3;
          p.z += cos(uTime * 0.25 + s) * 0.3;
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          gl_Position = projectionMatrix * mv;
          gl_PointSize = 18.0 / -mv.z;
          vA = 0.5 + 0.5 * sin(uTime + s * 3.0);
        }`,
      fragmentShader: /* glsl */ `
        uniform vec3 uColor;
        varying float vA;
        void main() { gl_FragColor = vec4(uColor * 0.55 * vA, 1.0); }`,
    });
    return { geo, mat };
  }, []);
  useEffect(() => () => { geo.dispose(); mat.dispose(); }, [geo, mat]);
  useFrame(() => { mat.uniforms.uTime.value = fx.time; });
  return <points geometry={geo} material={mat} frustumCulled={false} />;
}
