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
