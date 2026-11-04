import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { WORLD_SIZE, distanceToSegment, isClear, meadowField, rng, roadSegments } from './layout';
import { actors } from './actors';
import { windUniforms } from './wind';
import { useStore, type Tier } from '../store';

const HALF = WORLD_SIZE / 2;
const MAX_STAMPS = 12;
// One instance is a tuft of five wide blades (15 triangles) instead of one thin blade (7): far more ground covered
// for fewer triangles. Each blade has just two segments; the vertex shader still bends the tip with the wind.
const BLADES_PER_TUFT = 5;
const TUFTS_FULL = 28000;
const TUFTS_COARSE = 8500;
const GRASS_DENSITY: Record<Tier, number> = { low: 0.4, medium: 0.75, high: 1 };
/** Low also trims the blades a little: fewer grass pixels to shade, which is what low-end GPUs struggle with. */
const GRASS_HEIGHT: Record<Tier, number> = { low: 0.62, medium: 0.9, high: 1 };
const TRAIL_SECONDS = 2.2;
const TRAIL_SPACING = 0.9;
const textClear: [number, number, number][] = [
  [-6, 12, 3.5], // ABOUT ground text
  [6.5, 12, 3.5], // CONTACT ground text
];

/**
 * A tuft: blades fanned out around the centre, each leaning outwards. Vertex position.xz holds the blade's offset
 * from the tuft centre (rotated by the instance yaw in the shader), position.y the 0..1 height along the blade.
 * aShape = (height factor, tint shift) per blade, so a tuft is never one flat colour or one height.
 */
