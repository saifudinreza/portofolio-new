import * as THREE from 'three';

/** Merge geometries (indexed or not) into one non-indexed geometry that keeps only position and normal. The parts are disposed. */
export function mergeParts(parts: THREE.BufferGeometry[]) {
  const flat = parts.map((g) => (g.index ? g.toNonIndexed() : g));
  const total = flat.reduce((n, g) => n + g.getAttribute('position').count, 0);
  const position = new Float32Array(total * 3);
  const normal = new Float32Array(total * 3);
  let o = 0;
  for (const g of flat) {
    position.set(g.getAttribute('position').array as Float32Array, o * 3);
    normal.set(g.getAttribute('normal').array as Float32Array, o * 3);
    o += g.getAttribute('position').count;
    g.dispose();
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(position, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(normal, 3));
  return out;
}

/**
 * A pile of shapes that will share one material: each `add` copies a geometry, moves it with a matrix, and `merged()`
 * turns the whole pile into one geometry, so a whole monument made of many shapes costs one draw call per material.
 */
export class Parts {
  private list: THREE.BufferGeometry[] = [];
  add(geometry: THREE.BufferGeometry, matrix: THREE.Matrix4) {
    this.list.push(geometry.clone().applyMatrix4(matrix));
  }
  get empty() {
    return this.list.length === 0;
  }
  merged() {
    return mergeParts(this.list.splice(0));
  }
}

/** Handy shapes that stand on y = 0 (so they can be placed by their base). */
export const shapes = {
  box: (w: number, h: number, d: number) => new THREE.BoxGeometry(w, h, d).translate(0, h / 2, 0),
  cyl: (rTop: number, rBottom: number, h: number, seg = 16) => new THREE.CylinderGeometry(rTop, rBottom, h, seg).translate(0, h / 2, 0),
  cone: (r: number, h: number, seg = 16) => new THREE.ConeGeometry(r, h, seg).translate(0, h / 2, 0),
  ball: (r: number, wSeg = 14, hSeg = 10) => new THREE.SphereGeometry(r, wSeg, hSeg),
  torus: (r: number, tube: number, arc = Math.PI * 2, rSeg = 8, tSeg = 24) => new THREE.TorusGeometry(r, tube, rSeg, tSeg, arc),
};
