import { create } from 'zustand';
import { CAR_SKINS, type CarSkin, type ZoneId } from './world/layout';
import { unlock, visitProject } from './game/achievements';

/** Something the car is currently parked on: a project pad, the warehouse, etc. */
export type Spot =
  | { kind: 'project'; id: string }
  | { kind: 'skills' }
  | { kind: 'about' }
  | { kind: 'experience' }
  | { kind: 'contact'; id: 'github' | 'linkedin' | 'email' };

export type MenuTab = 'options' | 'controls' | 'achievements' | 'about-site';
/** Time of day: a fixed look, or 'auto' for the 10-minute day/night cycle. Kept here so the main chunk never imports three. */
export type TimeMode = 'auto' | 'day' | 'dusk' | 'night';
const TIME_KEY = 'zare-world-time';
/** Clear skies, rain, or 'auto': a shower of about two minutes every eight. */
export type Weather = 'clear' | 'rain' | 'auto';
const WEATHER_KEY = 'zare-world-weather';

function loadWeather(): Weather {
  try {
    const saved = localStorage.getItem(WEATHER_KEY);
    if (saved === 'clear' || saved === 'rain' || saved === 'auto') return saved;
  } catch {
    // fall through to the default
  }
  return 'clear';
}

function loadTimeMode(): TimeMode {
  try {
    const saved = localStorage.getItem(TIME_KEY);
    if (saved === 'auto' || saved === 'day' || saved === 'dusk' || saved === 'night') return saved;
  } catch {
    // fall through to the default
  }
  return 'day';
}

const AUDIO_KEY = 'zare-world-audio';

type AudioPrefs = { muted: boolean; volume: number; musicVolume: number };

/** Mute + volumes survive reloads; storage can be missing or blocked, so fall back quietly. */
function loadAudioPrefs(): AudioPrefs {
  const unit = (v: unknown, fallback: number) => (typeof v === 'number' ? Math.min(1, Math.max(0, v)) : fallback);
  try {
    const saved = JSON.parse(localStorage.getItem(AUDIO_KEY) ?? '{}') as { muted?: unknown; volume?: unknown; musicVolume?: unknown };
    return { muted: saved.muted === true, volume: unit(saved.volume, 0.7), musicVolume: unit(saved.musicVolume, 1) };
  } catch {
    return { muted: false, volume: 0.7, musicVolume: 1 };
  }
}

function saveAudioPrefs(prefs: AudioPrefs) {
  try {
    localStorage.setItem(AUDIO_KEY, JSON.stringify(prefs));
  } catch {
    // private mode or blocked storage: the setting just won't be remembered
  }
}

/**
 * Graphics. `quality` is what the player picked; `tier` is what the scene actually renders at. With "auto" the
 * tier starts from a device guess and a performance monitor moves it up or down.
 *   low:    DPR ≤ 1, no shadows, no reflections or post-processing, 45% grass
 *   medium: DPR ≤ 1.25, shadows, reflections, no post-processing, 75% grass
 *   high:   DPR ≤ 1.75, shadows, reflections, post-processing (bloom, grade, SMAA, adaptive AO), full grass
 */
export type Tier = 'low' | 'medium' | 'high';
export type Quality = 'auto' | Tier;
const QUALITY_KEY = 'zare-world-quality';
const TIERS: Tier[] = ['low', 'medium', 'high'];

const isTouch = () => typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches;
const autoStartTier = (): Tier => (isTouch() ? 'low' : 'medium');

function loadQuality(): Quality {
  try {
    const saved = localStorage.getItem(QUALITY_KEY);
    if (saved === 'auto' || saved === 'low' || saved === 'medium' || saved === 'high') return saved;
  } catch {
    // fall through to the default
  }
  return 'auto';
}

const initialQuality = loadQuality();

const SKIN_KEY = 'zare-world-skin';

function loadSkin(): CarSkin {
  try {
    const saved = localStorage.getItem(SKIN_KEY);
    if (saved && saved in CAR_SKINS) return saved as CarSkin;
  } catch {
    // fall through to the default
  }
  return 'navy';
}