function tuftGeometry() {
  const r = rng(7);
  const pos: number[] = [];
  const shape: number[] = [];
  const idx: number[] = [];
  for (let i = 0; i < BLADES_PER_TUFT; i++) {
    const a = (i / BLADES_PER_TUFT) * Math.PI * 2 + (r() - 0.5) * 0.7;
    const rho = i === 0 ? 0.02 : 0.05 + r() * 0.09;
    const cx = Math.cos(a) * rho;
    const cz = Math.sin(a) * rho;
    const face = a + Math.PI / 2 + (r() - 0.5) * 0.9; // width axis, roughly across the outward direction
    const wx = Math.cos(face);
    const wz = Math.sin(face);
    const width = 0.075 + r() * 0.035; // half-width at the root, metres
    const hf = i === 0 ? 1.15 : 0.72 + r() * 0.38;
    const tint = (r() - 0.5) * 0.24;
    const lean = 0.06 + r() * 0.1;
    const lx = Math.cos(a) * lean;
    const lz = Math.sin(a) * lean;
    const base = pos.length / 3;
    for (const [h, w] of [[0, 1], [0.5, 0.7], [1, 0]] as const) {
      const k = h * h; // lean grows towards the tip
      const rows = h === 1 ? [0] : [-1, 1];
      for (const side of rows) {
        pos.push(cx + wx * width * w * side + lx * k, h, cz + wz * width * w * side + lz * k);
        shape.push(hf, tint);
      }
    }
    // rows: L0 R0 | L1 R1 | T
    idx.push(base, base + 1, base + 2, base + 1, base + 3, base + 2, base + 2, base + 3, base + 4);
  }
  const g = new THREE.InstancedBufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('aShape', new THREE.Float32BufferAttribute(shape, 2));
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
    blades.set([x, z, r() * Math.PI * 2, height], n * 4);
    tints[n] = THREE.MathUtils.clamp(tint + (r() - 0.5) * 0.3, 0, 1);
    n++;
  };

  // Thick verges: grass bunches up along both edges of every road, where the wheels don't reach.
  const verge = Math.floor(target * 0.12);
  for (const [x1, z1, x2, z2] of roadSegments) {
    const len = Math.hypot(x2 - x1, z2 - z1);
    const nx = -(z2 - z1) / len;
    const nz = (x2 - x1) / len;
    for (let d = 0; d < len && n < verge; d += 0.45) {
      for (const side of [-1, 1]) {
        const off = 2.35 + r() * 0.9;
        const cx = x1 + ((x2 - x1) * d) / len + nx * side * off;
        const cz = z1 + ((z2 - z1) * d) / len + nz * side * off;
        const tint = r();
        for (let k = 0; k < 2 && n < verge; k++) {
          const x = cx + (r() - 0.5) * 0.6;
          const z = cz + (r() - 0.5) * 0.6;
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
    const field = meadowField(cx, cz);
    if (r() > field) continue;
    const tuft = 2 + Math.floor(r() * 3);
    const tint = r();
    for (let k = 0; k < tuft && n < target; k++) {
      const x = cx + (r() - 0.5) * 0.95;
      const z = cz + (r() - 0.5) * 0.95;
      if (!isClear(x, z, 2.3) || textClear.some(([tx, tz, tr]) => Math.hypot(x - tx, z - tz) < tr)) continue;
      // the edge of the road thins out: sparser and shorter next to the dirt, full meadow further away
      const rd = roadDistance(x, z);
      if (rd < 3.6 && r() > (rd - 2.3) / 1.3) continue;
      // taller in lush patches and in open meadow away from the roads
      const open = Math.min(1, Math.max(0, (rd - 3) / 8));
      add(x, z, 0.32 + r() * 0.42 * (0.6 + field * 0.6) + open * 0.18, tint);
    }
  }
  return { blades: blades.subarray(0, n * 4), tints: tints.subarray(0, n), count: n };
}

const vertexHead = /* glsl */ `
uniform float uTime;
uniform float uHeight;
uniform vec2 uWindDir;
uniform float uWindStrength;
uniform vec4 uStamps[${MAX_STAMPS}];
attribute vec4 aBlade; // tuft root x, root z, yaw, height
attribute float aTint;
attribute vec2 aShape; // per blade: height factor, tint shift
varying float vH;
varying float vTint;
`;

const vertexBody = /* glsl */ `
float h = position.y;
vec2 root = aBlade.xy;
float height = aBlade.w * uHeight * aShape.x;
vec2 rot = vec2(cos(aBlade.z), sin(aBlade.z));
vec2 offset = vec2(rot.x * position.x - rot.y * position.z, rot.y * position.x + rot.x * position.z);

vec2 windDir = uWindDir;
float gust = sin(uTime * 0.9 - dot(root, windDir) * 0.22) * 0.5 + 0.5;
float flutter = sin(uTime * 3.1 + aBlade.z * 9.0 + root.x * 1.3) + 0.5 * sin(uTime * 4.7 + root.y * 2.1);
vec2 bend = (windDir * (0.1 + 0.32 * gust * gust) + vec2(-windDir.y, windDir.x) * flutter * 0.05) * uWindStrength;

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
  root.x + offset.x + bend.x * curve * height,
  h * height * (1.0 - 0.45 * b * b * h),
  root.y + offset.y + bend.y * curve * height
);
vH = h;
vTint = clamp(aTint + aShape.y, 0.0, 1.0);
`;

const fragmentHead = /* glsl */ `
varying float vH;
varying float vTint;
`;

// Dark, shaded roots to bright tips; each clump's tint picks between fresh green, deep green and dry straw.
const fragmentColor = /* glsl */ `
vec3 grassBase = mix(vec3(0.07, 0.19, 0.07), vec3(0.15, 0.24, 0.08), vTint);
vec3 fresh = vec3(0.45, 0.7, 0.2);
vec3 deep = vec3(0.25, 0.5, 0.16);
vec3 straw = vec3(0.76, 0.68, 0.28);
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
    const { blades, tints, count } = scatter(coarse ? TUFTS_COARSE : TUFTS_FULL);
    const geometry = tuftGeometry();
    geometry.setAttribute('aBlade', new THREE.InstancedBufferAttribute(blades, 4));
    geometry.setAttribute('aTint', new THREE.InstancedBufferAttribute(tints, 1));
    geometry.instanceCount = count;

    const uniforms = {
      uTime: { value: 0 },
      uHeight: { value: 1 },
      ...windUniforms,
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
