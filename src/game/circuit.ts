import { create } from 'zustand';
import { circuitGates } from '../world/layout';
import { CIRCUIT_FAST_SECONDS, unlock } from './achievements';

// Local time trial. Driving through gate 0 starts a lap; the other gates must follow in order, then gate 0 again
// finishes it. Respawning, teleporting, the End button or a minute without a gate all cancel the lap.

const BEST_KEY = 'zare-world-circuit-best';
const IDLE_CANCEL_MS = 60_000;

function loadBest(): number | null {
  try {
    const v = Number(localStorage.getItem(BEST_KEY));
    return Number.isFinite(v) && v > 0 ? v : null;
  } catch {
    return null;
  }
}

type Circuit = {
  active: boolean;
  /** index of the gate to drive through next (0 = the finish once a lap is running) */
  next: number;
  startedAt: number;
  lastGateAt: number;
  best: number | null;
  /** the lap just finished, shown for a few seconds */
  last: { time: number; record: boolean } | null;
};

export const useCircuit = create<Circuit>(() => ({ active: false, next: 0, startedAt: 0, lastGateAt: 0, best: loadBest(), last: null }));

let lastTimer = 0;

export function passGate(index: number) {
  const s = useCircuit.getState();
  const now = performance.now();
  if (!s.active) {
    if (index === 0) useCircuit.setState({ active: true, next: 1, startedAt: now, lastGateAt: now, last: null });
    return;
  }
  // gates out of order simply don't count
  if (index !== s.next) return;
  if (index !== 0) {
    useCircuit.setState({ next: (index + 1) % circuitGates.length, lastGateAt: now });
    return;
  }
  const time = (now - s.startedAt) / 1000;
  const record = s.best === null || time < s.best;
  if (record) {
    try {
      localStorage.setItem(BEST_KEY, String(time));
    } catch {
      // not remembered
    }
  }
  useCircuit.setState({ active: false, next: 0, best: record ? time : s.best, last: { time, record } });
  unlock('circuit');
  if (time < CIRCUIT_FAST_SECONDS) unlock('circuit-fast');
  window.clearTimeout(lastTimer);
  lastTimer = window.setTimeout(() => useCircuit.setState({ last: null }), 5000);
}

export function cancelLap() {
  if (useCircuit.getState().active) useCircuit.setState({ active: false, next: 0 });
}

/** Called from the HUD's animation loop: drop a lap that has been abandoned. */
export function checkIdle(now: number) {
  const s = useCircuit.getState();
  if (s.active && now - s.lastGateAt > IDLE_CANCEL_MS) cancelLap();
}
