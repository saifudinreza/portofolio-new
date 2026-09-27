import { create } from 'zustand';
import type { ZoneId } from './world/layout';

/** Something the car is currently parked on: a project pad, the warehouse, etc. */
export type Spot =
  | { kind: 'project'; id: string }
  | { kind: 'skills' }
  | { kind: 'about' }
  | { kind: 'contact'; id: 'github' | 'linkedin' | 'email' };

const AUDIO_KEY = 'zare-world-audio';

/** Mute + volume survive reloads; storage can be missing or blocked, so fall back quietly. */
function loadAudioPrefs() {
  try {
    const saved = JSON.parse(localStorage.getItem(AUDIO_KEY) ?? '{}') as { muted?: unknown; volume?: unknown };
    const volume = typeof saved.volume === 'number' ? Math.min(1, Math.max(0, saved.volume)) : 0.7;
    return { muted: saved.muted === true, volume };
  } catch {
    return { muted: false, volume: 0.7 };
  }
}

function saveAudioPrefs(prefs: { muted: boolean; volume: number }) {
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
  setLoad: (progress: number, done: boolean) => void;
  muted: boolean;
  volume: number;
  classicOpen: boolean;
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
  setLoad: (loadProgress, loadDone) => set({ loadProgress, loadDone }),
  ...loadAudioPrefs(),
  classicOpen: false,
  spot: null,
  teleport: null,
  speed: 0,
  start: () => set({ started: true }),
  setClassic: (open) => {
    // Keys held while the classic view opens would never see their keyup.
    if (open) resetInput();
    set({ classicOpen: open });
  },
  setSpot: (spot) => set({ spot }),
  clearSpotIf: (match) => set((s) => (s.spot && match(s.spot) ? { spot: null } : {})),
  teleportTo: (zone) => set({ teleport: { zone, nonce: Date.now() }, spot: null }),
  setSpeed: (v) => set({ speed: v }),
  setMuted: (muted) => {
    set({ muted });
    saveAudioPrefs({ muted, volume: get().volume });
  },
  setVolume: (volume) => {
    // dragging the slider up from zero also unmutes, like most players
    const muted = volume > 0 ? false : get().muted;
    set({ volume, muted });
    saveAudioPrefs({ muted, volume });
  },
}));

/**
 * Driving input. Kept outside React state on purpose: it is read every frame
 * by the car and written by keyboard + touch handlers, so it must not re-render.
 */
export type TouchButton = 'left' | 'right' | 'gas' | 'reverse' | 'horn' | 'boost';

export const input = {
  // Each pedal keeps its own state so releasing one never cancels another that is still held.
  touch: { left: false, right: false, gas: false, reverse: false, horn: false, boost: false } as Record<TouchButton, boolean>,
  /** Virtual joystick, −1..1 each way: x right, y forward. Zero when released. */
  joy: { x: 0, y: 0 },
  keys: new Set<string>(),
  resetRequested: false,
};

/** Release everything. Called whenever key/pointer up events may never arrive (blur, hidden tab, overlays). */
export function resetInput() {
  input.keys.clear();
  for (const b of Object.keys(input.touch) as TouchButton[]) input.touch[b] = false;
  input.joy.x = input.joy.y = 0;
}

export function readDriveInput() {
  const k = input.keys;
  const t = input.touch;
  let throttle = Number(t.gas) - Number(t.reverse) + input.joy.y;
  // steer is +1 for left, so pushing the stick right steers negative
  let steer = Number(t.left) - Number(t.right) - input.joy.x;
  if (k.has('KeyW') || k.has('ArrowUp')) throttle += 1;
  if (k.has('KeyS') || k.has('ArrowDown')) throttle -= 1;
  if (k.has('KeyA') || k.has('ArrowLeft')) steer += 1;
  if (k.has('KeyD') || k.has('ArrowRight')) steer -= 1;
  return {
    throttle: Math.max(-1, Math.min(1, throttle)),
    steer: Math.max(-1, Math.min(1, steer)),
    brake: k.has('Space'),
    boost: k.has('ShiftLeft') || k.has('ShiftRight') || t.boost,
    // held, not tapped: the horn sounds for as long as H (or the touch button) is down
    horn: k.has('KeyH') || t.horn,
  };
}

export function setTouchButton(button: TouchButton, pressed: boolean) {
  input.touch[button] = pressed;
}