type State = {
  started: boolean;
  quality: Quality;
  tier: Tier;
  setQuality: (q: Quality) => void;
  /** Auto mode only: move the tier one step (+1 up, -1 down). */
  stepTier: (dir: 1 | -1) => void;
  /** 0..100 while the 3D world loads; set from inside the lazily loaded scene. */
  loadProgress: number;
  loadDone: boolean;
  /** What the world is doing right now ("Planting grass and trees"), shown under the loading bar. */
  loadLabel: string;
  setLoad: (progress: number, done: boolean, label?: string) => void;
  /** Set when the 3D side fails (render error, failed chunk, lost GL context). Shows the recovery screen. */
  sceneError: 'crash' | 'context-lost' | null;
  setSceneError: (e: 'crash' | 'context-lost' | null) => void;
  muted: boolean;
  volume: number;
  /** music level on top of the master volume, 0..1 (the menu's Music slider) */
  musicVolume: number;
  setMusicVolume: (v: number) => void;
  timeMode: TimeMode;
  setTimeMode: (mode: TimeMode) => void;
  weather: Weather;
  setWeather: (weather: Weather) => void;
  /** jeep paint; the menu only offers the ones that are unlocked */
  carSkin: CarSkin;
  setCarSkin: (skin: CarSkin) => void;
  classicOpen: boolean;
  /** the Menu panel (☰) and which tab it shows, or null when closed */
  menuOpen: MenuTab | null;
  /** the big map (M) */
  mapOpen: boolean;
  setMenu: (tab: MenuTab | null) => void;
  setMap: (open: boolean) => void;
  spot: Spot | null;
  teleport: { zone: ZoneId; nonce: number } | null;
  speed: number;
  start: () => void;
  setClassic: (open: boolean) => void;
  setSpot: (spot: Spot | null) => void;
  clearSpotIf: (match: (s: Spot) => boolean) => void;
  teleportTo: (zone: ZoneId) => void;
  setSpeed: (v: number) => void;
  setMuted: (muted: boolean) => void;
  setVolume: (volume: number) => void;
};

export const useStore = create<State>((set, get) => ({
  started: false,
  quality: initialQuality,
  tier: initialQuality === 'auto' ? autoStartTier() : initialQuality,
  setQuality: (quality) => {
    set({ quality, tier: quality === 'auto' ? autoStartTier() : quality });
    try {
      localStorage.setItem(QUALITY_KEY, quality);
    } catch {
      // not remembered, that's fine
    }
  },
  stepTier: (dir) => {
    if (get().quality !== 'auto') return;
    const i = TIERS.indexOf(get().tier) + dir;
    if (i >= 0 && i < TIERS.length) set({ tier: TIERS[i] });
  },
  loadProgress: 0,
  loadDone: false,
  loadLabel: '',
  setLoad: (loadProgress, loadDone, label) => set((st) => ({ loadProgress, loadDone, loadLabel: label ?? st.loadLabel })),
  sceneError: null,
  setSceneError: (sceneError) => set({ sceneError }),
  ...loadAudioPrefs(),
  timeMode: loadTimeMode(),
  setTimeMode: (timeMode) => {
    set({ timeMode });
    try {
      localStorage.setItem(TIME_KEY, timeMode);
    } catch {
      // not remembered, that's fine
    }
  },
  weather: loadWeather(),
  setWeather: (weather) => {
    set({ weather });
    try {
      localStorage.setItem(WEATHER_KEY, weather);
    } catch {
      // not remembered, that's fine
    }
  },
  carSkin: loadSkin(),
  setCarSkin: (carSkin) => {
    set({ carSkin });
    try {
      localStorage.setItem(SKIN_KEY, carSkin);
    } catch {
      // not remembered, that's fine
    }
  },
  classicOpen: false,
  menuOpen: null,
  mapOpen: false,
  // Keys held while a panel opens would never see their keyup, so every opener releases the input first.
  // The menu and the map never show together.
  setMenu: (tab) => {
    if (tab) resetInput();
    set({ menuOpen: tab, mapOpen: tab ? false : get().mapOpen });
  },
  setMap: (open) => {
    if (open) resetInput();
    set({ mapOpen: open, menuOpen: open ? null : get().menuOpen });
  },
  spot: null,
  teleport: null,
  speed: 0,
  start: () => set({ started: true }),
  setClassic: (open) => {
    if (open) {
      resetInput();
      unlock('classic');
    }
    set({ classicOpen: open, menuOpen: open ? null : get().menuOpen, mapOpen: open ? false : get().mapOpen });
  },
  setSpot: (spot) => {
    if (spot?.kind === 'project') visitProject(spot.id);
    set({ spot });
  },
  clearSpotIf: (match) => set((s) => (s.spot && match(s.spot) ? { spot: null } : {})),
  teleportTo: (zone) => set({ teleport: { zone, nonce: Date.now() }, spot: null }),
  setSpeed: (v) => set({ speed: v }),
  setMuted: (muted) => {
    set({ muted });
    saveAudioPrefs({ muted, volume: get().volume, musicVolume: get().musicVolume });
  },
  setVolume: (volume) => {
    // dragging the slider up from zero also unmutes, like most players
    const muted = volume > 0 ? false : get().muted;
    set({ volume, muted });
    saveAudioPrefs({ muted, volume, musicVolume: get().musicVolume });
  },
  setMusicVolume: (musicVolume) => {
    set({ musicVolume });
    saveAudioPrefs({ muted: get().muted, volume: get().volume, musicVolume });
  },
}));

/**
 * Driving input. Kept outside React state on purpose: it is read every frame
 * by the car and written by keyboard + touch handlers, so it must not re-render.
 */
export type TouchButton = 'left' | 'right' | 'gas' | 'reverse' | 'horn' | 'boost' | 'jump' | 'brake';

