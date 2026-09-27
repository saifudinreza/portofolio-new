import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { BallCollider, RigidBody } from '@react-three/rapier';
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { RIVER_BANK, RIVER_HALF_WIDTH, RIVER_WATER, WORLD_SIZE, bridge, distanceToSegment, inRiver, palette, riverPath, rng, roadSegments, type RiverPoint } from './layout';
import { SEA_LEVEL } from './Atmosphere';
import { actors, type Actor } from './actors';
import { splash } from '../ui/sound';
import { mossyStoneMaterial, rockGeometry } from './stone';
import { useStore, type Tier } from '../store';

const HALF = WORLD_SIZE / 2;
const H = RIVER_HALF_WIDTH;
const MAX_DROPS = 70;
const FLOW_SPEED = 0.9; // m/s, visual only
const REED_CLUSTERS: Record<Tier, number> = { low: 40, medium: 70, high: 90 };
const SUN = new THREE.Vector3(12, 22, 8).normalize();

/** The part of the river on the island, so meshes stop at the cliff edge where the waterfalls start. */
const onIsland = riverPath.filter((p) => Math.max(Math.abs(p.x), Math.abs(p.z)) <= HALF + 0.15);

/** Near the bridge or the road it carries: keep rocks and reeds off it. */
const nearCrossing = (x: number, z: number) =>
  Math.hypot(x - bridge.x, z - bridge.z) < bridge.deckHalf + bridge.ramp + 0.6 || distanceToSegment(x, z, roadSegments[0]) < 2.4;

/** Point `across` metres to the left of the centreline at path point p (negative = right bank). */
const offset = (p: RiverPoint, across: number): [number, number] => [p.x - p.tz * across, p.z + p.tx * across];

/**
 * Strip along the river between two signed offsets, `cols` vertices across. Each vertex carries
 * aRiver = (across in metres, distance along the river) for the shaders; `color` optionally gives RGBA per column.
 */
function ribbon(from: number, to: number, y: number, cols = 2, color?: (col: number) => [number, number, number, number]) {
  const pos: number[] = [];
  const river: number[] = [];
  const colors: number[] = [];
  const index: number[] = [];
  onIsland.forEach((p, i) => {
    for (let c = 0; c < cols; c++) {
      const across = from + ((to - from) * c) / (cols - 1);
      const [x, z] = offset(p, across);
      pos.push(x, y, z);
      river.push(across, p.s);
      if (color) colors.push(...color(c));
      if (i > 0 && c > 0) {
        const a = (i - 1) * cols + c - 1;
        const b = i * cols + c - 1;
        index.push(a, b, a + 1, b, b + 1, a + 1);
      }
    }
  });
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('aRiver', new THREE.Float32BufferAttribute(river, 2));
  if (color) g.setAttribute('color', new THREE.Float32BufferAttribute(colors, 4));
  // Winding depends on which way the offsets run; flip it where needed so every strip faces up (front side).
  const [i0, i1, i2] = index;
  const ax = pos[i1 * 3] - pos[i0 * 3];
  const az = pos[i1 * 3 + 2] - pos[i0 * 3 + 2];
  const bx = pos[i2 * 3] - pos[i0 * 3];
  const bz = pos[i2 * 3 + 2] - pos[i0 * 3 + 2];
  // y of (b - a0) x (c - a0); counter-clockwise seen from above gives a positive y normal
  if (az * bx - ax * bz < 0) for (let k = 0; k < index.length; k += 3) [index[k + 1], index[k + 2]] = [index[k + 2], index[k + 1]];
  g.setIndex(index);
  const normals = new Float32Array(pos.length);
  for (let k = 1; k < normals.length; k += 3) normals[k] = 1;
  g.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
  return g;
}

// ---------- water ----------

const waterVertex = /* glsl */ `
#include <fog_pars_vertex>
attribute vec2 aRiver;
varying vec3 vWorld;
varying vec2 vRiver;
void main() {
  vRiver = aRiver;
  vec4 world = modelMatrix * vec4(position, 1.0);
  vWorld = world.xyz;
  vec4 mvPosition = viewMatrix * world;
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}
`;

