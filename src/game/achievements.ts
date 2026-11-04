import { create } from 'zustand';
import { projects } from '../data/profile';
import { gemSpots, secretPlaces, zones, type CarSkin } from '../world/layout';

// Achievements live in their own small store (not the main one) so the game code can report events from
// anywhere without an import cycle. Everything is saved in localStorage; storage can be blocked, so it never throws.

export type AchievementId =
  | 'all-projects' | 'all-zones' | 'open-live' | 'airtime' | 'jumper' | 'speed' | 'wet' | 'honk' | 'abyss' | 'classic'
  | 'circuit' | 'circuit-fast' | 'drift' | 'collector' | 'traveler';

export type Achievement = {
  id: AchievementId;
  title: string;
  description: string;
  /** shown as "???" until unlocked */
  secret?: boolean;
  /** for counting goals: how many to reach */
  goal?: number;
};

export const ZONE_COUNT = Object.keys(zones).length;
export const GEM_COUNT = gemSpots.length;
export const PLACE_COUNT = secretPlaces.length;
export const JUMP_GOAL = 25;
export const HONK_GOAL = 20;
/** Boost top speed is 19 m/s; the car needs a moment of full boost on flat ground to get this close. */
export const SPEED_GOAL = 18;
export const AIRTIME_GOAL = 1.2;
/** One unbroken drift this long (seconds) unlocks the drift achievement. */
export const DRIFT_GOAL = 2;
/** Time-trial target. A first estimate from the lap length (about 100 m with a U-turn); tune after playing. */
export const CIRCUIT_FAST_SECONDS = 18;

export const ACHIEVEMENTS: Achievement[] = [
  { id: 'all-projects', title: 'Window shopper', description: 'Park on every project pad.', goal: projects.length },
  { id: 'all-zones', title: 'Grand tour', description: 'Visit every area: Home, Projects, Skills, Experience, About and Contact.', goal: ZONE_COUNT },
  { id: 'open-live', title: 'Click-through', description: 'Open the live site of a project.' },
  { id: 'airtime', title: 'Airtime', description: 'Stay in the air for more than a second.' },
  { id: 'jumper', title: 'Bunny hop', description: `Jump ${JUMP_GOAL} times.`, goal: JUMP_GOAL },
  { id: 'speed', title: 'Pedal to the metal', description: 'Reach full boost speed.' },
  { id: 'wet', title: 'Wet paws', description: 'Drive through the river.' },
  { id: 'honk', title: 'Beep beep', description: `Honk the horn ${HONK_GOAL} times.`, goal: HONK_GOAL },
  { id: 'abyss', title: 'Edge of the world', description: 'Fall off the island.', secret: true },
  { id: 'classic', title: 'Recruiter mode', description: 'Open the classic view.' },
  { id: 'circuit', title: 'Lap of honour', description: 'Finish a time-trial lap: drive through the START gate on the Skills road.' },
  { id: 'drift', title: 'Sideways', description: `Drift for ${DRIFT_GOAL} seconds in one go: hold B or Ctrl and steer at speed.` },
  { id: 'collector', title: 'Gem hunter', description: `Find all ${GEM_COUNT} glowing gems. Some hide far from the roads, and some only a jump can reach.`, goal: GEM_COUNT },
  { id: 'traveler', title: 'World traveler', description: `Discover all ${PLACE_COUNT} hidden places: the ends of the two long roads, and the lighthouse.`, goal: PLACE_COUNT },
  { id: 'circuit-fast', title: 'Speed demon', description: `Finish a lap in under ${CIRCUIT_FAST_SECONDS} seconds.` },
];

/** Jeep paint jobs and what unlocks them. Blue is always there; the others are rewards. */
export const SKIN_RULES: Record<CarSkin, { label: string; hint: string; unlocked: (u: Record<string, true>) => boolean }> = {
  navy: { label: 'Blue', hint: 'Always available', unlocked: () => true },
  coral: { label: 'Coral', hint: 'Unlock "Window shopper"', unlocked: (u) => !!u['all-projects'] },
  sand: { label: 'Sand', hint: 'Unlock "Grand tour"', unlocked: (u) => !!u['all-zones'] },
  teal: { label: 'Teal', hint: 'Unlock any 6 achievements', unlocked: (u) => Object.keys(u).length >= 6 },
};

const KEY = 'zare-world-achievements';

type Saved = { unlocked: AchievementId[]; projects: string[]; zones: string[]; gems: string[]; places: string[]; jumps: number; honks: number; seconds: number };

function load(): Saved {
  const empty: Saved = { unlocked: [], projects: [], zones: [], gems: [], places: [], jumps: 0, honks: 0, seconds: 0 };
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? '{}') as Partial<Saved>;
    const list = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []);
    const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : 0);
    return {
      unlocked: list(raw.unlocked).filter((id): id is AchievementId => ACHIEVEMENTS.some((a) => a.id === id)),
      projects: list(raw.projects),
      zones: list(raw.zones),
      // only ids that still exist, so a changed layout can never leave a gem that cannot be found
      gems: list(raw.gems).filter((id) => gemSpots.some((g) => g.id === id)),
      places: list(raw.places).filter((id) => secretPlaces.some((p) => p.id === id)),
      jumps: num(raw.jumps),
      honks: num(raw.honks),
      seconds: num(raw.seconds),
    };
  } catch {
    return empty;
  }
}

