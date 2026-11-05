import * as THREE from 'three';
import { WORLD_SIZE, terrainHeight } from './layout';

/** The ground is a grid of 1 m cells; the river distance field is sampled on the same 1 m nodes, so heights are exact. */
export const TERRAIN_N = WORLD_SIZE;
const HALF = WORLD_SIZE / 2;
/** How far the island's side skirt hangs below the edge, hiding the gap to the cliff block under it. */
const SKIRT = 1.2;

/**
 * Heights for a Rapier heightfield: (N + 1) x (N + 1) values, x as the outer index (heights[ix * (N + 1) + iz]),
 * spanning the island from -HALF to +HALF on both axes. (Checked against Rapier 0.19 with ray casts.)
 */
export function terrainHeights() {
  const n = TERRAIN_N;
  const out: number[] = new Array((n + 1) * (n + 1));
  for (let ix = 0; ix <= n; ix++) for (let iz = 0; iz <= n; iz++) out[ix * (n + 1) + iz] = terrainHeight(-HALF + ix, -HALF + iz);
  return out;
}

/** The ground surface (with the river trench) plus a skirt around the edge, in world coordinates, facing up. */
export function terrainGeometry(heights: number[]) {
  const n = TERRAIN_N;
  const pos: number[] = [];
  const uv: number[] = [];
  const index: number[] = [];
  const push = (x: number, y: number, z: number) => {
    pos.push(x, y, z);
    uv.push(x / WORLD_SIZE + 0.5, z / WORLD_SIZE + 0.5);
    return pos.length / 3 - 1;
  };
  for (let ix = 0; ix <= n; ix++) for (let iz = 0; iz <= n; iz++) push(-HALF + ix, heights[ix * (n + 1) + iz], -HALF + iz);
  const v = (ix: number, iz: number) => ix * (n + 1) + iz;
  for (let ix = 0; ix < n; ix++) {
    for (let iz = 0; iz < n; iz++) {
      const a = v(ix, iz);
      const b = v(ix + 1, iz);
      const c = v(ix, iz + 1);
      const d = v(ix + 1, iz + 1);
      index.push(a, c, b, b, c, d);
    }
  }
  // skirt: one strip down each side, drawn from both sides so the winding does not matter
  const skirtStart = pos.length / 3;
  const edges: [number, number][][] = [
    Array.from({ length: n + 1 }, (_, i) => [i, 0] as [number, number]),
    Array.from({ length: n + 1 }, (_, i) => [i, n] as [number, number]),
    Array.from({ length: n + 1 }, (_, i) => [0, i] as [number, number]),
    Array.from({ length: n + 1 }, (_, i) => [n, i] as [number, number]),
  ];
  for (const edge of edges) {
    // own copies of the top vertices, so the skirt does not skew the lighting along the edge of the surface
    const tops = edge.map(([ix, iz]) => push(-HALF + ix, heights[v(ix, iz)], -HALF + iz));
    const lows = edge.map(([ix, iz]) => push(-HALF + ix, heights[v(ix, iz)] - SKIRT, -HALF + iz));
    for (let i = 0; i < tops.length - 1; i++) {
      index.push(tops[i], lows[i], tops[i + 1], tops[i + 1], lows[i], lows[i + 1]);
      index.push(tops[i], tops[i + 1], lows[i], tops[i + 1], lows[i + 1], lows[i]);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(index);
  g.computeVertexNormals();
  // Drawn from both sides, the skirt's two windings cancel out in computeVertexNormals and leave zero-length
  // normals. The shader's normalize() turns those into NaN pixels, and on High the bloom smears one NaN pixel over
  // the whole screen: the black flashes along the island's edge (#73). Point every skirt vertex straight outwards.
  const normal = g.getAttribute('normal');
  const outward: [number, number][] = [[0, -1], [0, 1], [-1, 0], [1, 0]];
  const perEdge = (n + 1) * 2;
  for (let i = skirtStart; i < normal.count; i++) {
    const [nx, nz] = outward[Math.floor((i - skirtStart) / perEdge)];
    normal.setXYZ(i, nx, 0, nz);
  }
  return g;
}