const waterFragment = /* glsl */ `
#include <fog_pars_fragment>
uniform float uTime;
uniform float uHalf;
uniform vec3 uShallow;
uniform vec3 uDeep;
uniform vec3 uSky;
uniform vec3 uSun;
varying vec3 vWorld;
varying vec2 vRiver;

// Waves drift downstream: the pattern is laid out in river coordinates (across, along) and scrolls along.
float waterHeight(vec2 r) {
  float a = r.y - uTime * ${FLOW_SPEED.toFixed(2)};
  return sin(a * 2.1 + r.x * 0.9) * 0.012
    + sin(a * 3.7 - r.x * 1.7 + uTime * 0.6) * 0.007
    + sin(a * 7.3 + r.x * 3.1) * 0.003;
}

void main() {
  vec2 r = vRiver;
  float e = 0.03;
  float h = waterHeight(r);
  vec3 n = normalize(vec3(-(waterHeight(r + vec2(e, 0.0)) - h) / e, 1.0, -(waterHeight(r + vec2(0.0, e)) - h) / e));
  vec3 v = normalize(cameraPosition - vWorld);

  float edge = abs(r.x) / uHalf;
  float depth = smoothstep(1.0, 0.2, edge);
  float fresnel = 0.08 + 0.92 * pow(1.0 - max(dot(n, v), 0.0), 4.0);
  vec3 sky = mix(uSky, vec3(1.0), clamp(reflect(-v, n).y, 0.0, 1.0) * 0.4);
  float spec = pow(max(dot(reflect(-uSun, n), v), 0.0), 120.0);

  // current lines: thin streaks that slide downstream, fastest mid-river
  float a = r.y - uTime * ${FLOW_SPEED.toFixed(2)} * (0.6 + 0.6 * depth);
  float streak = smoothstep(0.93, 1.0, sin(a * 1.3 + sin(r.x * 2.3) * 1.5) * sin(r.x * 5.0 + a * 0.4));
  // broken white foam along both banks
  float foam = smoothstep(0.8, 1.0, edge) * (0.55 + 0.45 * sin(r.y * 6.0 - uTime * 3.0 + r.x * 4.0));

  vec3 color = mix(mix(uShallow, uDeep, depth), sky, fresnel * 0.55) + spec * 1.5 + streak * 0.12;
  color = mix(color, vec3(1.0), foam * 0.65);
  float alpha = clamp(mix(0.55, 0.86, depth) + fresnel * 0.25 + spec + foam * 0.5 + streak * 0.1, 0.0, 1.0);
  gl_FragColor = vec4(color, alpha);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
  #include <fog_fragment>
}
`;

function waterMaterial(time: THREE.IUniform) {
  return new THREE.ShaderMaterial({
    vertexShader: waterVertex,
    fragmentShader: waterFragment,
    transparent: true,
    depthWrite: false,
    fog: true,
    uniforms: THREE.UniformsUtils.merge([
      THREE.UniformsLib.fog,
      {
        uTime: time,
        uHalf: { value: H },
        uShallow: { value: new THREE.Color('#72C6B9') },
        uDeep: { value: new THREE.Color('#237482') },
        uSky: { value: new THREE.Color(palette.sky) },
        uSun: { value: SUN },
      },
    ]),
  });
}

/** River bed: sand that darkens toward the middle, with caustics drifting downstream. */
function bedMaterial(time: THREE.IUniform) {
  const material = new THREE.MeshStandardMaterial({ color: '#D9BE8A', roughness: 1 });
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = time;
    shader.vertexShader = 'attribute vec2 aRiver;\nvarying vec2 vRiver;\n' + shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvRiver = aRiver;');
    shader.fragmentShader = 'uniform float uTime;\nvarying vec2 vRiver;\n' + shader.fragmentShader.replace(
      '#include <color_fragment>',
      `#include <color_fragment>
      float mid = smoothstep(${H.toFixed(2)}, 0.3, abs(vRiver.x));
      diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.3, 0.46, 0.44), mid * 0.7);
      vec2 q = vec2(vRiver.x * 2.4, (vRiver.y - uTime * ${(FLOW_SPEED * 0.8).toFixed(2)}) * 2.0);
      float c = sin(q.x + uTime * 0.7 + sin(q.y * 1.3) * 1.5) + sin(q.y * 1.1 + sin(q.x * 1.7 - uTime * 0.5) * 1.5);
      diffuseColor.rgb += pow(1.0 - min(abs(c), 1.0), 6.0) * 0.3 * (0.4 + 0.6 * mid);`,
    );
  };
  return material;
}

