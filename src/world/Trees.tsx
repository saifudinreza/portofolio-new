import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { CylinderCollider, RigidBody } from '@react-three/rapier';
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { WORLD_SIZE, distanceToSegment, isClear, palette, pondDistance, rng, trails } from './layout';
import { actors, type Actor } from './actors';
import { carState } from './carState';
import { barkMap, leafClusterMap, needleMap, singleLeafMap } from './textures';
import { useStore, type Tier } from '../store';

const HALF = WORLD_SIZE / 2;
const TREE_HEIGHT = 3.6;
const STIFFNESS = 30;
const DAMPING = 1.6;
const PUSH = 1.5;
const MAX_LEAN = 0.45;
const HIT_SPEED = 4;
const MAX_LEAVES = 140;
/** Seconds between leaves drifting down from some tree near the car, per quality tier. */
const AMBIENT_LEAF_EVERY: Record<Tier, number> = { low: 0.9, medium: 0.4, high: 0.22 };
/** Share of leaf cards drawn per tier; the solid core behind them keeps a thinner canopy looking full. */
const CARD_SHARE: Record<Tier, number> = { low: 0.6, medium: 0.85, high: 1 };

type Tree = { x: number; z: number; s: number; kind: number; slot: number; ox: number; oz: number; vx: number; vz: number; hitAt: number };
type Leaf = { x: number; y: number; z: number; vx: number; vy: number; vz: number; spin: number; seed: number; age: number; life: number };

// ---------- shapes ----------

type Blob = { c: [number, number, number]; r: number; squash?: number };
type Kind = {
  name: string;
  weight: number;
  /** trunk height, bottom and top radius, and branches as [height on trunk, yaw, tilt, length] */
  trunk: { h: number; r0: number; r1: number; lean: number; branches: [number, number, number, number][] };
  canopy: { blobs: Blob[]; cards: number; size: number } | { tiers: number; bottom: number; top: number; radius: number; cards: number; size: number };
  /** leaf colours picked per card; the instance colour only nudges lightness per tree */
  colors: string[];
  bark: string;
  texture: 'leaves' | 'needles';
  /** height the ambient leaves fall from, and whether this kind drops any */
  leafY: number;
  sheds: boolean;
};

const kinds: Kind[] = [
  {
    name: 'oak',
    weight: 0.3,
    trunk: { h: 1.9, r0: 0.2, r1: 0.12, lean: 0.06, branches: [[1.3, 0.4, 0.8, 0.9], [1.5, 2.6, 0.9, 0.8], [1.7, 4.4, 0.7, 0.7]] },
    canopy: { blobs: [{ c: [0, 2.55, 0], r: 1.15 }, { c: [0.75, 2.25, 0.3], r: 0.8 }, { c: [-0.65, 2.3, -0.4], r: 0.85 }, { c: [0.1, 3.15, -0.1], r: 0.75 }, { c: [-0.2, 2.2, 0.7], r: 0.7 }], cards: 250, size: 0.82 },
    colors: ['#5E9E50', '#6BAA5C', '#4E8C47', '#7DB865'],
    bark: '#8A6242',
    texture: 'leaves',
    leafY: 2.4,
    sheds: true,
  },
  {
    name: 'autumn',
    weight: 0.2,
    trunk: { h: 1.7, r0: 0.18, r1: 0.11, lean: 0.08, branches: [[1.2, 1.1, 0.85, 0.8], [1.45, 3.9, 0.8, 0.75]] },
    canopy: { blobs: [{ c: [0, 2.4, 0], r: 1.1 }, { c: [0.55, 2.95, 0.2], r: 0.72 }, { c: [-0.55, 2.15, 0.4], r: 0.78 }, { c: [0.45, 2.0, -0.55], r: 0.7 }], cards: 220, size: 0.8 },
    colors: ['#F5B83D', '#E9A93A', '#E8873A', '#F2C94C', '#D9722F'],
    bark: '#7A5639',
    texture: 'leaves',
    leafY: 2.3,
    sheds: true,
  },
  {
    name: 'sakura',
    weight: 0.15,
    trunk: { h: 1.6, r0: 0.17, r1: 0.1, lean: 0.12, branches: [[1.1, 0.2, 1.0, 1.0], [1.3, 2.3, 1.05, 0.95], [1.45, 4.3, 0.95, 0.85]] },
    canopy: { blobs: [{ c: [0, 2.35, 0], r: 1.25, squash: 0.72 }, { c: [0.85, 2.15, 0.1], r: 0.8, squash: 0.8 }, { c: [-0.75, 2.2, 0.35], r: 0.82, squash: 0.8 }, { c: [0.1, 2.25, -0.8], r: 0.75, squash: 0.8 }], cards: 240, size: 0.76 },
    colors: ['#F4A6B8', '#F7C3CF', '#F18FA8', '#FCE1E7'],
    bark: '#5E4034',
    texture: 'leaves',
    leafY: 2.2,
    sheds: true,
  },
  {
    name: 'pine',
    weight: 0.2,
    trunk: { h: 3.4, r0: 0.18, r1: 0.06, lean: 0.02, branches: [] },
    canopy: { tiers: 5, bottom: 0.9, top: 3.9, radius: 1.25, cards: 230, size: 0.72 },
    colors: ['#3F7A45', '#4E8C47', '#356B3C', '#5A9A52'],
    bark: '#6E4B33',
    texture: 'needles',
    leafY: 0,
    sheds: false,
  },
  {
    name: 'bush',
    weight: 0.15,
    trunk: { h: 0.35, r0: 0.08, r1: 0.05, lean: 0, branches: [] },
    canopy: { blobs: [{ c: [0, 0.6, 0], r: 0.78 }, { c: [0.55, 0.48, 0.2], r: 0.55 }, { c: [-0.5, 0.5, -0.2], r: 0.58 }, { c: [0.05, 0.45, 0.6], r: 0.5 }], cards: 110, size: 0.66 },
    colors: ['#4E8C47', '#5E9E50', '#6BAA5C'],
    bark: palette.woodDark,
    texture: 'leaves',
    leafY: 0,
    sheds: false,
  },
];

