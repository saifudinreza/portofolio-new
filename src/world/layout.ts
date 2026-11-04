// World layout: every zone position in one place (x, z on the ground plane).
// The camera looks from the south-east, so "north" (negative z) is up-screen.

export const WORLD_SIZE = 144; // square island, metres
/** The island was 96 m before it was enlarged: every area, road and the circuit still sit inside that centred square. */
export const OLD_WORLD_SIZE = 96;
/** How many times bigger the island's area is than it was. */
export const AREA_RATIO = (WORLD_SIZE / OLD_WORLD_SIZE) ** 2;
/**
 * Scale a scatter count (trees, rocks, leaves ...) that was tuned for the old island. `share` 1 keeps the density
 * the same everywhere; a smaller share adds fewer objects than the extra land would need (use it for heavy things).
 */
export const scaled = (n: number, share = 1) => Math.round(n * (1 + (AREA_RATIO - 1) * share));

export type ZoneId = 'home' | 'projects' | 'skills' | 'experience' | 'about' | 'contact';

export const zones: Record<ZoneId, { label: string; /** a shorter name for the narrow top bar */ short?: string; spawn: [number, number]; yaw: number }> = {
  home: { label: 'Home', spawn: [0, 6], yaw: Math.PI },
  projects: { label: 'Projects', spawn: [26, -3], yaw: Math.PI },
  skills: { label: 'Skills', spawn: [-24, -7], yaw: Math.PI },
  // at the end of the west road; the spawn is on the road and faces the area
  experience: { label: 'Experience', short: 'Work', spawn: [-46, -6.8], yaw: -Math.PI / 2 },
  about: { label: 'About', spawn: [-12, 26], yaw: -Math.PI / 2 },
  contact: { label: 'Contact', spawn: [10, 30], yaw: Math.PI / 2 },
};

/** The zone whose spawn point is closest to (x, z): where "I'm stuck" and falling off the island put the car back. */
export function nearestZone(x: number, z: number) {
  let best = zones.home;
  let bestD = Infinity;
  for (const zn of Object.values(zones)) {
    const d = Math.hypot(x - zn.spawn[0], z - zn.spawn[1]);
    if (d < bestD) {
      bestD = d;
      best = zn;
    }
  }
  return best;
}

// Project pads sit on a 3 x 2 grid in the north-east.
export const projectPadPositions: [number, number][] = [
  [16, -16], [26, -16], [36, -16],
  [16, -28], [26, -28], [36, -28],
];

/**
 * Where the project monuments stand: one beside each pad, 5 m to its east (between two pads, off the north-south spine
 * road), turned a little towards the camera. The grand statue closes the north end of the field.
 */
export const projectMonuments = projectPadPositions.map(([x, z]) => ({ x: x + 5, z, yaw: 0.35 }));
export const grandStatue = { x: 21, z: -36, yaw: 0.55 };
/** Lantern posts between the two rows of monuments and by the grand statue; banner poles along the entrance to the field. */
export const monumentLanterns: [number, number][] = [[16, -22], [21, -22], [31, -22], [36, -22], [41, -22], [16.5, -32], [25.5, -40]];
export const bannerPoles: [number, number][] = [[16, -10.5], [21, -10.5], [31, -10.5], [36, -10.5]];

export const warehouse = { x: -24, z: -20 };
/** The Experience area: its pad, at the end of the west road. */
export const experienceArea = { x: -58, z: -6 };
/** The About courtyard pad, in front of the building (which stands to its west and faces the road). */
export const aboutArea = { x: -17, z: 26 };
/** The About monument building: centre of its podium; its front (local +z) faces east, towards the road. */
export const aboutBuilding = { x: -27.5, z: 26, yaw: Math.PI / 2 };
export const contactPads: [number, number][] = [[18, 30], [26, 30], [34, 30]];
/**
 * Empty, flat, tree-free pocket on the east side, reserved for the edge waterfall (issue #56). It sits well clear of the
 * river's east reach (z about 9) and of the Projects field. A box: x from `x - hx` to `x + hx`, z from `z - hz` to `z + hz`.
 */
