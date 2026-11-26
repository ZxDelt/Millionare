"use client";
import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import { AdditiveBlending, ConeGeometry, DoubleSide, Object3D, ShaderMaterial, type InstancedMesh } from "three";
import { useGame } from "../store";
import { fx } from "./fx";
import { QUALITY } from "./perf";

const MAX = 8;
const dummy = new Object3D();

/** Fake volumetric light beams: additive cones, one draw call (GDD §14.3 "fake the light show"). */
export default function Beams() {
  const mesh = useRef<InstancedMesh>(null);
  const quality = useGame((s) => s.quality);

  const geo = useMemo(() => {
    const g = new ConeGeometry(1.1, 8, 16, 1, true);
    g.translate(0, -4, 0); // apex at origin, cone hangs down
    return g;
  }, []);

  const mat = useMemo(
    () =>
      new ShaderMaterial({
        transparent: true,
        depthWrite: false,
        blending: AdditiveBlending,
        side: DoubleSide,
        uniforms: { uColor: { value: fx.beam }, uIntensity: { value: 0.5 } },
        vertexShader: /* glsl */ `
          varying float vH;
          void main() {
            vH = -position.y / 8.0;            // 0 at the lamp, 1 at the floor
            gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0);
          }`,
        fragmentShader: /* glsl */ `
          uniform vec3 uColor; uniform float uIntensity;
          varying float vH;
          void main() {
            float a = (1.0 - vH) * 0.35 * uIntensity;
            gl_FragColor = vec4(uColor * a, a);
          }`,
      }),
    [],
  );

  useFrame(() => {
    const m = mesh.current;
    if (!m) return;
    m.count = QUALITY[quality].beams;
    mat.uniforms.uIntensity.value = fx.intensity * (1 + fx.heartbeat * 0.6);
    const t = fx.time * fx.speed;
    for (let i = 0; i < m.count; i++) {
      const a = (i / m.count) * Math.PI * 2;
      dummy.position.set(Math.cos(a) * 6, 7.2, Math.sin(a) * 6);
      dummy.rotation.set(Math.sin(t + i * 1.7) * 0.45, 0, Math.cos(t * 0.8 + i) * 0.45);
      // tilt toward stage centre
      dummy.rotation.x += Math.sin(a) * 0.35;
      dummy.rotation.z -= Math.cos(a) * 0.35;
      dummy.updateMatrix();
      m.setMatrixAt(i, dummy.matrix);
    }
    m.instanceMatrix.needsUpdate = true;
  });

  return <instancedMesh ref={mesh} args={[geo, mat, MAX]} frustumCulled={false} renderOrder={10} />;
}
