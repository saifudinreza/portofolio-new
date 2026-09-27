// All game audio is synthesised with WebAudio, no audio files needed.
// One context, one master gain: mute/volume, hidden tabs and the classic view all just move that gain
// (then suspend the context), so nothing ever cuts off mid-waveform and pops.
import { useStore } from '../store';

export type Vec3 = { x: number; y: number; z: number };

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let engine: ReturnType<typeof createEngine> | null = null;
let suspendTimer = 0;

const audible = () => {
  const s = useStore.getState();
  return s.started && !s.classicOpen && !document.hidden;
};
const level = () => (audible() && !useStore.getState().muted ? useStore.getState().volume : 0);

/** Fade the master to wherever it should be; suspend the context once it is silent to stop all processing. */
function sync() {
  if (!ctx || !master) return;
  const target = level();
  master.gain.setTargetAtTime(target, ctx.currentTime, 0.04);
  clearTimeout(suspendTimer);
  if (target > 0) {
    if (ctx.state === 'suspended') void ctx.resume();
  } else {
    const c = ctx;
    suspendTimer = window.setTimeout(() => level() === 0 && c.state === 'running' && void c.suspend(), 250);
  }
}

/** Browsers only allow audio after a user gesture, so the context is created when "Start driving" is pressed. */
function unlock() {
  if (ctx) return;
  try {
    ctx = new AudioContext();
    master = ctx.createGain();
    master.gain.value = 0;
    const limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -10;
    limiter.ratio.value = 8;
    master.connect(limiter).connect(ctx.destination);
    engine = createEngine(ctx, master);
    void ctx.resume();
  } catch {
    // Audio is a nice-to-have; ignore browsers that block it.
    ctx = null;
    master = null;
  }
}

if (typeof document !== 'undefined') {
  useStore.subscribe((s, prev) => {
    // Runs synchronously inside the click/keydown that called start(), which counts as the user gesture.
    if (s.started && !prev.started) unlock();
    if (s.started !== prev.started || s.classicOpen !== prev.classicOpen || s.muted !== prev.muted || s.volume !== prev.volume) sync();
  });
  document.addEventListener('visibilitychange', sync);
}

// ---------- positional helpers ----------

function setParam(param: AudioParam, value: number, now: number, tc = 0.03) {
  param.setTargetAtTime(value, now, tc);
}

/** Panner whose volume and left/right follow the listener (the camera). */
function makePanner(c: AudioContext, dest: AudioNode, at?: Vec3) {
  const p = c.createPanner();
  p.panningModel = 'equalpower';
  p.distanceModel = 'inverse';
  p.refDistance = 16; // roughly the camera's distance to the car, so the car plays at full level
  p.rolloffFactor = 1.2;
  if (at) {
    p.positionX.value = at.x;
    p.positionY.value = at.y;
    p.positionZ.value = at.z;
  }
  p.connect(dest);
  return p;
}

/** Keep the WebAudio listener on the camera. Call every frame with the camera position and its forward/up vectors. */
export function updateListener(pos: Vec3, forward: Vec3, up: Vec3) {
  if (!ctx || ctx.state !== 'running') return;
  const l = ctx.listener;
  const now = ctx.currentTime;
  if (l.positionX) {
    setParam(l.positionX, pos.x, now, 0.02);
    setParam(l.positionY, pos.y, now, 0.02);
    setParam(l.positionZ, pos.z, now, 0.02);
    setParam(l.forwardX, forward.x, now, 0.02);
    setParam(l.forwardY, forward.y, now, 0.02);
    setParam(l.forwardZ, forward.z, now, 0.02);
    setParam(l.upX, up.x, now, 0.02);
    setParam(l.upY, up.y, now, 0.02);
    setParam(l.upZ, up.z, now, 0.02);
  } else {
    // Firefox has no AudioParams on the listener yet
    l.setPosition(pos.x, pos.y, pos.z);
    l.setOrientation(forward.x, forward.y, forward.z, up.x, up.y, up.z);
  }
}

