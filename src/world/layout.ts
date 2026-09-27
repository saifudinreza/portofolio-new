// World layout: every zone position in one place (x, z on the ground plane).
// The camera looks from the south-east, so "north" (negative z) is up-screen.

export const WORLD_SIZE = 96; // square island, metres

export type ZoneId = 'home' | 'projects' | 'skills' | 'about' | 'contact';

export const zones: Record<ZoneId, { label: string; spawn: [number, number]; yaw: number }> = {
  home: { label: 'Home', spawn: [0, 6], yaw: Math.PI },
  projects: { label: 'Projects', spawn: [26, -3], yaw: Math.PI },
  skills: { label: 'Skills', spawn: [-24, -7], yaw: Math.PI },
  about: { label: 'About', spawn: [-12, 26], yaw: -Math.PI / 2 },
  contact: { label: 'Contact', spawn: [10, 30], yaw: Math.PI / 2 },
};

// Project pads sit on a 3 x 2 grid in the north-east.
export const projectPadPositions: [number, number][] = [
  [16, -16], [26, -16], [36, -16],
  [16, -28], [26, -28], [36, -28],
];

export const warehouse = { x: -24, z: -20 };
export const aboutArea = { x: -22, z: 26 };
export const contactPads: [number, number][] = [[18, 30], [26, 30], [34, 30]];
/** Koi pond between the About and Contact roads; an ellipse with radii rx (x) and rz (z). */
export const pond = { x: -1.5, z: 27, rx: 5.5, rz: 3.8, water: 0.22 };

/** 0 at the pond centre, 1 on the water's edge, >1 outside. */
export function pondDistance(x: number, z: number) {
  return Math.hypot((x - pond.x) / pond.rx, (z - pond.z) / pond.rz);
}

export const palette = {
  ground: '#F0E0C0',
  groundEdge: '#D9C29A',
  path: '#E4CFA6',
  navy: '#1F3864',
  teal: '#2BA89A',
  coral: '#F26B4F',
  yellow: '#F5B83D',
  wood: '#C68B59',
  woodDark: '#9A6A42',
  dark: '#23262D',
  cream: '#FFF6E6',
  leaf: '#6BAA5C',
  leafDark: '#4E8C47',
  rock: '#B9AD9A',
  sky: '#F6D9A8',
};

export const letterColors = [palette.navy, palette.teal, palette.coral, palette.yellow];

/** Dirt roads from the centre to each area: [x1, z1, x2, z2]. Trees are kept off these. */
export const roadSegments: [number, number, number, number][] = [
  [0, 4, 26, -6], // to projects
  [0, 4, -24, -10], // to skills
  [-24, -10, -24, -14], // into the warehouse
  [0, 4, -12, 26], // to about
  [0, 4, 10, 30], // to contact
  [10, 30, 36, 30], // along the contact pads
  [26, -6, 26, -32], // projects spine
];

export function distanceToSegment(x: number, z: number, [x1, z1, x2, z2]: [number, number, number, number]) {
  const dx = x2 - x1;
  const dz = z2 - z1;
  const t = Math.max(0, Math.min(1, ((x - x1) * dx + (z - z1) * dz) / (dx * dx + dz * dz)));
  return Math.hypot(x - (x1 + t * dx), z - (z1 + t * dz));
}

const keepClear: [number, number, number][] = [
  [0, 0, 11], // home
  [26, -20, 17], // projects
  [warehouse.x, warehouse.z, 10],
  [aboutArea.x, aboutArea.z, 9],
  [26, 29, 13], // contact
  [-8, 10, 5], // ramp
  [9, 16, 5], // cones
];

/** True when (x, z) is open ground: away from areas, pads, spawns and at least `roadMargin` from road centrelines. */
export function isClear(x: number, z: number, roadMargin = 4) {
  if (keepClear.some(([cx, cz, r]) => Math.hypot(x - cx, z - cz) < r)) return false;
  if (pondDistance(x, z) < 1.3) return false;
  for (const p of [...projectPadPositions, ...contactPads]) if (Math.hypot(x - p[0], z - p[1]) < 5) return false;
  if (Object.values(zones).some((zn) => Math.hypot(x - zn.spawn[0], z - zn.spawn[1]) < 5)) return false;
  return roadSegments.every((seg) => distanceToSegment(x, z, seg) > roadMargin);
}

// Deterministic pseudo random so the world looks the same on every load.
export function rng(seed: number) {
  return () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };
}

/** Footpaths through the meadows that walkers use between areas; trees are kept off them, grass is not. */
export const trails: [number, number, number, number][] = [
  [-12, -3, -16, 4],
  [-16, 4, -15, 13],
  [-15, 13, -8.7, 20],
];

export type Waypoint = { x: number; z: number; idle?: number; look?: [number, number] };
/**
 * NPC routes, walked there and back. Points sit on road centrelines and are shifted `side` metres to the
 * walker's left so people keep to the verge. `sit` makes the NPC sit down at its (single) point.
 */
export type NpcRoute = { points: Waypoint[]; side: number; sit?: boolean; hat?: boolean };

export const npcRoutes: NpcRoute[] = [
  // home -> projects, stopping to look at the pads
  { side: 1, points: [{ x: 3.7, z: 2.6, idle: 2 }, { x: 26, z: -6 }, { x: 26, z: -11, idle: 3, look: [26, -16] }, { x: 26, z: -23, idle: 3, look: [36, -28] }, { x: 26, z: -31, idle: 2 }] },
  // home -> skills warehouse
  { side: -1, points: [{ x: -3.5, z: 2, idle: 2 }, { x: -24, z: -10, idle: 3, look: [warehouse.x, warehouse.z] }] },
  // home -> about
  { side: 1, points: [{ x: -1.9, z: 7.5, idle: 1.5 }, { x: -12, z: 26, idle: 3, look: [aboutArea.x, aboutArea.z] }] },
  // home -> contact, along the pads
  { side: 1.2, points: [{ x: 1.4, z: 7.7, idle: 1.5 }, { x: 10, z: 30 }, { x: 26, z: 30, idle: 2.5, look: [26, 35] }, { x: 36, z: 30, idle: 3 }] },
  // warehouse guard pacing in front of the doors
  { side: 0, hat: true, points: [{ x: -29, z: -11.5, idle: 3, look: [warehouse.x, warehouse.z] }, { x: -19, z: -11.5, idle: 3, look: [warehouse.x, warehouse.z] }] },
  // meadow footpath between the skills and about roads
  { side: 0, points: trails.flatMap(([x1, z1], i) => [{ x: x1, z: z1, idle: i === 0 ? 2 : undefined }]).concat({ x: -8.7, z: 20, idle: 2 }) },
  // someone enjoying the koi pond
  { side: 0, sit: true, points: [{ x: -7.1, z: 30.1, look: [pond.x, pond.z] }] },
];