export const waterfallZone = { x: 62, z: -12, hx: 10, hz: 10 };
/** Koi pond between the About and Contact roads; an ellipse with radii rx (x) and rz (z). */
export const pond = { x: -1.5, z: 27, rx: 5.5, rz: 3.8, water: 0.22 };

/** 0 at the pond centre, 1 on the water's edge, >1 outside. */
export function pondDistance(x: number, z: number) {
  return Math.hypot((x - pond.x) / pond.rx, (z - pond.z) / pond.rz);
}

export const palette = {
  ground: '#EFD7A6',
  groundEdge: '#D4B27E',
  path: '#E3C690',
  navy: '#1F3864',
  teal: '#1FA595',
  coral: '#F2603F',
  yellow: '#F7B02A',
  wood: '#C68B59',
  woodDark: '#9A6A42',
  dark: '#23262D',
  cream: '#FFF6E6',
  leaf: '#5FAE48',
  leafDark: '#438A3C',
  rock: '#B9AD9A',
  sky: '#F8D49A',
};

/** Jeep paint colours. The default `navy` is lighter than the UI navy so the body reads from the top-down camera. */
export const CAR_SKINS = {
  navy: { paint: '#2F5A9E' },
  coral: { paint: '#E8664A' },
  sand: { paint: '#D9B26F' },
  teal: { paint: '#2BA89A' },
} as const;
export type CarSkin = keyof typeof CAR_SKINS;

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
  // roads out into the land added when the island grew; kept at the end so the indices above stay valid
  [36, 30, 58, 48], // south-east from the contact pads
  [26, -32, 44, -56], // north-east, past the end of the projects spine
  [-24, -10, -52, -6], // west of the skills warehouse
  [-52, -6, -55.5, -6], // the last stretch into the Experience area
];

/** A point `t` (0..1) of the way along road `i`, plus the road's heading there: [x, z, yaw]. */
const onRoad = (i: number, t: number): [number, number, number] => {
  const [x1, z1, x2, z2] = roadSegments[i];
  return [x1 + (x2 - x1) * t, z1 + (z2 - z1) * t, Math.atan2(x2 - x1, z2 - z1)];
};

/**
 * Time-trial gates, in driving order; gate 0 is both start and finish. One lap: out along the Skills road and back,
 * down the About road, across north of the pond to the Contact road, and home. Every point was checked to keep
 * clear of the river, the pond, the pads and the Home spawn.
 */
export const circuitGates: [number, number, number][] = [
  onRoad(1, 0.42), // start / finish, on the Skills road just past the plaza
  onRoad(1, 0.78), // before the warehouse (and clear of the Skills spawn): turn round after it
  onRoad(3, 0.45), // About road
  onRoad(3, 0.8), // near About
  onRoad(4, 0.75), // over to the Contact road
  onRoad(4, 0.3), // back towards Home
];

/** 0.1..1: how lush the meadow is at (x, z). A smooth low-frequency field, shared by the grass scatter and the ground tint. */
export const meadowField = (x: number, z: number) => 0.55 + 0.45 * Math.sin(x * 0.21 + Math.sin(z * 0.17) * 2) * Math.cos(z * 0.19 - x * 0.07);

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
  [aboutArea.x, aboutArea.z, 7],
  [aboutBuilding.x + 1, aboutBuilding.z, 13], // the About building, its steps and its wings
  [experienceArea.x + 3, experienceArea.z, 13], // pad, milestone boards, crates and the way in
  [26, 29, 13], // contact
  [-8, 10, 5], // ramp
  [9, 16, 5], // cones
  [waterfallZone.x, waterfallZone.z, 13], // reserved for the edge waterfall
];

// ---------- river and bridge ----------

/**
 * River from the north shore, down between Home and the Projects field, then east out to the east shore.
 * It only crosses one road (Home → Projects), where the bridge is. Both ends fall off the cliffs into the sea.
 * Control points run past the island edge so the smoothed curve leaves it cleanly.
 */