/** Where a one-shot should play: through a panner at `at`, or straight to the master when there is no position. */
function oneShotOut(at?: Vec3): { c: AudioContext; out: AudioNode; done: () => void } | null {
  if (!ctx || !master || ctx.state !== 'running') return null;
  const out = at ? makePanner(ctx, master, at) : master;
  return { c: ctx, out, done: () => at && out.disconnect() };
}

function noiseBuffer(c: AudioContext, seconds: number, shape: (t: number) => number) {
  const len = Math.floor(c.sampleRate * seconds);
  const buf = c.createBuffer(1, len, c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * shape(i / len);
  return buf;
}

function softClip(amount: number) {
  const curve = new Float32Array(1024);
  for (let i = 0; i < curve.length; i++) {
    const x = (i / (curve.length - 1)) * 2 - 1;
    curve[i] = Math.tanh(amount * x) / Math.tanh(amount);
  }
  return curve;
}

// ---------- engine, tyres and horn ----------

// Fake gearbox: top speed of each gear in m/s. Within a gear the revs climb, then drop on the shift.
const GEARS = [0, 4, 8.5, 13, 20];
const IDLE_RPM = 850;
const MAX_RPM = 6200;

function rpmForSpeed(speed: number) {
  const v = Math.abs(speed);
  let g = 0;
  while (g < GEARS.length - 2 && v > GEARS[g + 1]) g++;
  const f = Math.min(1, (v - GEARS[g]) / (GEARS[g + 1] - GEARS[g]));
  return g === 0 ? IDLE_RPM + f * 4250 : 2300 + f * 2800;
}

/**
 * A warm, band-limited "soft saw": only the first few harmonics, each falling off faster than a real saw's
 * 1/n. Raw saws and squares carry harmonics all the way up, which is what made the old engine buzzy and
 * tiring at full throttle.
 */
function engineWave(c: AudioContext) {
  const amps = [0, 1, 0.45, 0.22, 0.1, 0.045, 0.02];
  return c.createPeriodicWave(new Float32Array(amps.length), new Float32Array(amps));
}

function createEngine(c: AudioContext, dest: AudioNode) {
  const pan = makePanner(c, dest);
  const soft = engineWave(c);
  const osc = (type: OscillatorType | 'soft', gain: number, into: AudioNode, detune = 0) => {
    const o = c.createOscillator();
    const g = c.createGain();
    if (type === 'soft') o.setPeriodicWave(soft);
    else o.type = type;
    o.detune.value = detune;
    g.gain.value = gain;
    o.connect(g).connect(into);
    o.start();
    return o;
  };
  const loopNoise = () => {
    const n = c.createBufferSource();
    n.buffer = noiseBuffer(c, 2, () => 1);
    n.loop = true;
    n.start();
    return n;
  };

  // Engine: two detuned soft saws (firing frequency and its octave) plus a sine sub, "chugged" by an LFO at
  // half the firing rate, gently saturated and low-passed. Revs move the pitch, the filter and the chug together.
  const mix = c.createGain();
  const chug = c.createGain();
  chug.gain.value = 0.7;
  const shaper = c.createWaveShaper();
  shaper.curve = softClip(1.4);
  shaper.oversample = '2x';
  const lowpass = c.createBiquadFilter();
  lowpass.type = 'lowpass';
  // no resonant peak: a bump at the cutoff is what whistled as the revs swept through it
  lowpass.Q.value = 0.5;
  const body = c.createGain();
  body.gain.value = 0;
  mix.connect(chug).connect(shaper).connect(lowpass).connect(body).connect(pan);
  const saw1 = osc('soft', 0.55, mix);
  const saw2 = osc('soft', 0.22, mix, 9);
  const sub = osc('sine', 0.45, mix);
  const lfoDepth = c.createGain();
  lfoDepth.gain.value = 0.3;
  const lfo = osc('sine', 1, lfoDepth);
  lfoDepth.connect(chug.gain);
  const rumbleFilter = c.createBiquadFilter();
  rumbleFilter.type = 'bandpass';
  rumbleFilter.frequency.value = 450;
  rumbleFilter.Q.value = 0.7;
  const rumbleGain = c.createGain();
  rumbleGain.gain.value = 0.05;
  loopNoise().connect(rumbleFilter).connect(rumbleGain).connect(mix);

  // Turbo whine that only shows up while boosting.
  const whineGain = c.createGain();
  whineGain.gain.value = 0;
  whineGain.connect(pan);
  const whine = osc('sine', 1, whineGain);

  // Tyre squeal under braking: band-passed noise.
  const skidFilter = c.createBiquadFilter();
  skidFilter.type = 'bandpass';
  skidFilter.frequency.value = 1600;
  skidFilter.Q.value = 3;
  const skidGain = c.createGain();
  skidGain.gain.value = 0;
  loopNoise().connect(skidFilter).connect(skidGain).connect(pan);

  // Horn: two slightly detuned saw pairs a third apart, like a real dual-tone horn, through a
  // resonant "trumpet" peak and a little grit. Always running; only its gain opens and closes.
  const hornMix = c.createGain();
  const hornPeak = c.createBiquadFilter();
  hornPeak.type = 'peaking';
  hornPeak.frequency.value = 1700;
  hornPeak.Q.value = 1.5;
  hornPeak.gain.value = 8;
  const hornLow = c.createBiquadFilter();
  hornLow.type = 'lowpass';
  hornLow.frequency.value = 3200;
  const hornShaper = c.createWaveShaper();
  hornShaper.curve = softClip(1.8);
  const hornGain = c.createGain();
  hornGain.gain.value = 0;
  hornMix.connect(hornPeak).connect(hornLow).connect(hornShaper).connect(hornGain).connect(pan);
  for (const [freq, detune] of [[405, -6], [405, 6], [507, -5], [507, 5]] as const) {
    osc('sawtooth', 0.22, hornMix, detune).frequency.value = freq;
  }

  let rpm = IDLE_RPM;
  let horn = false;

  return {
    update(s: { x: number; y: number; z: number; speed: number; throttle: number; boost: boolean; brake: boolean; grounded: boolean; horn: boolean; dt: number }) {
      const now = c.currentTime;
      const load = Math.abs(s.throttle);
      const boost = s.boost && load > 0 ? 1 : 0;

      let target = rpmForSpeed(s.speed);
      if (load > 0) target = Math.max(target, 1800) + (s.grounded ? 400 : 2200) + boost * 600;
      else target *= 0.9; // lifting off: engine braking pulls the revs down
      target = Math.min(MAX_RPM, Math.max(IDLE_RPM, target));
      rpm += (target - rpm) * (1 - Math.exp(-s.dt * (target > rpm ? 5 : 3)));

      const firing = (rpm / 60) * 2; // four-cylinder four-stroke: two firings per revolution
      setParam(saw1.frequency, firing, now);
      setParam(saw2.frequency, firing * 2, now);
      setParam(sub.frequency, firing / 2, now);
      setParam(lfo.frequency, firing / 2, now);
      // capped well below the range the ear finds harsh, even at full revs and boost
      setParam(lowpass.frequency, Math.min(1500, 200 + rpm * 0.18 + load * 220 + boost * 300), now);
      setParam(body.gain, 0.09 + load * 0.05 + boost * 0.025, now, 0.12);
      setParam(whine.frequency, 1100 + rpm * 0.35, now);
      setParam(whineGain.gain, boost * 0.01, now, 0.4);

      const skidding = s.brake && s.grounded && Math.abs(s.speed) > 2;
      setParam(skidGain.gain, skidding ? Math.min(Math.abs(s.speed) / 10, 1) * 0.11 : 0, now, skidding ? 0.08 : 0.12);
      setParam(skidFilter.frequency, 1300 + Math.abs(s.speed) * 25, now);

      if (s.horn !== horn) {
        horn = s.horn;
        // quick attack, slightly softer release, both ramps so there's no click
        setParam(hornGain.gain, horn ? 0.3 : 0, now, horn ? 0.012 : 0.04);
      }

      setParam(pan.positionX, s.x, now, 0.02);
      setParam(pan.positionY, s.y, now, 0.02);
      setParam(pan.positionZ, s.z, now, 0.02);
    },
  };
}

/** Called by the car every frame. Does nothing until audio has been unlocked and while it is suspended. */
export function updateCarAudio(s: Parameters<ReturnType<typeof createEngine>['update']>[0]) {
  if (!ctx || ctx.state !== 'running' || !engine) return;
  engine.update(s);
}

// ---------- collisions ----------

/** What a collider is made of, set as `userData.material` on its RigidBody. Picks the impact sound and debris. */
export type SurfaceMaterial = 'wood' | 'plastic' | 'metal' | 'heavy' | 'ground' | 'foliage' | 'stone' | 'npc';

type Tone = { freq: number; decay: number; gain: number; type?: OscillatorType; drop?: number };
type Strike = { partials: Tone[]; noise?: { freq: number; q: number; decay: number; gain: number; type?: BiquadFilterType } };

// Each material is a few decaying partials plus a filtered noise "strike". Metal gets long inharmonic
// ringing, wood short hollow knocks, plastic a bright bonk, heavy things a low thump.
const strikes: Record<Exclude<SurfaceMaterial, 'foliage'>, Strike> = {
  wood: {
    partials: [{ freq: 190, decay: 0.16, gain: 0.35, type: 'triangle' }, { freq: 430, decay: 0.09, gain: 0.2 }, { freq: 1020, decay: 0.04, gain: 0.08 }],
    noise: { freq: 1600, q: 1.2, decay: 0.04, gain: 0.25 },
  },
  plastic: {
    partials: [{ freq: 540, decay: 0.12, gain: 0.28, type: 'triangle', drop: 0.7 }, { freq: 1250, decay: 0.05, gain: 0.08 }],
    noise: { freq: 3200, q: 0.8, decay: 0.03, gain: 0.15, type: 'highpass' },
  },
  metal: {
    partials: [
      { freq: 221, decay: 1.1, gain: 0.18 },
      { freq: 563, decay: 0.8, gain: 0.14 },
      { freq: 1041, decay: 0.6, gain: 0.1 },
      { freq: 1717, decay: 0.4, gain: 0.07 },
      { freq: 2690, decay: 0.25, gain: 0.05 },
    ],
    noise: { freq: 4000, q: 0.7, decay: 0.05, gain: 0.2 },
  },
  heavy: {
    partials: [{ freq: 90, decay: 0.3, gain: 0.5, drop: 0.5 }, { freq: 170, decay: 0.12, gain: 0.15 }],
    noise: { freq: 450, q: 0.7, decay: 0.12, gain: 0.3, type: 'lowpass' },
  },
  ground: {
    partials: [{ freq: 70, decay: 0.25, gain: 0.45, drop: 0.55 }],
    noise: { freq: 700, q: 0.6, decay: 0.15, gain: 0.25, type: 'lowpass' },
  },
  stone: {
    partials: [{ freq: 320, decay: 0.07, gain: 0.25 }, { freq: 890, decay: 0.04, gain: 0.1 }],
    noise: { freq: 2600, q: 1.5, decay: 0.06, gain: 0.3 },
  },
  npc: {
    // soft cartoon "pwomp", never a painful sound
    partials: [{ freq: 260, decay: 0.18, gain: 0.3, type: 'sine', drop: 0.55 }, { freq: 520, decay: 0.08, gain: 0.06, type: 'sine' }],
  },
};

/**
 * Collision sound for `material`. `strength` 0..1 scales loudness and nudges the pitch up, so a tap is a
 * quiet low knock and a crash is a loud bright one.
 */
export function impact(material: SurfaceMaterial, strength: number, at?: Vec3) {
  if (material === 'foliage') return thud(strength, at);
  const o = oneShotOut(at);
  if (!o) return;
  const { c, out, done } = o;
  const now = c.currentTime;
  const s = strikes[material];
  const loud = 0.15 + 0.85 * strength ** 0.8;
  const pitch = 0.85 + 0.3 * strength + (Math.random() - 0.5) * 0.06; // slight random detune so repeats don't sound cloned
  let last: AudioScheduledSourceNode | null = null;
  let longest = 0;

  for (const p of s.partials) {
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = p.type ?? 'sine';
    osc.frequency.setValueAtTime(p.freq * pitch, now);
    if (p.drop) osc.frequency.exponentialRampToValueAtTime(p.freq * pitch * p.drop, now + p.decay);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(p.gain * loud, now + 0.004);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + p.decay);
    osc.connect(gain).connect(out);
    osc.start(now);
    osc.stop(now + p.decay + 0.02);
    if (p.decay > longest) {
      longest = p.decay;
      last = osc;
    }
  }
  if (s.noise) {
    const n = s.noise;
    const src = c.createBufferSource();
    const filter = c.createBiquadFilter();
    const gain = c.createGain();
    src.buffer = noiseBuffer(c, n.decay + 0.02, (t) => (1 - t) ** 2);
    filter.type = n.type ?? 'bandpass';
    filter.frequency.value = n.freq * pitch;
    filter.Q.value = n.q;
    gain.gain.value = n.gain * loud;
    src.connect(filter).connect(gain).connect(out);
    src.start(now);
    if (n.decay > longest) last = src;
  }
  if (last) last.onended = done;
}