export const input = {
  // Each pedal keeps its own state so releasing one never cancels another that is still held.
  touch: { left: false, right: false, gas: false, reverse: false, horn: false, boost: false, jump: false, brake: false } as Record<TouchButton, boolean>,
  /** Virtual joystick, −1..1 each way: x right, y forward. Zero when released. */
  joy: { x: 0, y: 0 },
  keys: new Set<string>(),
  /** "I'm stuck": put the car back on the spawn point of the closest area. Set by R, the touch button and the gamepad. */
  respawnNearestRequested: false,
  /** gamepad Y: open the parked spot's link on the next frame (handled by the car, like the respawn) */
  openLinkRequested: false,
};

// ---------- gamepad ----------

const PAD_DEAD = 0.15;
/** Analog triggers rarely rest at exactly 0; anything below this counts as released. */
const PAD_TRIGGER_DEAD = 0.1;
/**
 * After all sources are added, a leftover this small is noise, not a request. Without it a trigger resting at 0.04
 * kept the throttle off zero: the parking brake never engaged and the car crept away and sped up on its own.
 */
const THROTTLE_DEAD = 0.1;
const STEER_DEAD = 0.05;
type PadInput = { throttle: number; steer: number; jump: boolean; brake: boolean; boost: boolean; horn: boolean };
const NO_PAD: PadInput = { throttle: 0, steer: 0, jump: false, brake: false, boost: false, horn: false };
// Y and Back act once per press, so remember last frame's state.
const padPrev = { y: false, back: false };

/**
 * First connected gamepad with the standard (Xbox-style) layout. Left stick steers, RT/LT are gas and reverse,
 * A jump, B brake, X boost, RB horn, Y opens the parked spot's link, Back respawns at the nearest area.
 */
function readGamepad(): PadInput {
  if (typeof navigator === 'undefined' || !navigator.getGamepads) return NO_PAD;
  let pad: Gamepad | null = null;
  for (const g of navigator.getGamepads()) {
    if (g && g.connected && g.mapping === 'standard') {
      pad = g;
      break;
    }
  }
  if (!pad) {
    padPrev.y = padPrev.back = false;
    return NO_PAD;
  }
  const pressed = (i: number) => pad.buttons[i]?.pressed ?? false;
  const value = (i: number) => pad.buttons[i]?.value ?? 0;
  const trigger = (i: number) => {
    const v = value(i);
    return v < PAD_TRIGGER_DEAD ? 0 : (v - PAD_TRIGGER_DEAD) / (1 - PAD_TRIGGER_DEAD);
  };
  const ax = pad.axes[0] ?? 0;
  const stick = Math.abs(ax) < PAD_DEAD ? 0 : (ax - Math.sign(ax) * PAD_DEAD) / (1 - PAD_DEAD);
  const y = pressed(3);
  const back = pressed(8);
  if (y && !padPrev.y) input.openLinkRequested = true;
  if (back && !padPrev.back) input.respawnNearestRequested = true;
  padPrev.y = y;
  padPrev.back = back;
  return {
    throttle: trigger(7) - trigger(6),
    // steer is +1 for left, the stick is +1 for right
    steer: -stick,
    jump: pressed(0),
    brake: pressed(1),
    boost: pressed(2),
    horn: pressed(5),
  };
}

/** Release everything. Called whenever key/pointer up events may never arrive (blur, hidden tab, overlays). */
export function resetInput() {
  input.keys.clear();
  for (const b of Object.keys(input.touch) as TouchButton[]) input.touch[b] = false;
  input.joy.x = input.joy.y = 0;
}

export function readDriveInput() {
  const k = input.keys;
  const t = input.touch;
  const p = readGamepad();
  let throttle = Number(t.gas) - Number(t.reverse) + input.joy.y + p.throttle;
  // steer is +1 for left, so pushing the stick right steers negative
  let steer = Number(t.left) - Number(t.right) - input.joy.x + p.steer;
  if (k.has('KeyW') || k.has('ArrowUp')) throttle += 1;
  if (k.has('KeyS') || k.has('ArrowDown')) throttle -= 1;
  if (k.has('KeyA') || k.has('ArrowLeft')) steer += 1;
  if (k.has('KeyD') || k.has('ArrowRight')) steer -= 1;
  throttle = Math.max(-1, Math.min(1, throttle));
  steer = Math.max(-1, Math.min(1, steer));
  if (Math.abs(throttle) < THROTTLE_DEAD) throttle = 0;
  if (Math.abs(steer) < STEER_DEAD) steer = 0;
  return {
    throttle,
    steer,
    brake: k.has('KeyB') || k.has('ControlLeft') || t.brake || p.brake,
    // held, not tapped: the car decides on the press edge so holding Space never bunny-hops
    jump: k.has('Space') || t.jump || p.jump,
    boost: k.has('ShiftLeft') || k.has('ShiftRight') || t.boost || p.boost,
    // held, not tapped: the horn sounds for as long as H (or the touch button) is down
    horn: k.has('KeyH') || t.horn || p.horn,
  };
}

export function setTouchButton(button: TouchButton, pressed: boolean) {
  input.touch[button] = pressed;
}