const riverControl: [number, number][] = [
  [4.2, -90], [4.6, -72], [5, -54], [5.5, -40], [6.5, -28], [7.5, -18], [10, -8], [13, -1], [16.5, 5], [23, 8.8], [32, 9.4], [41, 8.6], [54, 9.6], [68, 9.2], [86, 9.8],
];
/** Half the width of the water; the sloping bank reaches this much further, from ground level down to the water line. */
export const RIVER_HALF_WIDTH = 2.6;
export const RIVER_BANK = 2.4;
/** The river sits in a trench: the water surface is below the ground (y = 0), the bed lower still. */
export const RIVER_WATER = -0.3;
/** Terrain height where the bank meets the water, and in the middle of the bed. */
export const RIVER_BED_EDGE = -0.36;
export const RIVER_BED = -0.62;

/** Terrain height of the river trench at `d` metres from the river's centreline (0 beyond the bank). */
export function riverBedHeight(d: number) {
  const top = RIVER_HALF_WIDTH + RIVER_BANK;
  if (d >= top) return 0;
  if (d > RIVER_HALF_WIDTH) {
    const t = (top - d) / RIVER_BANK; // 0 at the top of the bank, 1 at the water line
    return RIVER_BED_EDGE * t * t * (3 - 2 * t);
  }
  const t = d / RIVER_HALF_WIDTH;
  return RIVER_BED_EDGE + (RIVER_BED - RIVER_BED_EDGE) * (1 - t * t);
}

export type RiverPoint = { x: number; z: number; s: number; tx: number; tz: number };

/** Uniform Catmull-Rom through the control points, sampled densely; s is the distance along the river. */
function sampleRiver(pts: [number, number][], perSegment = 28): RiverPoint[] {
  const out: RiverPoint[] = [];
  const at = (i: number) => pts[Math.max(0, Math.min(pts.length - 1, i))];
  for (let i = 0; i < pts.length - 1; i++) {
    const [p0, p1, p2, p3] = [at(i - 1), at(i), at(i + 1), at(i + 2)];
    for (let k = 0; k < perSegment; k++) {
      const t = k / perSegment;
      const t2 = t * t;
      const t3 = t2 * t;
      const c = (a: number, b: number, cc: number, d: number) => 0.5 * (2 * b + (cc - a) * t + (2 * a - 5 * b + 4 * cc - d) * t2 + (3 * b - a - 3 * cc + d) * t3);
      out.push({ x: c(p0[0], p1[0], p2[0], p3[0]), z: c(p0[1], p1[1], p2[1], p3[1]), s: 0, tx: 0, tz: 0 });
    }
  }
  const last = pts[pts.length - 1];
  out.push({ x: last[0], z: last[1], s: 0, tx: 0, tz: 0 });
  for (let i = 0; i < out.length; i++) {
    const a = out[Math.max(0, i - 1)];
    const b = out[Math.min(out.length - 1, i + 1)];
    const l = Math.hypot(b.x - a.x, b.z - a.z) || 1;
    out[i].tx = (b.x - a.x) / l;
    out[i].tz = (b.z - a.z) / l;
    if (i > 0) out[i].s = out[i - 1].s + Math.hypot(out[i].x - out[i - 1].x, out[i].z - out[i - 1].z);
  }
  return out;
}

export const riverPath = sampleRiver(riverControl);

function riverDistanceExact(x: number, z: number) {
  let best = Infinity;
  for (let i = 0; i < riverPath.length - 1; i++) {
    const a = riverPath[i];
    const b = riverPath[i + 1];
    best = Math.min(best, distanceToSegment(x, z, [a.x, a.z, b.x, b.z]));
  }
  return best;
}

// Distance field on a 1 m grid, built on first use (trees, grass and props ask hundreds of thousands of times).
const GRID_MIN = -WORLD_SIZE / 2 - 6;
const GRID_N = WORLD_SIZE + 13;
let grid: Float32Array | null = null;

