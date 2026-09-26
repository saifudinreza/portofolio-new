import { create } from 'zustand';
import type { ZoneId } from './world/layout';

/** Something the car is currently parked on: a project pad, the warehouse, etc. */
export type Spot =
  | { kind: 'project'; id: string }
  | { kind: 'skills' }
  | { kind: 'about' }
  | { kind: 'contact'; id: 'github' | 'linkedin' | 'email' };

type State = {
  started: boolean;
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
};

export const useStore = create<State>((set) => ({
  started: false,
  classicOpen: false,
  spot: null,
  teleport: null,
  speed: 0,
  start: () => set({ started: true }),
  setClassic: (open) => set({ classicOpen: open }),
  setSpot: (spot) => set({ spot }),
  clearSpotIf: (match) => set((s) => (s.spot && match(s.spot) ? { spot: null } : {})),
  teleportTo: (zone) => set({ teleport: { zone, nonce: Date.now() }, spot: null }),
  setSpeed: (v) => set({ speed: v }),
}));

/**
 * Driving input. Kept outside React state on purpose: it is read every frame
 * by the car and written by keyboard + touch handlers, so it must not re-render.
 */
export const input = {
  forward: 0, // -1..1 from touch
  steer: 0, // -1..1 from touch
  keys: new Set<string>(),
  resetRequested: false,
  honk: false,
};

export function readDriveInput() {
  const k = input.keys;
  let throttle = input.forward;
  let steer = input.steer;
  if (k.has('KeyW') || k.has('ArrowUp')) throttle += 1;
  if (k.has('KeyS') || k.has('ArrowDown')) throttle -= 1;
  if (k.has('KeyA') || k.has('ArrowLeft')) steer += 1;
  if (k.has('KeyD') || k.has('ArrowRight')) steer -= 1;
  return {
    throttle: Math.max(-1, Math.min(1, throttle)),
    steer: Math.max(-1, Math.min(1, steer)),
    brake: k.has('Space'),
    boost: k.has('ShiftLeft') || k.has('ShiftRight'),
  };
}

export function setTouchInput(axis: 'forward' | 'steer', value: number) {
  input[axis] = value;
}
