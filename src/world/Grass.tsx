import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { WORLD_SIZE, distanceToSegment, isClear, rng, roadSegments } from './layout';
import { actors } from './actors';
import { useStore, type Tier } from '../store';

const HALF = WORLD_SIZE / 2;
const SEGMENTS = 5;
const MAX_STAMPS = 16;
const GRASS_DENSITY: Record<Tier, number> = { low: 0.45, medium: 0.75, high: 1 };
/** Low also trims the blades a little: fewer grass pixels to shade, which is what low-end GPUs struggle with. */
const GRASS_HEIGHT: Record<Tier, number> = { low: 0.78, medium: 1, high: 1 };
const TRAIL_SECONDS = 2.2;
const TRAIL_SPACING = 0.9;
const textClear: [number, number, number][] = [
  [-6, 12, 3.5], // ABOUT ground text
  [6.5, 12, 3.5], // CONTACT ground text
];

function bladeGeometry() {
  const pos: number[] = [];
  const idx: number[] = [];
  for (let i = 0; i < SEGMENTS; i++) {
    const h = i / SEGMENTS;
    // wide at the root, narrowing faster toward a sharp tip
    const w = 0.06 * (1 - h) ** 0.8;
    pos.push(-w, h, 0, w, h, 0);
  }
  pos.push(0, 1, 0);
  for (let i = 0; i < SEGMENTS - 1; i++) {
    const a = i * 2;
    idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
  }
  const last = (SEGMENTS - 1) * 2;
  idx.push(last, last + 1, last + 2);
  const g = new THREE.InstancedBufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(pos.map((_, i) => (i % 3 === 1 ? 1 : 0)), 3));
  g.setIndex(idx);
  return g;
}

/** Distance to the nearest road centreline. */
const roadDistance = (x: number, z: number) => Math.min(...roadSegments.map((seg) => distanceToSegment(x, z, seg)));

function scatter(target: number) {
  const r = rng(42);
  const blades = new Float32Array(target * 4);
  const tints = new Float32Array(target);
  let n = 0;
  let guard = 0;
  const add = (x: number, z: number, height: number, tint: number) => {
    blades.set([x, z, r() * Math.PI, height], n * 4);
    tints[n] = THREE.MathUtils.clamp(tint + (r() - 0.5) * 0.3, 0, 1);
    n++;
  };

  // Thick verges: grass bunches up along both edges of every road, where the wheels don't reach.
  const verge = Math.floor(target * 0.12);
  for (const [x1, z1, x2, z2] of roadSegments) {
    const len = Math.hypot(x2 - x1, z2 - z1);
    const nx = -(z2 - z1) / len;
    const nz = (x2 - x1) / len;
    for (let d = 0; d < len && n < verge; d += 0.35) {
      for (const side of [-1, 1]) {
        const off = 2.35 + r() * 0.9;
        const cx = x1 + ((x2 - x1) * d) / len + nx * side * off;
        const cz = z1 + ((z2 - z1) * d) / len + nz * side * off;
        const tint = r();
        for (let k = 0; k < 6 && n < verge; k++) {
          const x = cx + (r() - 0.5) * 0.5;
          const z = cz + (r() - 0.5) * 0.5;
          if (!isClear(x, z, 2.3) || textClear.some(([tx, tz, tr]) => Math.hypot(x - tx, z - tz) < tr)) continue;
          add(x, z, 0.45 + r() * 0.45, tint);
        }
      }
    }
  }

  while (n < target && guard++ < target * 4) {
    const cx = (r() * 2 - 1) * (HALF - 1);
    const cz = (r() * 2 - 1) * (HALF - 1);
    // low-frequency field makes meadows and thinner patches instead of an even carpet
    const field = 0.55 + 0.45 * Math.sin(cx * 0.21 + Math.sin(cz * 0.17) * 2) * Math.cos(cz * 0.19 - cx * 0.07);
    if (r() > field) continue;
    const tuft = 5 + Math.floor(r() * 7);
    const tint = r();
    for (let k = 0; k < tuft && n < target; k++) {
      const x = cx + (r() - 0.5) * 0.7;
      const z = cz + (r() - 0.5) * 0.7;
      if (!isClear(x, z, 2.3) || textClear.some(([tx, tz, tr]) => Math.hypot(x - tx, z - tz) < tr)) continue;
      // taller in lush patches and in open meadow away from the roads
      const open = Math.min(1, Math.max(0, (roadDistance(x, z) - 3) / 8));
      add(x, z, 0.32 + r() * 0.42 * (0.6 + field * 0.6) + open * 0.18, tint);
    }
  }
  return { blades: blades.subarray(0, n * 4), tints: tints.subarray(0, n), count: n };
}

const vertexHead = /* glsl */ `
uniform float uTime;
uniform float uHeight;
uniform vec4 uStamps[${MAX_STAMPS}];
attribute vec4 aBlade; // root x, root z, yaw, height
attribute float aTint;
varying float vH;
varying float vTint;
`;