/** Metres from (x, z) to the river's centreline. Water is < RIVER_HALF_WIDTH. */
export function riverDistance(x: number, z: number) {
  if (!grid) {
    grid = new Float32Array(GRID_N * GRID_N);
    for (let j = 0; j < GRID_N; j++) for (let i = 0; i < GRID_N; i++) grid[j * GRID_N + i] = riverDistanceExact(GRID_MIN + i, GRID_MIN + j);
  }
  const gx = Math.max(0, Math.min(GRID_N - 1.001, x - GRID_MIN));
  const gz = Math.max(0, Math.min(GRID_N - 1.001, z - GRID_MIN));
  const i = Math.floor(gx);
  const j = Math.floor(gz);
  const fx = gx - i;
  const fz = gz - j;
  const g = grid;
  const top = g[j * GRID_N + i] * (1 - fx) + g[j * GRID_N + i + 1] * fx;
  const bottom = g[(j + 1) * GRID_N + i] * (1 - fx) + g[(j + 1) * GRID_N + i + 1] * fx;
  return top * (1 - fz) + bottom * fz;
}

/** Height of the terrain at (x, z): flat ground (0) except the river trench. The ground mesh and its collider are built from this. */
export const terrainHeight = (x: number, z: number) => riverBedHeight(riverDistance(x, z));

/** Where the Home → Projects road crosses the river: the bridge sits there, lined up with the road. */
function findBridge() {
  const [x1, z1, x2, z2] = roadSegments[0];
  let best = { t: 0, d: Infinity };
  for (let k = 0; k <= 400; k++) {
    const t = k / 400;
    const d = riverDistanceExact(x1 + (x2 - x1) * t, z1 + (z2 - z1) * t);
    if (d < best.d) best = { t, d };
  }
  const len = Math.hypot(x2 - x1, z2 - z1);
  return {
    x: x1 + (x2 - x1) * best.t,
    z: z1 + (z2 - z1) * best.t,
    /** direction of travel across the bridge, as a yaw (local +z points along the road) */
    yaw: Math.atan2(x2 - x1, z2 - z1),
    dirX: (x2 - x1) / len,
    dirZ: (z2 - z1) / len,
    /** the arched deck reaches this far each way from the centre, then a ramp of `ramp` metres down to the ground */
    deckHalf: 4.2,
    ramp: 2.6,
    halfWidth: 1.7,
    /** deck height at both ends of the arch (where the ramps start) */
    height: 0.55,
    /** how much higher the deck is in the middle than at its ends: a gentle hump over the arch */
    hump: 0.22,
  };
}
export const bridge = findBridge();

/** Deck height `along` metres from the bridge centre (either way): a parabolic hump, then a straight ramp down to the ground. */
export function bridgeDeckHeight(along: number) {
  const a = Math.abs(along);
  if (a <= bridge.deckHalf) return bridge.height + bridge.hump * (1 - (a / bridge.deckHalf) ** 2);
  return Math.max(0, bridge.height * (1 - (a - bridge.deckHalf) / bridge.ramp));
}

/** Height of whatever you stand on at (x, z): the bridge deck and ramps, otherwise the ground (0). */
export function groundHeight(x: number, z: number) {
  const dx = x - bridge.x;
  const dz = z - bridge.z;
  const along = Math.abs(dx * bridge.dirX + dz * bridge.dirZ);
  const side = Math.abs(dx * bridge.dirZ - dz * bridge.dirX);
  if (side > bridge.halfWidth || along > bridge.deckHalf + bridge.ramp) return 0;
  return bridgeDeckHeight(along);
}

/** In the river's water and not up on the bridge. */
export const inRiver = (x: number, z: number) => riverDistance(x, z) < RIVER_HALF_WIDTH && groundHeight(x, z) === 0;

/** True when (x, z) is open ground: away from areas, pads, spawns and at least `roadMargin` from road centrelines. */
export function isClear(x: number, z: number, roadMargin = 4) {
  if (keepClear.some(([cx, cz, r]) => Math.hypot(x - cx, z - cz) < r)) return false;
  if (pondDistance(x, z) < 1.3) return false;
  if (riverDistance(x, z) < RIVER_HALF_WIDTH + RIVER_BANK) return false;
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