// ---------- waterfalls ----------

const fallVertex = /* glsl */ `
#include <fog_pars_vertex>
varying vec2 vUv;
varying vec3 vWorld;
void main() {
  vUv = uv;
  vec4 world = modelMatrix * vec4(position, 1.0);
  vWorld = world.xyz;
  vec4 mvPosition = viewMatrix * world;
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}
`;

const fallFragment = /* glsl */ `
#include <fog_pars_fragment>
uniform float uTime;
varying vec2 vUv;
varying vec3 vWorld;
void main() {
  // falling streaks, a little wobble across, whiter and more broken toward the bottom
  float x = vUv.x * 18.0 + sin(vUv.y * 6.0 + uTime) * 0.4;
  float s = sin(x) * 0.5 + 0.5;
  float fall = fract(vUv.y * 2.2 - uTime * 1.6 + sin(floor(x / 6.2832) * 7.1) * 0.5);
  float streak = smoothstep(0.35, 1.0, s) * (0.6 + 0.4 * smoothstep(0.0, 0.6, fall));
  vec3 color = mix(vec3(0.53, 0.82, 0.78), vec3(1.0), clamp(streak * 0.7 + vUv.y * 0.6, 0.0, 1.0));
  float side = smoothstep(0.0, 0.08, vUv.x) * smoothstep(1.0, 0.92, vUv.x);
  float alpha = side * clamp(0.55 + streak * 0.4, 0.0, 0.95);
  gl_FragColor = vec4(color, alpha);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
  #include <fog_fragment>
}
`;