const vertexBody = /* glsl */ `
float h = position.y;
vec2 root = aBlade.xy;
float height = aBlade.w * uHeight;
vec2 across = vec2(cos(aBlade.z), sin(aBlade.z));

vec2 windDir = vec2(0.89, 0.45);
float gust = sin(uTime * 0.9 - dot(root, windDir) * 0.22) * 0.5 + 0.5;
float flutter = sin(uTime * 3.1 + aBlade.z * 9.0 + root.x * 1.3) + 0.5 * sin(uTime * 4.7 + root.y * 2.1);
vec2 bend = windDir * (0.1 + 0.32 * gust * gust) + vec2(-windDir.y, windDir.x) * flutter * 0.05;

vec2 push = vec2(0.0);
for (int i = 0; i < ${MAX_STAMPS}; i++) {
  vec4 s = uStamps[i];
  if (s.z <= 0.0) continue;
  vec2 d = root - s.xy;
  float dist = length(d);
  float f = (1.0 - smoothstep(s.z * 0.45, s.z, dist)) * s.w;
  push += d / max(dist, 0.001) * f;
}
float pushAmt = min(length(push), 1.0);
bend = mix(bend, push * 1.5, pushAmt);

float b = min(length(bend), 1.3);
float curve = h * h;
vec3 transformed = vec3(
  root.x + across.x * position.x + bend.x * curve * height,
  h * height * (1.0 - 0.45 * b * b * h),
  root.y + across.y * position.x + bend.y * curve * height
);
vH = h;
vTint = aTint;
`;

const fragmentHead = /* glsl */ `
varying float vH;
varying float vTint;
`;

// Dark, shaded roots to bright tips; each clump's tint picks between fresh green, deep green and dry straw.
const fragmentColor = /* glsl */ `
vec3 grassBase = mix(vec3(0.13, 0.27, 0.12), vec3(0.24, 0.3, 0.14), vTint);
vec3 fresh = vec3(0.56, 0.76, 0.33);
vec3 deep = vec3(0.36, 0.6, 0.27);
vec3 straw = vec3(0.82, 0.77, 0.42);
vec3 grassTip = vTint < 0.8 ? mix(deep, fresh, vTint / 0.8) : mix(fresh, straw, (vTint - 0.8) / 0.2);
float t = smoothstep(0.0, 1.0, vH);
vec4 diffuseColor = vec4(mix(grassBase, grassTip, t * t * (1.6 - 0.6 * t)), opacity);
`;

export function Grass() {
  const coarse = typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches;
  const trail = useRef<{ x: number; z: number; r: number; t: number }[]>([]);
  const lastDrop = useRef(new Map<object, { x: number; z: number }>());

  const tier = useStore((st) => st.tier);

  const { geometry, material, uniforms, count } = useMemo(() => {
    const { blades, tints, count } = scatter(coarse ? 26000 : 80000);
    const geometry = bladeGeometry();
    geometry.setAttribute('aBlade', new THREE.InstancedBufferAttribute(blades, 4));
    geometry.setAttribute('aTint', new THREE.InstancedBufferAttribute(tints, 1));
    geometry.instanceCount = count;

    const uniforms = {
      uTime: { value: 0 },
      uHeight: { value: 1 },
      uStamps: { value: Array.from({ length: MAX_STAMPS }, () => new THREE.Vector4()) },
    };
    const material = new THREE.MeshStandardMaterial({ roughness: 0.9, side: THREE.DoubleSide });
    material.onBeforeCompile = (shader) => {
      Object.assign(shader.uniforms, uniforms);
      shader.vertexShader = vertexHead + shader.vertexShader.replace('#include <begin_vertex>', vertexBody);
      shader.fragmentShader = (fragmentHead + shader.fragmentShader)
        .replace('vec4 diffuseColor = vec4( diffuse, opacity );', fragmentColor)
        // blades are lit like the ground on both faces, so ignore the back-face normal flip
        .replace('#include <normal_fragment_begin>', '#include <normal_fragment_begin>\nnormal = normalize( vNormal );\nnonPerturbedNormal = normal;');
    };
    return { geometry, material, uniforms, count };
  }, [coarse]);

  // Blades were scattered one random tuft at a time, so drawing only the first N thins the meadow evenly.
  useEffect(() => {
    geometry.instanceCount = Math.round(count * GRASS_DENSITY[tier]);
    uniforms.uHeight.value = GRASS_HEIGHT[tier];
  }, [geometry, count, tier, uniforms]);

  useFrame(({ clock }) => {
    const now = clock.elapsedTime;
    uniforms.uTime.value = now;
    const stamps = uniforms.uStamps.value;
    let i = 0;

    for (const a of actors) {
      if (a.radius <= 0 || i >= MAX_STAMPS) continue;
      stamps[i++].set(a.x, a.z, a.radius, 1);
      const last = lastDrop.current.get(a);
      if (!last || Math.hypot(a.x - last.x, a.z - last.z) > TRAIL_SPACING) {
        lastDrop.current.set(a, { x: a.x, z: a.z });
        trail.current.push({ x: a.x, z: a.z, r: a.radius, t: now });
      }
    }

    trail.current = trail.current.filter((s) => now - s.t < TRAIL_SECONDS);
    // newest trail stamps first, so a long trail fades from its tail when slots run out
    for (let k = trail.current.length - 1; k >= 0 && i < MAX_STAMPS; k--) {
      const s = trail.current[k];
      const life = 1 - (now - s.t) / TRAIL_SECONDS;
      stamps[i++].set(s.x, s.z, s.r, life * life * (3 - 2 * life));
    }
    while (i < MAX_STAMPS) stamps[i++].set(0, 0, 0, 0);
  });

  return <mesh geometry={geometry} material={material} frustumCulled={false} receiveShadow />;
}