const saved = load();
// The same facts kept in plain variables, so the per-frame checks never touch React state or storage.
const unlockedSet = new Set<AchievementId>(saved.unlocked);
const projectSet = new Set(saved.projects);
const zoneSet = new Set(saved.zones);
const gemSet = new Set(saved.gems);
const placeSet = new Set(saved.places);
let jumps = saved.jumps;
let honks = saved.honks;
let seconds = saved.seconds;
let lastSavedSeconds = seconds;

function persist() {
  try {
    const data: Saved = { unlocked: [...unlockedSet], projects: [...projectSet], zones: [...zoneSet], gems: [...gemSet], places: [...placeSet], jumps, honks, seconds };
    localStorage.setItem(KEY, JSON.stringify(data));
  } catch {
    // private mode or blocked storage: progress just won't be remembered
  }
}

type View = {
  unlocked: Record<string, true>;
  projects: number;
  zones: number;
  gems: number;
  places: number;
  jumps: number;
  honks: number;
  seconds: number;
  /** the achievement to announce right now */
  toast: Achievement | null;
  /** a small one-line message (a gem found, a place discovered) */
  note: string | null;
};

const snapshot = (): Omit<View, 'toast' | 'note'> => ({
  unlocked: Object.fromEntries([...unlockedSet].map((id) => [id, true as const])),
  projects: projectSet.size,
  zones: zoneSet.size,
  gems: gemSet.size,
  places: placeSet.size,
  jumps,
  honks,
  seconds: Math.floor(seconds),
});

export const useAchievements = create<View>(() => ({ ...snapshot(), toast: null, note: null }));

const refresh = () => useAchievements.setState(snapshot());

let toastTimer = 0;

/** Unlock once; later calls are free, so it is safe to call every frame while the condition holds. */
export function unlock(id: AchievementId) {
  if (unlockedSet.has(id)) return;
  unlockedSet.add(id);
  persist();
  const toast = ACHIEVEMENTS.find((a) => a.id === id) ?? null;
  useAchievements.setState({ ...snapshot(), toast });
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => useAchievements.setState({ toast: null }), 3500);
}

export const isUnlocked = (id: AchievementId) => unlockedSet.has(id);

let noteTimer = 0;
function announce(note: string) {
  useAchievements.setState({ note });
  window.clearTimeout(noteTimer);
  noteTimer = window.setTimeout(() => useAchievements.setState({ note: null }), 2600);
}

export const hasGem = (id: string) => gemSet.has(id);
export const hasPlace = (id: string) => placeSet.has(id);

/** A gem was picked up. Saved at once, so it is still gone after a refresh. */
export function collectGem(id: string) {
  if (gemSet.has(id)) return;
  gemSet.add(id);
  persist();
  refresh();
  announce(`Gem found: ${gemSet.size} of ${GEM_COUNT}`);
  if (gemSet.size >= GEM_COUNT) unlock('collector');
}

/** The car came close to a hidden place for the first time. */
export function discoverPlace(id: string, label: string) {
  if (placeSet.has(id)) return;
  placeSet.add(id);
  persist();
  refresh();
  announce(`Discovered: ${label} (${placeSet.size} of ${PLACE_COUNT})`);
  if (placeSet.size >= PLACE_COUNT) unlock('traveler');
}

export function visitProject(id: string) {
  if (projectSet.has(id)) return;
  projectSet.add(id);
  persist();
  refresh();
  if (projectSet.size >= projects.length) unlock('all-projects');
}

export function visitZone(id: string) {
  if (zoneSet.has(id)) return;
  zoneSet.add(id);
  persist();
  refresh();
  if (zoneSet.size >= ZONE_COUNT) unlock('all-zones');
}

export function addJump() {
  jumps++;
  persist();
  refresh();
  if (jumps >= JUMP_GOAL) unlock('jumper');
}

export function addHonk() {
  honks++;
  persist();
  refresh();
  if (honks >= HONK_GOAL) unlock('honk');
}

/** Play time: called every frame while driving, written out only every 10 s. */
export function tickPlayTime(dt: number) {
  seconds += dt;
  if (seconds - lastSavedSeconds >= 10) {
    lastSavedSeconds = seconds;
    persist();
    refresh();
  }
}

export function resetAchievements() {
  unlockedSet.clear();
  projectSet.clear();
  zoneSet.clear();
  gemSet.clear();
  placeSet.clear();
  jumps = honks = seconds = lastSavedSeconds = 0;
  persist();
  useAchievements.setState({ ...snapshot(), toast: null, note: null });
}
