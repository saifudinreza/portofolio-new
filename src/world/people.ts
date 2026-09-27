// Procedural people: human proportions built from capsules, spheres and lathes. Each body segment that moves
// on its own (torso, head, eyes, thigh, shin, upper arm, forearm) is one merged mesh coloured per vertex, so a
// person costs about as many draw calls as the old box figures and every NPC shares a single material.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

export type HairStyle = 'short' | 'long' | 'bun' | 'curly';
export type Look = {
  skin: string;
  shirt: string;
  pants: string;
  hair: string;
  hairStyle: HairStyle;
  hat: boolean;
  glasses: boolean;
  backpack: string | null;
  longSleeves: boolean;
  shorts: boolean;
};

/** Where the joints sit, in the person's root space (feet on y = 0). */
export const JOINTS = {
  hip: 0.47,
  hipX: 0.085,
  knee: -0.22, // below the hip
  shoulder: 0.86,
  shoulderX: 0.2,
  elbow: -0.21, // below the shoulder
  neck: 0.95,
};

let sharedMaterial: THREE.MeshStandardMaterial | null = null;
/** One material for every person; colours come from the geometry. */
export function peopleMaterial() {
  sharedMaterial ??= new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.78 });
  return sharedMaterial;
}

/** Non-indexed copy of `g` with every vertex painted `color` (uv dropped so parts merge). */
function paint(g: THREE.BufferGeometry, color: string) {
  const n = g.index ? g.toNonIndexed() : g;
  n.deleteAttribute('uv');
  const c = new THREE.Color(color);
  const col = new Float32Array(n.getAttribute('position').count * 3);
  for (let i = 0; i < col.length; i += 3) col.set([c.r, c.g, c.b], i);
  n.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return n;
}
const merge = (parts: THREE.BufferGeometry[]) => mergeGeometries(parts)!;

/** Capsule hanging down from its joint: top at y = 0, `length` long overall. */
const limb = (radius: number, length: number) => new THREE.CapsuleGeometry(radius, Math.max(length - radius * 2, 0.01), 4, 10).translate(0, -length / 2, 0);

const DARK = '#26262C';
const SHOE = '#2E2A28';

