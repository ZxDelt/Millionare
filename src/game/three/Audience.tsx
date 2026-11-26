"use client";
import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import { InstancedBufferAttribute, Object3D, PlaneGeometry, ShaderMaterial, Vector3, type InstancedMesh } from "three";
import { useGame } from "../store";
import { fx } from "./fx";
import { crowdAtlas } from "./textures";
import { perf, QUALITY } from "./perf";

const MAX = 300;
const REACT = { idle: 0, clap: 1, cheer: 2, gasp: 3 } as const;

/**
 * Fake audience: up to 300 pixel sprites in ONE instanced draw call.
 * All animation happens in the vertex shader from per-instance attributes; JS does no per-sprite work.
 */
export default function Audience() {
  const mesh = useRef<InstancedMesh>(null);
  const quality = useGame((s) => s.quality);
  const atlas = useMemo(crowdAtlas, []);

  const { geo, mat } = useMemo(() => {
    const geo = new PlaneGeometry(1, 1);
    const vars = new Float32Array(MAX);
    const seeds = new Float32Array(MAX);
    for (let i = 0; i < MAX; i++) {
      vars[i] = Math.floor(Math.random() * 8);
      seeds[i] = Math.random();
    }
    geo.setAttribute("aVar", new InstancedBufferAttribute(vars, 1));
    geo.setAttribute("aSeed", new InstancedBufferAttribute(seeds, 1));
    const mat = new ShaderMaterial({
      uniforms: {
        uAtlas: { value: atlas },
        uTime: { value: 0 },
        uReact: { value: 0 },
        uAge: { value: 0 },
        uLight: { value: new Vector3(1, 1, 1) },
      },
      vertexShader: /* glsl */ `
        attribute float aVar; attribute float aSeed;
        uniform float uTime, uReact, uAge;
        varying vec2 vUv; varying float vShade;
        void main() {
          vec4 base = modelViewMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
          float t = uTime + aSeed * 10.0;
          float frame = 0.0; float jump = 0.0; float sway = sin(t * 1.3) * 0.02;
          float energy = clamp(1.0 - uAge / 4.0, 0.0, 1.0);          // reactions fade over ~4 s
          if (uReact > 2.5) {                                         // gasp: hands up, lean back
            frame = step(0.4, fract(aSeed * 7.0)) * step(uAge, 1.5); jump = -0.04 * energy;
          } else if (uReact > 1.5) {                                  // cheer: jump with arms up
            frame = step(0.15, energy); jump = abs(sin(t * 7.0)) * 0.28 * energy;
          } else if (uReact > 0.5) {                                  // clap
            frame = step(0.5, fract(t * 4.0)) * step(0.05, energy); jump = abs(sin(t * 8.0)) * 0.03 * energy;
          }
          base.xy += vec2(position.x * 0.55 + sway, (position.y + 0.5) * 0.92 + jump);
          gl_Position = projectionMatrix * base;
          float col = aVar * 2.0 + frame;
          vUv = vec2((col + uv.x) / 16.0, uv.y);
          vShade = 0.55 + 0.45 * fract(aSeed * 13.0);
        }`,
      fragmentShader: /* glsl */ `
        uniform sampler2D uAtlas; uniform vec3 uLight;
        varying vec2 vUv; varying float vShade;
        void main() {
          vec4 c = texture2D(uAtlas, vUv);
          if (c.a < 0.5) discard;
          gl_FragColor = vec4(c.rgb * vShade * uLight, 1.0);
          #include <colorspace_fragment>
        }`,
    });
    return { geo, mat };
  }, [atlas]);

  // Seat positions on three tiers behind the stage.
  useEffect(() => {
    const m = mesh.current;
    if (!m) return;
    const d = new Object3D();
    let i = 0;
    const order: number[] = [];
    for (let tier = 0; tier < 3; tier++) {
      const r = 8.6 + tier * 1.2;
      const n = 100;
      for (let k = 0; k < n; k++) {
        const a = Math.PI * 1.08 + (k / (n - 1)) * Math.PI * 0.84 + (Math.random() - 0.5) * 0.01;
        d.position.set(Math.cos(a) * r, 0.05 + tier * 0.6, Math.sin(a) * r);
        d.updateMatrix();
        m.setMatrixAt(i, d.matrix);
        order.push(i++);
      }
    }
    // Shuffle draw order so lower quality (smaller count) removes people evenly, not a whole section.
    for (let j = MAX - 1; j > 0; j--) {
      const k = Math.floor(Math.random() * (j + 1));
      const a = order[j]; order[j] = order[k]; order[k] = a;
    }
    const tmp = new Object3D().matrix.clone();
    const mats = order.map((src) => { const mm = tmp.clone(); m.getMatrixAt(src, mm); return mm; });
    mats.forEach((mm, j) => m.setMatrixAt(j, mm));
    m.instanceMatrix.needsUpdate = true;
    return () => { geo.dispose(); mat.dispose(); atlas.dispose(); };
  }, [geo, mat, atlas]);

  useFrame(() => {
    const m = mesh.current;
    if (!m) return;
    const s = useGame.getState();
    m.count = QUALITY[quality].crowd;
    perf.crowd = m.count;
    mat.uniforms.uTime.value = fx.time;
    mat.uniforms.uReact.value = REACT[s.crowd];
    mat.uniforms.uAge.value = (performance.now() - s.crowdAt) / 1000;
    (mat.uniforms.uLight.value as Vector3).set(fx.crowd.r * 1.2, fx.crowd.g * 1.2, fx.crowd.b * 1.2);
  });

  return <instancedMesh ref={mesh} args={[geo, mat, MAX]} frustumCulled={false} />;
}