/** Tapered, slightly bent trunk plus a few branches reaching up into the canopy. */
function trunkGeometry(k: Kind) {
  const { h, r0, r1, lean, branches } = k.trunk;
  const main = new THREE.CylinderGeometry(r1, r0, h, 9, 6).translate(0, h / 2, 0);
  const p = main.getAttribute('position');
  for (let i = 0; i < p.count; i++) {
    const y = p.getY(i);
    // gentle S-bend and a flared root
    p.setX(i, p.getX(i) + Math.sin((y / h) * Math.PI) * lean);
    const flare = 1 + Math.max(0, 0.35 - y) * 1.6;
    p.setX(i, p.getX(i) * (y < 0.35 ? flare : 1));
    p.setZ(i, p.getZ(i) * (y < 0.35 ? flare : 1));
  }
  main.computeVertexNormals();
  const parts: THREE.BufferGeometry[] = [main];
  for (const [at, yaw, tilt, len] of branches) {
    const b = new THREE.CylinderGeometry(r1 * 0.45, r1 * 0.8, len, 6, 1).translate(0, len / 2, 0);
    b.applyMatrix4(new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(tilt, yaw, 0, 'YXZ')));
    b.translate(Math.sin((at / h) * Math.PI) * lean, at, 0);
    parts.push(b);
  }
  return mergeGeometries(parts)!;
}

/**
 * Canopy of leaf cards: small alpha-tested quads scattered through a few overlapping volumes. Each vertex's
 * normal points out from its volume's centre, so the canopy shades like one soft rounded mass instead of a
 * spiky mess of flat cards. Vertex colours carry the leaf hue and a little baked occlusion (darker deep inside
 * and underneath).
 */