export function buildPerson(look: Look) {
  // Torso: hips in trouser colour, a chest that narrows at the waist and widens to the shoulders.
  const lathe = (pts: [number, number][]) => new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), 14).scale(1, 1, 0.62);
  const pelvis = lathe([[0, 0.43], [0.12, 0.44], [0.145, 0.5], [0.14, 0.57], [0, 0.57]]);
  const chest = lathe([[0, 0.56], [0.14, 0.56], [0.125, 0.64], [0.14, 0.72], [0.18, 0.83], [0.17, 0.88], [0.1, 0.92], [0, 0.93]]);
  const neck = new THREE.CylinderGeometry(0.045, 0.05, 0.07, 10).translate(0, 0.94, 0);
  const torsoParts = [paint(pelvis, look.pants), paint(chest, look.shirt), paint(neck, look.skin)];
  if (look.backpack) {
    const pack = new THREE.CapsuleGeometry(0.1, 0.12, 4, 10).scale(1.1, 1, 0.55).translate(0, 0.72, -0.13);
    torsoParts.push(paint(pack, look.backpack));
    for (const x of [-0.09, 0.09]) torsoParts.push(paint(new THREE.TorusGeometry(0.1, 0.012, 5, 10, Math.PI).rotateY(Math.PI / 2).translate(x, 0.79, -0.01), DARK));
  }
  const torso = merge(torsoParts);

  // Head, pivoting at the neck: skull, ears, nose, mouth, brows, hair (and glasses, hat).
  const skull = new THREE.SphereGeometry(0.125, 18, 14).scale(0.92, 1.06, 0.96).translate(0, 0.13, 0);
  const headParts = [
    paint(skull, look.skin),
    ...[-1, 1].map((s) => paint(new THREE.SphereGeometry(0.028, 8, 6).scale(0.6, 1, 1).translate(s * 0.113, 0.125, 0), look.skin)),
    paint(new THREE.SphereGeometry(0.02, 8, 6).translate(0, 0.11, 0.12), look.skin),
    paint(new THREE.CapsuleGeometry(0.008, 0.03, 2, 6).rotateZ(Math.PI / 2).translate(0, 0.07, 0.113), '#9A4A42'),
    ...[-1, 1].map((s) => paint(new THREE.CapsuleGeometry(0.007, 0.025, 2, 6).rotateZ(Math.PI / 2 + s * 0.15).translate(s * 0.045, 0.185, 0.112), look.hair)),
  ];
  const cap = (r: number, cut: number) => new THREE.SphereGeometry(r, 18, 10, 0, Math.PI * 2, 0, Math.PI * cut);
  headParts.push(paint(cap(0.135, 0.52).scale(0.95, 1.05, 1).translate(0, 0.14, -0.012), look.hair));
  if (look.hairStyle === 'long') headParts.push(paint(new THREE.CapsuleGeometry(0.1, 0.1, 4, 10).scale(1.1, 1, 0.55).translate(0, 0.06, -0.075), look.hair));
  if (look.hairStyle === 'bun') headParts.push(paint(new THREE.SphereGeometry(0.058, 12, 8).translate(0, 0.25, -0.085), look.hair));
  if (look.hairStyle === 'curly') {
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2;
      headParts.push(paint(new THREE.SphereGeometry(0.045, 8, 6).translate(Math.cos(a) * 0.1, 0.2 + Math.sin(i * 1.7) * 0.02, Math.sin(a) * 0.1 - 0.02), look.hair));
    }
  }
  if (look.hat) {
    headParts.push(paint(new THREE.CylinderGeometry(0.13, 0.14, 0.09, 16).translate(0, 0.26, -0.005), '#F5B83D'));
    headParts.push(paint(new THREE.CylinderGeometry(0.2, 0.2, 0.015, 20).translate(0, 0.215, 0.02), '#F5B83D'));
  }
  if (look.glasses) {
    for (const s of [-1, 1]) headParts.push(paint(new THREE.TorusGeometry(0.03, 0.006, 5, 14).translate(s * 0.045, 0.145, 0.118), DARK));
    headParts.push(paint(new THREE.CylinderGeometry(0.005, 0.005, 0.03, 4).rotateZ(Math.PI / 2).translate(0, 0.148, 0.12), DARK));
  }
  const head = merge(headParts);

  // Eyes are their own mesh so they can blink and close when dizzy.
  const eyes = merge([-1, 1].map((s) => paint(new THREE.SphereGeometry(0.017, 8, 6).scale(1, 1.2, 0.6).translate(s * 0.045, 0, 0), DARK)));

  // Legs: thigh from the hip to the knee, shin and shoe below the knee.
  const thigh = paint(limb(0.068, 0.25), look.pants);
  const shin = merge([
    paint(limb(0.056, 0.23), look.shorts ? look.skin : look.pants),
    paint(new THREE.CapsuleGeometry(0.048, 0.1, 4, 8).rotateX(Math.PI / 2).scale(1.15, 0.75, 1).translate(0, -0.215, 0.04), SHOE),
  ]);

  // Arms: sleeve from the shoulder to the elbow, forearm (skin or sleeve) and hand below.
  const upperArm = paint(limb(0.046, 0.23), look.shirt);
  const forearm = merge([
    paint(limb(0.039, 0.2), look.longSleeves ? look.shirt : look.skin),
    paint(new THREE.SphereGeometry(0.043, 10, 8).scale(0.85, 1.1, 0.7).translate(0, -0.225, 0), look.skin),
  ]);

  return { torso, head, eyes, thigh, shin, upperArm, forearm };
}
