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
 * Graphics quality. "high" adds post-processing (AO, bloom, SMAA, grading), headlight spotlights, a bigger
 * shadow map and extra particles; "low" keeps the plain renderer. Touch devices start on low.
 */
export type Quality = 'high' | 'low';
const QUALITY_KEY = 'zare-world-quality';

function loadQuality(): Quality {
  try {
    const saved = localStorage.getItem(QUALITY_KEY);
    if (saved === 'high' || saved === 'low') return saved;
  } catch {
    // fall through to the device default
  }
  return typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches ? 'low' : 'high';
}

type State = {
  started: boolean;
  quality: Quality;
  setQuality: (q: Quality) => void;
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
  quality: loadQuality(),
  setQuality: (quality) => {
    set({ quality });
    try {
      localStorage.setItem(QUALITY_KEY, quality);
    } catch {
      // not remembered, that's fine
    }
  },
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
export type TouchButton = 'left' | 'right' | 'gas' | 'reverse' | 'horn';

export const input = {
  // Each pedal keeps its own state so releasing one never cancels another that is still held.
  touch: { left: false, right: false, gas: false, reverse: false, horn: false } as Record<TouchButton, boolean>,
  keys: new Set<string>(),
  resetRequested: false,
};

/** Release everything. Called whenever key/pointer up events may never arrive (blur, hidden tab, overlays). */
export function resetInput() {
  input.keys.clear();
  for (const b of Object.keys(input.touch) as TouchButton[]) input.touch[b] = false;
}

export function readDriveInput() {
  const k = input.keys;
  const t = input.touch;
  let throttle = Number(t.gas) - Number(t.reverse);
  let steer = Number(t.left) - Number(t.right);
  if (k.has('KeyW') || k.has('ArrowUp')) throttle += 1;
  if (k.has('KeyS') || k.has('ArrowDown')) throttle -= 1;
  if (k.has('KeyA') || k.has('ArrowLeft')) steer += 1;
  if (k.has('KeyD') || k.has('ArrowRight')) steer -= 1;
  return {
    throttle: Math.max(-1, Math.min(1, throttle)),
    steer: Math.max(-1, Math.min(1, steer)),
    brake: k.has('Space'),
    boost: k.has('ShiftLeft') || k.has('ShiftRight'),
    // held, not tapped: the horn sounds for as long as H (or the touch button) is down
    horn: k.has('KeyH') || t.horn,
  };
}

export function setTouchButton(button: TouchButton, pressed: boolean) {
  input.touch[button] = pressed;
}
