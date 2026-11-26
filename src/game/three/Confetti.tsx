"use client";
import { useFrame } from "@react-three/fiber";
import { useMemo } from "react";
import { BufferAttribute, BufferGeometry, ShaderMaterial } from "three";
import { useGame } from "../store";

const N = 500;
const COLORS = [[1, 0.78, 0.24], [0.13, 0.88, 1], [0.18, 0.9, 0.42], [1, 0.2, 0.33], [1, 1, 1]];

/** GPU confetti: positions computed in the shader from launch velocity + age. One draw call, no JS per particle. */
export default function Confetti() {
  const { geo, mat } = useMemo(() => {
    const geo = new BufferGeometry();
    const pos = new Float32Array(N * 3);
    const vel = new Float32Array(N * 3);
    const col = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 1 + Math.random() * 4;
      vel.set([Math.cos(a) * sp, 3 + Math.random() * 5, Math.sin(a) * sp], i * 3);
      col.set(COLORS[i % COLORS.length], i * 3);
    }
    geo.setAttribute("position", new BufferAttribute(pos, 3));
    geo.setAttribute("aVel", new BufferAttribute(vel, 3));
    geo.setAttribute("aColor", new BufferAttribute(col, 3));
    geo.boundingSphere = null;
    const mat = new ShaderMaterial({
      transparent: true,
      depthWrite: false,
      uniforms: { uAge: { value: -1 } },
      vertexShader: /* glsl */ `
        attribute vec3 aVel; attribute vec3 aColor; uniform float uAge; varying vec3 vC; varying float vA;
        void main() {
          vC = aColor;
          float t = uAge;
          vA = (t < 0.0 || t > 6.0) ? 0.0 : clamp(1.0 - (t - 4.0) / 2.0, 0.0, 1.0);
          vec3 p = vec3(0.0, 6.5, -1.0) + aVel * t + vec3(0.0, -4.0, 0.0) * t * t;
          p.y = max(p.y, 0.05);
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          gl_Position = projectionMatrix * mv;
          gl_PointSize = vA > 0.0 ? 3.0 : 0.0;
        }`,
      fragmentShader: /* glsl */ `
        varying vec3 vC; varying float vA;
        void main() { if (vA <= 0.0) discard; gl_FragColor = vec4(vC, vA); }`,
    });
    return { geo, mat };
  }, []);

  useFrame(() => {
    const at = useGame.getState().confettiAt;
    mat.uniforms.uAge.value = at < 0 ? -1 : (performance.now() - at) / 1000;
  });

  // Always "visible" so its shader is compiled during warm-up; it draws nothing until triggered.
  return <points geometry={geo} material={mat} frustumCulled={false} />;
}
