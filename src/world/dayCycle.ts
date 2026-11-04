import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { useStore, type TimeMode } from '../store';
import { dayState } from './dayState';
import { palette } from './layout';

// Day and night. `day.t` runs 0..1 (0 midnight, 0.25 dawn, 0.5 day, 0.75 dusk) and every light, the sky, the fog
// and the lamps are interpolated between four keyframes. The "day" keyframe holds exactly the values the scene
// was tuned with, so the default look is unchanged. Everything is applied per frame, never through React state.

export const TIME_PRESET: Record<Exclude<TimeMode, 'auto'>, number> = { day: 0.5, dusk: 0.75, night: 0 };
/** one full day in automatic mode */
export const DAY_SECONDS = 600;
/** how fast a preset change slides the clock, in days per second (a full half-day takes about 2 s) */
const PRESET_SPEED = 0.25;
/** scene.environmentIntensity the env map was tuned at (see EnvLighting) */
const ENV_BASE = 0.35;
/** fog distances the scene was tuned with (clear weather), and how close it comes in heavy rain */
export const FOG_NEAR = 50;
export const FOG_FAR = 115;
const RAIN_FOG_NEAR = 28;
const RAIN_FOG_FAR = 80;
/** rain fades in and out over this many seconds */
const RAIN_FADE = 5;
/** automatic weather: a shower of RAIN_SECONDS at the end of every WEATHER_PERIOD */
const WEATHER_PERIOD = 480;
const RAIN_SECONDS = 120;
const RAIN_GREY = new THREE.Color('#9AA3AD');
const RAIN_SKY = new THREE.Color('#8E98A4');

type Keyframe = {
  t: number;
  sun: string; sunIntensity: number; sunHeight: number;
  hemiSky: string; hemiGround: string; hemiIntensity: number;
  horizon: string; zenith: string; fog: string; sunGlow: number;
  lamp: number; env: number; headlight: number; cloud: number; night: number;
};

const night: Omit<Keyframe, 't'> = {
  sun: '#A9BCFF', sunIntensity: 0.55, sunHeight: 18, // moonlight
  hemiSky: '#6272A8', hemiGround: '#2E344C', hemiIntensity: 0.6,
  horizon: '#2A3A70', zenith: '#0C1536', fog: '#222F5E', sunGlow: 0.25,
  lamp: 2.6, env: 0.4, headlight: 2.6, cloud: 0.15, night: 1,
};
const KEYS: Keyframe[] = [
  { t: 0, ...night },
  {
    t: 0.25, sun: '#FFC4A0', sunIntensity: 1.5, sunHeight: 8,
    hemiSky: '#FFE1D2', hemiGround: '#A08A7E', hemiIntensity: 0.8,
    horizon: '#F2C3A8', zenith: '#90A9D6', fog: '#EBC9B5', sunGlow: 0.9,
    lamp: 1.2, env: 0.7, headlight: 1.4, cloud: 0.8, night: 0.3,
  },
  {
    // day: the values the rest of the code was written with
    t: 0.5, sun: '#FFD9A0', sunIntensity: 2.5, sunHeight: 22,
    hemiSky: '#FFE9CC', hemiGround: '#C08F62', hemiIntensity: 0.92,
    horizon: palette.sky, zenith: '#8FCFD6', fog: palette.sky, sunGlow: 1,
    lamp: 1, env: 1, headlight: 1, cloud: 1, night: 0,
  },
  {
    t: 0.75, sun: '#FF9E5E', sunIntensity: 1.7, sunHeight: 8,
    hemiSky: '#FFC9A0', hemiGround: '#9A7462', hemiIntensity: 0.8,
    horizon: '#F4A574', zenith: '#7D7FB8', fog: '#EBAA80', sunGlow: 1.2,
    lamp: 1.4, env: 0.7, headlight: 1.6, cloud: 0.7, night: 0.35,
  },
  { t: 1, ...night },
];

type Colors = 'sun' | 'hemiSky' | 'hemiGround' | 'horizon' | 'zenith' | 'fog';
const COLOR_KEYS: Colors[] = ['sun', 'hemiSky', 'hemiGround', 'horizon', 'zenith', 'fog'];
const NUMBER_KEYS = ['sunIntensity', 'sunHeight', 'hemiIntensity', 'sunGlow', 'lamp', 'env', 'headlight', 'cloud', 'night'] as const;

const keyColors = KEYS.map((k) => Object.fromEntries(COLOR_KEYS.map((c) => [c, new THREE.Color(k[c])])) as Record<Colors, THREE.Color>);

export type DaySample = Record<Colors, THREE.Color> & Record<(typeof NUMBER_KEYS)[number], number>;

/** The current look, refreshed every frame by <DayCycle />. Read it from any useFrame. */
export const daySample = {
  ...(Object.fromEntries(COLOR_KEYS.map((c) => [c, new THREE.Color()])) as Record<Colors, THREE.Color>),
  ...(Object.fromEntries(NUMBER_KEYS.map((n) => [n, 0])) as Record<(typeof NUMBER_KEYS)[number], number>),
} as DaySample;