// ---------- one-shots ----------

/** Dull knock plus a leafy rustle for bumping into a tree; strength 0..1. */
function thud(strength = 1, at?: Vec3) {
  const o = oneShotOut(at);
  if (!o) return;
  const { c, out, done } = o;
  const now = c.currentTime;
  const knock = c.createOscillator();
  const knockGain = c.createGain();
  knock.frequency.setValueAtTime(140, now);
  knock.frequency.exponentialRampToValueAtTime(50, now + 0.2);
  knockGain.gain.setValueAtTime(0.3 * strength + 0.01, now);
  knockGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.25);
  knock.connect(knockGain).connect(out);
  knock.start(now);
  knock.stop(now + 0.26);

  const rustle = c.createBufferSource();
  const filter = c.createBiquadFilter();
  const rustleGain = c.createGain();
  rustle.buffer = noiseBuffer(c, 0.4, (t) => (1 - t) ** 2);
  filter.type = 'bandpass';
  filter.frequency.value = 2800;
  rustleGain.gain.value = 0.15 * strength;
  rustle.connect(filter).connect(rustleGain).connect(out);
  rustle.start(now + 0.02);
  rustle.onended = done;
}

/** Watery splash for driving into the pond; strength 0..1. */
export function splash(strength = 1, at?: Vec3) {
  const o = oneShotOut(at);
  if (!o) return;
  const { c, out, done } = o;
  const now = c.currentTime;
  const src = c.createBufferSource();
  const filter = c.createBiquadFilter();
  const gain = c.createGain();
  src.buffer = noiseBuffer(c, 0.6, (t) => (1 - t) ** 3);
  filter.type = 'lowpass';
  filter.Q.value = 4;
  filter.frequency.setValueAtTime(3200, now);
  filter.frequency.exponentialRampToValueAtTime(400, now + 0.5);
  gain.gain.value = 0.25 * strength;
  src.connect(filter).connect(gain).connect(out);
  src.start(now);
  src.onended = done;
}

/** Cartoon "boing" for bumping into a pedestrian; kept silly, never painful. */
export function boing(at?: Vec3) {
  const o = oneShotOut(at);
  if (!o) return;
  const { c, out, done } = o;
  const now = c.currentTime;
  const osc = c.createOscillator();
  const wobble = c.createOscillator();
  const wobbleGain = c.createGain();
  const gain = c.createGain();
  osc.type = 'triangle';
  osc.frequency.setValueAtTime(180, now);
  osc.frequency.exponentialRampToValueAtTime(620, now + 0.12);
  osc.frequency.exponentialRampToValueAtTime(300, now + 0.45);
  wobble.frequency.value = 22;
  wobbleGain.gain.value = 40;
  wobble.connect(wobbleGain).connect(osc.frequency);
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(0.18, now + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.5);
  osc.connect(gain).connect(out);
  osc.start(now);
  wobble.start(now);
  osc.stop(now + 0.52);
  wobble.stop(now + 0.52);
  osc.onended = done;
}