function canopyGeometry(k: Kind, seed: number) {
  const r = rng(seed);
  const pos: number[] = [];
  const nor: number[] = [];
  const uv: number[] = [];
  const col: number[] = [];
  const index: number[] = [];
  const colors = k.colors.map((c) => new THREE.Color(c));
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  const v = new THREE.Vector3();
  const n = new THREE.Vector3();
  const corners = [[-0.5, -0.5, 0, 0], [0.5, -0.5, 1, 0], [0.5, 0.5, 1, 1], [-0.5, 0.5, 0, 1]];

  const card = (x: number, y: number, z: number, centre: THREE.Vector3, radius: number, size: number, faceOut?: THREE.Vector3) => {
    if (faceOut) q.setFromUnitVectors(new THREE.Vector3(0, 0, 1), faceOut).multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), r() * Math.PI * 2));
    else q.setFromEuler(e.set(r() * Math.PI * 2, r() * Math.PI * 2, r() * Math.PI * 2));
    const base = pos.length / 3;
    const c = colors[Math.floor(r() * colors.length)];
    for (const [cx, cy, u, w] of corners) {
      v.set(cx * size, cy * size, 0).applyQuaternion(q).add(new THREE.Vector3(x, y, z));
      pos.push(v.x, v.y, v.z);
      n.copy(v).sub(centre).normalize().lerp(new THREE.Vector3(0, 1, 0), 0.25).normalize();
      nor.push(n.x, n.y, n.z);
      uv.push(u, w);
      // occlusion: deeper and lower in the volume is darker
      const out = Math.min(v.distanceTo(centre) / radius, 1.2);
      const up = THREE.MathUtils.clamp((v.y - centre.y) / radius, -1, 1);
      const ao = 0.55 + 0.3 * out + 0.15 * up;
      col.push(c.r * ao, c.g * ao, c.b * ao);
    }
    index.push(base, base + 1, base + 2, base, base + 2, base + 3);
  };

  const cv = k.canopy;
  if ('blobs' in cv) {
    const total = cv.blobs.reduce((a, b) => a + b.r ** 2, 0);
    for (const b of cv.blobs) {
      const centre = new THREE.Vector3(...b.c);
      const count = Math.round((cv.cards * b.r ** 2) / total);
      for (let i = 0; i < count; i++) {
        // mostly near the surface (that's what the camera sees), biased upward
        const dir = new THREE.Vector3(r() * 2 - 1, r() * 1.6 - 0.5, r() * 2 - 1).normalize();
        const d = b.r * (0.5 + 0.5 * Math.sqrt(r()));
        card(centre.x + dir.x * d, centre.y + dir.y * d * (b.squash ?? 1), centre.z + dir.z * d, centre, b.r, cv.size * (0.8 + r() * 0.45));
      }
    }
  } else {
    // pine: stacked cones of needle sprigs pointing outward and a little down
    for (let t = 0; t < cv.tiers; t++) {
      const f = t / (cv.tiers - 1);
      const y0 = cv.bottom + (cv.top - cv.bottom) * f * 0.85;
      const radius = cv.radius * (1 - f * 0.75);
      const tierH = ((cv.top - cv.bottom) / cv.tiers) * 1.5;
      const centre = new THREE.Vector3(0, y0 + tierH * 0.3, 0);
      const count = Math.round((cv.cards / cv.tiers) * (1.3 - f * 0.6));
      for (let i = 0; i < count; i++) {
        const a = r() * Math.PI * 2;
        const along = r();
        const rad = radius * (0.35 + 0.65 * along);
        const y = y0 + tierH * (1 - along) * 0.9;
        // sprigs lie close along the cone's slope so the silhouette stays neat, not hairy
        const out = new THREE.Vector3(Math.cos(a), 0.9 + r() * 0.3, Math.sin(a)).normalize();
        card(Math.cos(a) * rad, y, Math.sin(a) * rad, centre, radius, cv.size * (0.7 + r() * 0.4) * (1 - f * 0.35), out);
      }
    }
    // a tuft on top
    for (let i = 0; i < 6; i++) card((r() - 0.5) * 0.15, cv.top + r() * 0.2, (r() - 0.5) * 0.15, new THREE.Vector3(0, cv.top - 0.3, 0), 0.4, cv.size * 0.5);
  }

  // Shuffle the cards, so drawing only the first part of the index (lower tiers) thins the canopy evenly.
  const cards = index.length / 6;
  for (let i = cards - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    for (let k = 0; k < 6; k++) [index[i * 6 + k], index[j * 6 + k]] = [index[j * 6 + k], index[i * 6 + k]];
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(index);
  return g;
}

/** Draw only a tier's share of a shuffled card canopy. */
export function setCardShare(g: THREE.BufferGeometry, tier: Tier) {
  const cards = g.getIndex()!.count / 6;
  g.setDrawRange(0, Math.round(cards * CARD_SHARE[tier]) * 6);
}

/**
 * Solid, smooth inner volumes in a deep shade of the leaf colour. Seen through the gaps between cards they read as
 * dense foliage in shadow instead of letting the ground show through, and they give the canopy a solid shadow.
 */