/** Fills `out` with the look at time t (0..1), easing smoothly between neighbouring keyframes. */
export function sampleDay(t: number, out: DaySample = daySample) {
  const tt = THREE.MathUtils.euclideanModulo(t, 1);
  let i = 0;
  while (i < KEYS.length - 2 && tt > KEYS[i + 1].t) i++;
  const a = KEYS[i];
  const b = KEYS[i + 1];
  const u = THREE.MathUtils.smoothstep(tt, a.t, b.t);
  for (const c of COLOR_KEYS) out[c].lerpColors(keyColors[i][c], keyColors[i + 1][c], u);
  for (const n of NUMBER_KEYS) out[n] = THREE.MathUtils.lerp(a[n], b[n], u);
  return out;
}

const startMode = useStore.getState().timeMode;
const startWeather = useStore.getState().weather;
export const day = {
  t: startMode === 'auto' ? TIME_PRESET.day : TIME_PRESET[startMode],
  /** 0..1, eased towards the weather's target */
  rain: startWeather === 'rain' ? 1 : 0,
  /** seconds into the automatic weather period */
  weatherClock: 0,
};

/** Rain darkens the sun, greys out the sky and pulls the fog in. Applied on top of the time-of-day sample. */
function applyRain(s: DaySample, rain: number) {
  if (rain <= 0) return;
  s.sunIntensity *= 1 - 0.4 * rain;
  s.sunGlow *= 1 - 0.8 * rain;
  // the fill light has to drop too, or the env map keeps the island looking sunny under the clouds
  s.hemiIntensity *= 1 - 0.35 * rain;
  s.env *= 1 - 0.5 * rain;
  // keep night dark: the grey is mixed in less where the sky is already deep blue
  const grey = 0.6 * rain * (1 - 0.6 * s.night);
  s.fog.lerp(RAIN_GREY, grey);
  s.horizon.lerp(RAIN_GREY, grey);
  s.zenith.lerp(RAIN_SKY, grey);
  s.hemiSky.lerp(RAIN_GREY, grey * 0.5);
}
sampleDay(day.t);
applyRain(daySample, day.rain);
dayState.night = daySample.night;
dayState.rain = day.rain;

// Materials that follow the time of day. They register themselves once with their tuned (daytime) value.
const lamps = new Set<{ m: THREE.MeshStandardMaterial; base: number }>();
const headlights = new Set<{ m: THREE.Material; base: number }>();
const clouds = new Set<{ m: THREE.MeshStandardMaterial; base: number }>();

/** Street and garden lamp bulbs: glow harder after dark. */
export function trackLamp<T extends THREE.MeshStandardMaterial>(m: T) {
  lamps.add({ m, base: m.emissiveIntensity });
  return m;
}
/** The jeep's headlight pool on the ground: brighter at night. */
export function trackHeadlight<T extends THREE.Material>(m: T) {
  headlights.add({ m, base: m.opacity });
  return m;
}
/** Clouds are slightly self-lit by day; at night that would make them glow, so it fades out. */
export function trackCloud<T extends THREE.MeshStandardMaterial>(m: T) {
  clouds.add({ m, base: m.emissiveIntensity });
  return m;
}

/** Shortest signed step from a to b on the 0..1 circle. */
const circularDelta = (a: number, b: number) => THREE.MathUtils.euclideanModulo(b - a + 0.5, 1) - 0.5;

/** Advances the clock (automatic mode) or slides it to the chosen preset, then updates everything that follows it. */
export function DayCycle() {
  const scene = useThree((s) => s.scene);
  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.1);
    const { timeMode: mode, weather } = useStore.getState();
    day.weatherClock = (day.weatherClock + dt) % WEATHER_PERIOD;
    const wantRain = weather === 'rain' || (weather === 'auto' && day.weatherClock > WEATHER_PERIOD - RAIN_SECONDS);
    day.rain = THREE.MathUtils.clamp(day.rain + (wantRain ? 1 : -1) * (dt / RAIN_FADE), 0, 1);
    dayState.rain = day.rain;
    if (mode === 'auto') day.t = THREE.MathUtils.euclideanModulo(day.t + dt / DAY_SECONDS, 1);
    else {
      const d = circularDelta(day.t, TIME_PRESET[mode]);
      const step = PRESET_SPEED * dt;
      day.t = THREE.MathUtils.euclideanModulo(Math.abs(d) <= step ? TIME_PRESET[mode] : day.t + Math.sign(d) * step, 1);
    }
    const s = sampleDay(day.t);
    applyRain(s, day.rain);
    dayState.night = s.night;
    if (scene.background instanceof THREE.Color) scene.background.copy(s.fog);
    if (scene.fog instanceof THREE.Fog) {
      scene.fog.color.copy(s.fog);
      scene.fog.near = THREE.MathUtils.lerp(FOG_NEAR, RAIN_FOG_NEAR, day.rain);
      scene.fog.far = THREE.MathUtils.lerp(FOG_FAR, RAIN_FOG_FAR, day.rain);
    }
    scene.environmentIntensity = ENV_BASE * s.env;
    for (const l of lamps) l.m.emissiveIntensity = l.base * s.lamp;
    for (const h of headlights) h.m.opacity = Math.min(1, h.base * s.headlight);
    for (const c of clouds) c.m.emissiveIntensity = c.base * s.cloud;
  });
  return null;
}