/** A curtain of water spilling over the cliff edge at a river mouth, bowing outward as it falls. */
function fallGeometry(p: RiverPoint, outward: 1 | -1) {
  const tx = p.tx * outward;
  const tz = p.tz * outward;
  const rows = 10;
  const cols = 8;
  const pos: number[] = [];
  const uv: number[] = [];
  const index: number[] = [];
  const top = RIVER_WATER;
  const bottom = SEA_LEVEL + 0.05;
  for (let r = 0; r <= rows; r++) {
    const t = r / rows;
    const out = 0.2 + 1.5 * Math.sqrt(t);
    const y = top + (bottom - top) * t * t * 0.3 + (bottom - top) * t * 0.7;
    for (let c = 0; c <= cols; c++) {
      const across = -H + (2 * H * c) / cols;
      pos.push(p.x - p.tz * across + tx * out, y, p.z + p.tx * across + tz * out);
      uv.push(c / cols, t);
      if (r > 0 && c > 0) {
        const a = (r - 1) * (cols + 1) + c - 1;
        const b = r * (cols + 1) + c - 1;
        index.push(a, b, a + 1, b, b + 1, a + 1);
      }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(index);
  return g;
}

// ---------- rocks and reeds ----------

/** Reed blades lean and sway from their base; the base (y = 0) stays put. */
function reedMaterial(time: THREE.IUniform) {
  const material = new THREE.MeshStandardMaterial({ roughness: 0.8, side: THREE.DoubleSide });
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = time;
    shader.vertexShader = 'uniform float uTime;\n' + shader.vertexShader.replace(
      '#include <begin_vertex>',
      `#include <begin_vertex>
      vec2 root = vec2(instanceMatrix[3].x, instanceMatrix[3].z);
      float bend = position.y * position.y;
      transformed.x += sin(uTime * 1.6 + root.x * 0.8 + root.y * 0.3) * 0.12 * bend;
      transformed.z += cos(uTime * 1.3 + root.y * 0.7) * 0.08 * bend;`,
    );
  };
  return material;
}

type Drop = { x: number; y: number; z: number; vx: number; vy: number; vz: number; age: number; life: number; size: number };
type Track = { x: number; z: number; inside: boolean };

/** The river: water, bed, banks, pebbles, boulders, reeds, waterfalls at both ends, and splashes. */
export function River() {
  const tier = useStore((s) => s.tier);
  const tracks = useRef(new Map<Actor, Track>());

  const scene = useMemo(() => {
    const r = rng(91);
    const time = { value: 0 };
    const water = new THREE.Mesh(ribbon(-H, H, RIVER_WATER), waterMaterial(time));
    water.renderOrder = 2;
    const bed = new THREE.Mesh(ribbon(-H - 0.2, H + 0.2, 0.011, 7), bedMaterial(time));
    bed.receiveShadow = true;

    // Banks: wet dark sand at the water, dry sand, then fading into the ground with a ragged outer edge.
    const wet = new THREE.Color('#BFA274');
    const dry = new THREE.Color('#E9D5A6');
    const bankMaterial = new THREE.MeshStandardMaterial({ vertexColors: true, transparent: true, depthWrite: false, roughness: 1, polygonOffset: true, polygonOffsetFactor: -1 });
    const bankColor = (c: number): [number, number, number, number] => {
      const col = c === 0 ? wet : dry;
      return [col.r, col.g, col.b, c === 2 ? 0 : 1];
    };
    // both banks in one mesh (and below, both waterfalls and both foam patches): one draw call each
    const bankGeometries = [1, -1].map((side) => {
      // three columns: water line, dry sand, faded edge; the outer column wobbles for a natural edge
      const geom = ribbon(side * (H - 0.3), side * (H + RIVER_BANK), 0.009, 3, bankColor);
      const pos = geom.getAttribute('position');
      const riv = geom.getAttribute('aRiver');
      for (let i = 0; i < pos.count; i++) {
        if (i % 3 !== 2) continue;
        const s = riv.getY(i);
        const wobble = Math.sin(s * 0.9) * 0.35 + Math.sin(s * 2.3 + side) * 0.2;
        const p = onIsland[Math.floor(i / 3)];
        pos.setX(i, pos.getX(i) - p.tz * side * wobble);
        pos.setZ(i, pos.getZ(i) + p.tx * side * wobble);
      }
      return geom;
    });
    const banks = new THREE.Mesh(mergeGeometries(bankGeometries)!, bankMaterial);
    banks.receiveShadow = true;

    // Pebbles along both water lines, boulders a little further up the banks.
    const matrix = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const e = new THREE.Euler();
    const v = new THREE.Vector3();
    const sc = new THREE.Vector3();
    const color = new THREE.Color();
    const place = (across: number) => {
      const p = onIsland[Math.floor(r() * onIsland.length)];
      const side = r() < 0.5 ? 1 : -1;
      const [x, z] = offset(p, side * across);
      return { x, z };
    };
    const pebbles: { x: number; z: number; s: number }[] = [];
    for (let guard = 0; pebbles.length < 240 && guard < 2000; guard++) {
      const { x, z } = place(H - 0.4 + r() * 1.2);
      if (nearCrossing(x, z) || Math.max(Math.abs(x), Math.abs(z)) > HALF - 1) continue;
      pebbles.push({ x, z, s: 0.06 + r() ** 2 * 0.16 });
    }
    const boulders: { x: number; z: number; s: number }[] = [];
    for (let guard = 0; boulders.length < 16 && guard < 2000; guard++) {
      const { x, z } = place(H + 0.2 + r() * 1.1);
      const s = 0.35 + r() * 0.45;
      if (nearCrossing(x, z) || Math.max(Math.abs(x), Math.abs(z)) > HALF - 2 || boulders.some((b) => Math.hypot(b.x - x, b.z - z) < 3)) continue;
      boulders.push({ x, z, s });
    }
    const stone = mossyStoneMaterial();
    const pebbleMesh = new THREE.InstancedMesh(rockGeometry(1, 1), stone, pebbles.length);
    pebbles.forEach((k, i) => {
      pebbleMesh.setMatrixAt(i, matrix.compose(v.set(k.x, k.s * 0.2, k.z), q.setFromEuler(e.set(0, r() * 6.3, 0)), sc.set(k.s * (1 + r() * 0.5), k.s * 0.55, k.s)));
      pebbleMesh.setColorAt(i, color.set(r() < 0.3 ? '#C9BBA2' : palette.rock).offsetHSL(0, 0, (r() - 0.5) * 0.14));
    });
    pebbleMesh.receiveShadow = true;
    const boulderMesh = new THREE.InstancedMesh(rockGeometry(4), stone, boulders.length);
    boulders.forEach((k, i) => {
      boulderMesh.setMatrixAt(i, matrix.compose(v.set(k.x, k.s * 0.35, k.z), q.setFromEuler(e.set((r() - 0.5) * 0.3, r() * 6.3, (r() - 0.5) * 0.3)), sc.set(k.s * 1.2, k.s * 0.8, k.s)));
      boulderMesh.setColorAt(i, color.set(palette.rock).offsetHSL(0, 0, (r() - 0.5) * 0.12));
    });
    boulderMesh.castShadow = boulderMesh.receiveShadow = true;

    // Reeds and tall grass in clumps along the water's edge; greens with some dry straw blades.
    const clumps: { x: number; z: number }[] = [];
    for (let guard = 0; clumps.length < REED_CLUSTERS.high && guard < 3000; guard++) {
      const { x, z } = place(H - 0.2 + r() * 1.3);
      if (nearCrossing(x, z) || Math.max(Math.abs(x), Math.abs(z)) > HALF - 1) continue;
      clumps.push({ x, z });
    }
    const blade = new THREE.ConeGeometry(0.035, 1, 3, 4).translate(0, 0.5, 0);
    const blades: { m: THREE.Matrix4; c: THREE.Color; clump: number }[] = [];
    clumps.forEach((k, ci) => {
      const n = 5 + Math.floor(r() * 6);
      for (let b = 0; b < n; b++) {
        const a = r() * Math.PI * 2;
        const d = r() * 0.35;
        const h = 0.55 + r() * 0.75;
        blades.push({
          m: new THREE.Matrix4().compose(v.set(k.x + Math.cos(a) * d, 0, k.z + Math.sin(a) * d), q.setFromEuler(e.set((r() - 0.5) * 0.5, r() * 6.3, (r() - 0.5) * 0.5)), sc.set(1, h, 1)),
          c: new THREE.Color(r() < 0.22 ? '#CDB46A' : r() < 0.5 ? '#7E9A4C' : '#5E8A3E').offsetHSL((r() - 0.5) * 0.03, 0, (r() - 0.5) * 0.1),
          clump: ci,
        });
      }
    });
    const reedMesh = new THREE.InstancedMesh(blade, reedMaterial(time), blades.length);
    blades.forEach((b, i) => {
      reedMesh.setMatrixAt(i, b.m);
      reedMesh.setColorAt(i, b.c);
    });
    reedMesh.castShadow = true;
    const bladesPerClump = blades.map((b) => b.clump);

    // Waterfalls where the river leaves the island at each end.
    const fallMaterial = new THREE.ShaderMaterial({
      vertexShader: fallVertex,
      fragmentShader: fallFragment,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      fog: true,
      uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uTime: time }]),
    });
    // the path runs from the north mouth to the east mouth, so "outward" is upstream at the start, downstream at the end
    const mouths: [RiverPoint, 1 | -1][] = [[onIsland[0], -1], [onIsland[onIsland.length - 1], 1]];
    const falls = new THREE.Mesh(mergeGeometries(mouths.map(([p, out]) => fallGeometry(p, out)))!, fallMaterial);
    // foam where each fall hits the sea
    const foamMaterial = new THREE.MeshBasicMaterial({ color: '#FFFDF7', transparent: true, opacity: 0.4, depthWrite: false });
    const foams = new THREE.Mesh(
      mergeGeometries(mouths.map(([p, out]) => new THREE.CircleGeometry(1, 20).rotateX(-Math.PI / 2).scale(H * 1.1, 1, H * 1.1).translate(p.x + p.tx * out * 1.9, SEA_LEVEL + 0.12, p.z + p.tz * out * 1.9)))!,
      foamMaterial,
    );

    // Splash droplets.
    const dropMesh = new THREE.InstancedMesh(
      new THREE.IcosahedronGeometry(1, 0),
      new THREE.MeshStandardMaterial({ color: '#E4F6F4', roughness: 0.2, transparent: true, opacity: 0.85 }),
      MAX_DROPS,
    );
    dropMesh.frustumCulled = false;
    const hidden = new THREE.Matrix4().makeScale(0, 0, 0);
    for (let i = 0; i < MAX_DROPS; i++) dropMesh.setMatrixAt(i, hidden);
    const drops: (Drop | null)[] = Array(MAX_DROPS).fill(null);

    return { time, water, bed, banks, pebbleMesh, boulders, boulderMesh, reedMesh, bladesPerClump, falls, foams, dropMesh, drops };
  }, []);

  // Fewer reed clumps on lower tiers: the blades are ordered by clump, so draw a prefix.
  useEffect(() => {
    const keep = REED_CLUSTERS[tier];
    const count = scene.bladesPerClump.findIndex((c) => c >= keep);
    scene.reedMesh.count = count === -1 ? scene.bladesPerClump.length : count;
  }, [scene, tier]);

  const tmp = useMemo(() => ({ m: new THREE.Matrix4(), q: new THREE.Quaternion(), p: new THREE.Vector3(), s: new THREE.Vector3() }), []);

  const spray = (x: number, z: number, vx: number, vz: number, count: number) => {
    const { drops } = scene;
    for (let i = 0; i < MAX_DROPS && count > 0; i++) {
      if (drops[i]) continue;
      count--;
      const a = Math.random() * Math.PI * 2;
      const out = 1 + Math.random() * 1.5;
      drops[i] = {
        x: x + Math.cos(a) * 0.7,
        y: RIVER_WATER,
        z: z + Math.sin(a) * 0.7,
        vx: vx * 0.3 + Math.cos(a) * out,
        vy: 2 + Math.random() * 2.5,
        vz: vz * 0.3 + Math.sin(a) * out,
        age: 0,
        life: 0.6 + Math.random() * 0.5,
        size: 0.04 + Math.random() * 0.05,
      };
    }
  };

  useFrame(({ clock }, rawDt) => {
    const dt = Math.min(rawDt, 1 / 30);
    scene.time.value = clock.elapsedTime;
    const { m, q, p, s } = tmp;

    // Splash and spray when something drives or walks into the water, a trickle of spray while wading.
    for (const a of actors) {
      let t = tracks.current.get(a);
      if (!t) {
        t = { x: a.x, z: a.z, inside: false };
        tracks.current.set(a, t);
      }
      const vx = (a.x - t.x) / Math.max(rawDt, 1e-3);
      const vz = (a.z - t.z) / Math.max(rawDt, 1e-3);
      const speed = Math.hypot(vx, vz);
      t.x = a.x;
      t.z = a.z;
      const inside = a.radius > 0 && inRiver(a.x, a.z);
      if (inside && !t.inside && speed > 1.5) {
        splash(Math.min(speed / 12, 1), { x: a.x, y: RIVER_WATER, z: a.z });
        spray(a.x, a.z, vx, vz, 10 + Math.floor(speed * 2));
      } else if (inside && speed > 1) {
        spray(a.x, a.z, vx, vz, Math.random() < speed * dt * 4 ? 2 : 0);
      }
      t.inside = inside;
    }

    let anyDrop = false;
    scene.drops.forEach((d, i) => {
      if (!d) return;
      anyDrop = true;
      d.age += dt;
      d.vy -= 9.8 * dt;
      d.x += d.vx * dt;
      d.y += d.vy * dt;
      d.z += d.vz * dt;
      if (d.age > d.life || (d.vy < 0 && d.y < RIVER_WATER)) {
        scene.drops[i] = null;
        scene.dropMesh.setMatrixAt(i, m.makeScale(0, 0, 0));
        return;
      }
      scene.dropMesh.setMatrixAt(i, m.compose(p.set(d.x, d.y, d.z), q.identity(), s.setScalar(d.size * (1 - (d.age / d.life) * 0.5))));
    });
    if (anyDrop) scene.dropMesh.instanceMatrix.needsUpdate = true;
  });

  return (
    <group>
      {/* boulders are solid; pebbles and reeds are just looks */}
      <RigidBody type="fixed" colliders={false} userData={{ material: 'stone' }}>
        {scene.boulders.map((b, i) => (
          <BallCollider key={i} args={[b.s * 0.9]} position={[b.x, b.s * 0.3, b.z]} />
        ))}
      </RigidBody>
      <primitive object={scene.bed} />
      <primitive object={scene.banks} />
      <primitive object={scene.water} />
      <primitive object={scene.pebbleMesh} />
      <primitive object={scene.boulderMesh} />
      <primitive object={scene.reedMesh} />
      <primitive object={scene.falls} />
      <primitive object={scene.foams} />
      <primitive object={scene.dropMesh} />
    </group>
  );
}