function coreGeometry(k: Kind) {
  const deep = k.colors.map((c) => new THREE.Color(c)).reduce((a, c) => (c.getHSL({ h: 0, s: 0, l: 0 }).l < a.getHSL({ h: 0, s: 0, l: 0 }).l ? c : a));
  const parts: THREE.BufferGeometry[] = [];
  const cv = k.canopy;
  if ('blobs' in cv) {
    for (const b of cv.blobs) parts.push(new THREE.IcosahedronGeometry(b.r * 0.8, 1).scale(1, b.squash ?? 1, 1).translate(...b.c));
  } else {
    for (let t = 0; t < cv.tiers; t++) {
      const f = t / (cv.tiers - 1);
      const y0 = cv.bottom + (cv.top - cv.bottom) * f * 0.85;
      const radius = cv.radius * (1 - f * 0.75);
      const tierH = ((cv.top - cv.bottom) / cv.tiers) * 1.5;
      parts.push(new THREE.ConeGeometry(radius * 0.92, tierH, 10, 1).translate(0, y0 + tierH / 2, 0));
    }
  }
  const g = mergeGeometries(parts.map((p) => p.toNonIndexed()))!;
  const p = g.getAttribute('position');
  const col: number[] = [];
  let minY = Infinity;
  let maxY = -Infinity;
  for (let i = 0; i < p.count; i++) {
    minY = Math.min(minY, p.getY(i));
    maxY = Math.max(maxY, p.getY(i));
  }
  for (let i = 0; i < p.count; i++) {
    // darker underneath, like the shade inside a real canopy
    const f = 0.45 + 0.35 * ((p.getY(i) - minY) / (maxY - minY || 1));
    col.push(deep.r * f, deep.g * f, deep.b * f);
  }
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  return g;
}

/** A static leaf-card shrub (cards + solid core) for undergrowth elsewhere in the world. */
export function shrubParts() {
  const kind = kinds[kinds.length - 1];
  const map = leafClusterMap();
  return {
    cards: canopyGeometry(kind, 404),
    core: coreGeometry(kind),
    cardMaterial: new THREE.MeshStandardMaterial({ map, alphaTest: 0.5, side: THREE.DoubleSide, vertexColors: true, roughness: 0.85 }),
    coreMaterial: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95 }),
  };
}

// ---------- sway ----------

const vertexHead = /* glsl */ `
uniform float uTime;
uniform vec2 uWindDir;
attribute vec4 aTree; // spring lean x, z, wind phase, unused
`;

// Lean grows with height (roots stay put), then is rotated back into the instance's local frame.
// Leaf cards also flutter a little on their own.
const vertexBody = /* glsl */ `
vec3 transformed = vec3(position);
#ifdef LEAF_FLUTTER
transformed += vec3(
  sin(uTime * 2.3 + position.x * 3.1 + position.z * 2.3 + aTree.z),
  sin(uTime * 2.9 + position.y * 3.7 + aTree.z) * 0.6,
  cos(uTime * 2.1 + position.z * 2.9 + position.y * 1.7)
) * 0.025;
#endif
#ifdef USE_INSTANCING
vec2 treePos = instanceMatrix[3].xz;
float gust = sin(uTime * 0.7 - dot(treePos, uWindDir) * 0.15) * 0.5 + 0.5;
vec2 lean = uWindDir * (0.03 + 0.06 * gust * gust)
  + vec2(sin(uTime * 1.3 + aTree.z), sin(uTime * 1.7 + aTree.z * 1.9)) * 0.02
  + aTree.xy;
float k = max(position.y - 0.2, 0.0) / ${TREE_HEIGHT.toFixed(1)};
k *= k;
float s = max(length(instanceMatrix[0].xyz), 1e-4);
vec3 offset = vec3(lean.x, 0.0, lean.y) * k * ${TREE_HEIGHT.toFixed(1)};
transformed += transpose(mat3(instanceMatrix)) * offset / (s * s);
transformed.y -= dot(lean, lean) * k * ${(TREE_HEIGHT / 2).toFixed(1)};
#endif
`;

function swayMaterial<T extends THREE.Material>(material: T, uniforms: Record<string, THREE.IUniform>, flutter = false) {
  if (flutter) material.defines = { ...material.defines, LEAF_FLUTTER: '' };
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = vertexHead + shader.vertexShader.replace('#include <begin_vertex>', vertexBody);
  };
  return material;
}

