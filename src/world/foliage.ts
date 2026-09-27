// Tree and shrub shapes: kinds, branched trunks, leaf-card canopies and their solid cores.
// Kept apart from Trees.tsx so the meadow shrubs in Details can reuse them.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { palette, rng } from './layout';
import { leafClusterMap } from './foliageTextures';
import type { Tier } from '../store';

/** Share of leaf cards drawn per tier; the solid core behind them keeps a thinner canopy looking full. */
const CARD_SHARE: Record<Tier, number> = { low: 0.6, medium: 0.85, high: 1 };

// ---------- shapes ----------

export type Blob = { c: [number, number, number]; r: number; squash?: number };
export type Kind = {
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

export const kinds: Kind[] = [
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
export function trunkGeometry(k: Kind) {
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
export function canopyGeometry(k: Kind, seed: number) {
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
export function coreGeometry(k: Kind) {
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