function pickKind(v: number) {
  let acc = 0;
  for (let i = 0; i < kinds.length; i++) {
    acc += kinds[i].weight;
    if (v < acc) return i;
  }
  return 0;
}

function layout() {
  const r = rng(7);
  const out: Tree[] = [];
  let guard = 0;
  while (out.length < 70 && guard++ < 3000) {
    const x = (r() * 2 - 1) * (HALF - 3);
    const z = (r() * 2 - 1) * (HALF - 3);
    // extra room around the pond so canopies don't overhang the rim
    if (!isClear(x, z) || pondDistance(x, z) < 1.6 || trails.some((seg) => distanceToSegment(x, z, seg) < 2)) continue;
    if (out.some((t) => Math.hypot(t.x - x, t.z - z) < 3.2)) continue;
    out.push({ x, z, s: 0.8 + r() * 0.5, kind: pickKind(r()), slot: 0, ox: 0, oz: 0, vx: 0, vz: 0, hitAt: -Infinity });
  }
  return out;
}

/** Trees and big shrubs in five kinds, swaying in the wind and when something brushes or hits them. */
export function Trees() {
  const velocities = useRef(new Map<Actor, { x: number; z: number; vx: number; vz: number }>());
  const tier = useStore((s) => s.tier);
  const ambient = useRef(0);

  const { trees, meshes, attrs, uniforms, leaves, leafMesh } = useMemo(() => {
    const trees = layout();
    const r = rng(11);
    const uniforms = { uTime: { value: 0 }, uWindDir: { value: new THREE.Vector2(0.89, 0.45) } };
    const leafTex = leafClusterMap();
    const needleTex = needleMap();
    const bark = barkMap();
    const trunkDepth = swayMaterial(new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking }), uniforms);

    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const up = new THREE.Vector3(0, 1, 0);
    const color = new THREE.Color();

    const meshes: THREE.InstancedMesh[] = [];
    const attrs: THREE.InstancedBufferAttribute[] = [];
    kinds.forEach((kind, ki) => {
      const mine = trees.filter((t) => t.kind === ki);
      mine.forEach((t, i) => (t.slot = i));
      const data = new Float32Array(Math.max(mine.length, 1) * 4);
      mine.forEach((_, i) => (data[i * 4 + 2] = r() * Math.PI * 2));
      const attr = new THREE.InstancedBufferAttribute(data, 4).setUsage(THREE.DynamicDrawUsage);
      attrs.push(attr);
      if (!mine.length) return;

      const map = kind.texture === 'needles' ? needleTex : leafTex;
      const trunkGeo = trunkGeometry(kind);
      const canopyGeo = canopyGeometry(kind, 100 + ki);
      const coreGeo = coreGeometry(kind);
      trunkGeo.setAttribute('aTree', attr);
      canopyGeo.setAttribute('aTree', attr);
      coreGeo.setAttribute('aTree', attr);
      const core = new THREE.InstancedMesh(coreGeo, swayMaterial(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95 }), uniforms), mine.length);
      core.customDepthMaterial = trunkDepth;
      core.castShadow = core.receiveShadow = true;
      const trunk = new THREE.InstancedMesh(trunkGeo, swayMaterial(new THREE.MeshStandardMaterial({ color: kind.bark, map: bark, roughness: 0.95 }), uniforms), mine.length);
      const canopy = new THREE.InstancedMesh(
        canopyGeo,
        swayMaterial(new THREE.MeshStandardMaterial({ map, alphaTest: 0.5, side: THREE.DoubleSide, vertexColors: true, roughness: 0.85 }), uniforms, true),
        mine.length,
      );
      trunk.customDepthMaterial = trunkDepth;
      // the solid core casts the canopy's shadow; re-rendering every alpha-tested card into the shadow map
      // cost about a sixth of the frame on High for a shadow that looks the same
      trunk.castShadow = true;
      canopy.castShadow = false;
      trunk.receiveShadow = canopy.receiveShadow = true;
      mine.forEach((t, i) => {
        m.compose(new THREE.Vector3(t.x, 0, t.z), q.setFromAxisAngle(up, r() * Math.PI * 2), new THREE.Vector3().setScalar(t.s));
        trunk.setMatrixAt(i, m);
        canopy.setMatrixAt(i, m);
        core.setMatrixAt(i, m);
        // per-tree lightness nudge so neighbours of the same kind don't look cloned
        const l = 0.9 + r() * 0.18;
        canopy.setColorAt(i, color.setRGB(l, l, l));
        core.setColorAt(i, color);
        trunk.setColorAt(i, color.setRGB(l, l, l));
      });
      trunk.computeBoundingSphere();
      canopy.computeBoundingSphere();
      core.computeBoundingSphere();
      meshes.push(trunk, core, canopy);
    });

    const leafMesh = new THREE.InstancedMesh(
      new THREE.PlaneGeometry(0.2, 0.2),
      new THREE.MeshStandardMaterial({ side: THREE.DoubleSide, roughness: 0.9, map: singleLeafMap(), alphaTest: 0.5 }),
      MAX_LEAVES,
    );
    leafMesh.frustumCulled = false;
    leafMesh.castShadow = true;
    const hidden = new THREE.Matrix4().makeScale(0, 0, 0);
    for (let i = 0; i < MAX_LEAVES; i++) {
      leafMesh.setMatrixAt(i, hidden);
      leafMesh.setColorAt(i, new THREE.Color());
    }
    const leaves: (Leaf | null)[] = Array(MAX_LEAVES).fill(null);
    return { trees, meshes, attrs, uniforms, leaves, leafMesh };
  }, []);

  useEffect(() => {
    for (const m of meshes) if ((m.material as THREE.MeshStandardMaterial).alphaTest > 0) setCardShare(m.geometry, tier);
  }, [meshes, tier]);

  const dropLeaf = (t: Tree, vx: number, vy: number, vz: number, y: number, life: number) => {
    const i = leaves.indexOf(null);
    if (i < 0) return;
    const a = Math.random() * Math.PI * 2;
    const rad = Math.random() * 0.9 * t.s;
    leaves[i] = {
      x: t.x + Math.cos(a) * rad,
      y,
      z: t.z + Math.sin(a) * rad,
      vx,
      vy,
      vz,
      spin: Math.random() * Math.PI * 2,
      seed: Math.random() * 10,
      age: 0,
      life,
    };
    const k = kinds[t.kind];
    leafMesh.setColorAt(i, new THREE.Color(k.colors[Math.floor(Math.random() * k.colors.length)]));
    leafMesh.instanceColor!.needsUpdate = true;
  };

  const spawnLeaves = (t: Tree, dirX: number, dirZ: number, speed: number) => {
    const k = kinds[t.kind];
    for (let n = 3 + Math.floor(speed / 3); n > 0; n--) {
      const vx = dirX * speed * 0.08 + (Math.random() - 0.5) * 1.5;
      const vz = dirZ * speed * 0.08 + (Math.random() - 0.5) * 1.5;
      dropLeaf(t, vx, 0.5 + Math.random() * 1.5, vz, (Math.max(k.leafY, 0.8) + Math.random()) * t.s, 4 + Math.random() * 2);
    }
  };

  const tmp = useMemo(() => ({ m: new THREE.Matrix4(), q: new THREE.Quaternion(), e: new THREE.Euler(), p: new THREE.Vector3(), s: new THREE.Vector3() }), []);

  useFrame(({ clock }, rawDt) => {
    const dt = Math.min(rawDt, 1 / 30);
    const now = clock.elapsedTime;
    uniforms.uTime.value = now;

    // Actor velocity from position deltas; `prev` is last frame's, still valid on the frame a car stops against a trunk.
    const moving: { a: Actor; vx: number; vz: number; pvx: number; pvz: number }[] = [];
    for (const a of actors) {
      const v = velocities.current.get(a);
      if (!v) {
        velocities.current.set(a, { x: a.x, z: a.z, vx: 0, vz: 0 });
        continue;
      }
      const vx = (a.x - v.x) / Math.max(rawDt, 1e-3);
      const vz = (a.z - v.z) / Math.max(rawDt, 1e-3);
      if (a.radius > 0) moving.push({ a, vx, vz, pvx: v.vx, pvz: v.vz });
      Object.assign(v, { x: a.x, z: a.z, vx, vz });
    }

    const dirty = new Set<number>();
    trees.forEach((t) => {
      const k = STIFFNESS / t.s;
      let ax = -k * t.ox - DAMPING * t.vx;
      let az = -k * t.oz - DAMPING * t.vz;
      for (const { a, vx, vz, pvx, pvz } of moving) {
        const dx = t.x - a.x;
        const dz = t.z - a.z;
        const d = Math.hypot(dx, dz);
        const range = 1.6 * t.s + a.radius;
        if (d > range) continue;
        const f = (1 - d / range) ** 2;
        ax += vx * f * PUSH;
        az += vz * f * PUSH;

        const speed = Math.hypot(pvx, pvz);
        if (d < 0.3 * t.s + 1.1 && speed > HIT_SPEED && now - t.hitAt > 0.6) {
          t.hitAt = now;
          const kick = (Math.min(speed / 12, 1) * 2.2) / speed;
          t.vx += pvx * kick;
          t.vz += pvz * kick;
          spawnLeaves(t, pvx / speed, pvz / speed, speed);
        }
      }
      t.vx += ax * dt;
      t.vz += az * dt;
      t.ox += t.vx * dt;
      t.oz += t.vz * dt;
      const lean = Math.hypot(t.ox, t.oz);
      if (lean > MAX_LEAN) {
        t.ox *= MAX_LEAN / lean;
        t.oz *= MAX_LEAN / lean;
      }
      const data = attrs[t.kind].array as Float32Array;
      if (data[t.slot * 4] !== t.ox || data[t.slot * 4 + 1] !== t.oz) {
        data[t.slot * 4] = t.ox;
        data[t.slot * 4 + 1] = t.oz;
        dirty.add(t.kind);
      }
    });
    for (const k of dirty) attrs[k].needsUpdate = true;

    // Now and then a leaf lets go from a tree near the car and drifts down on the wind.
    ambient.current += dt;
    if (ambient.current > AMBIENT_LEAF_EVERY[tier]) {
      ambient.current = 0;
      const t = trees[Math.floor(Math.random() * trees.length)];
      if (kinds[t.kind].sheds && Math.hypot(t.x - carState.x, t.z - carState.z) < 26) {
        dropLeaf(t, uniforms.uWindDir.value.x * 0.6, 0, uniforms.uWindDir.value.y * 0.6, kinds[t.kind].leafY * t.s * (0.8 + Math.random() * 0.3), 7 + Math.random() * 3);
      }
    }

    let anyLeaf = false;
    leaves.forEach((l, i) => {
      if (!l) return;
      anyLeaf = true;
      l.age += dt;
      if (l.age > l.life) {
        leaves[i] = null;
        leafMesh.setMatrixAt(i, tmp.m.makeScale(0, 0, 0));
        return;
      }
      const onGround = l.y <= 0.02;
      if (!onGround) {
        const drag = 1 - 1.8 * dt;
        l.vx = l.vx * drag + Math.sin(now * 5 + l.seed) * 2 * dt;
        l.vz = l.vz * drag + Math.cos(now * 4 + l.seed) * 2 * dt;
        l.vy = Math.max(l.vy - 4 * dt, -0.9);
        l.x += l.vx * dt;
        l.y = Math.max(l.y + l.vy * dt, 0.02);
        l.z += l.vz * dt;
        l.spin += dt * 4;
      }
      tmp.e.set(onGround ? -Math.PI / 2 : Math.sin(l.spin + l.seed) * 1.2, l.seed, onGround ? 0 : Math.cos(l.spin) * 0.8);
      const fade = Math.min(1, (l.life - l.age) / 0.6);
      leafMesh.setMatrixAt(i, tmp.m.compose(tmp.p.set(l.x, l.y, l.z), tmp.q.setFromEuler(tmp.e), tmp.s.setScalar(fade)));
    });
    if (anyLeaf) leafMesh.instanceMatrix.needsUpdate = true;
  });

  return (
    <group>
      {/* colliders stay static; only the visuals sway */}
      <RigidBody type="fixed" colliders={false} userData={{ material: 'foliage' }}>
        {trees.map((t, i) => (
          <CylinderCollider key={i} args={[1.2 * t.s, 0.3 * t.s]} position={[t.x, 1.2 * t.s, t.z]} />
        ))}
      </RigidBody>
      {meshes.map((mesh, i) => (
        <primitive key={i} object={mesh} />
      ))}
      <primitive object={leafMesh} />
    </group>
  );
}
