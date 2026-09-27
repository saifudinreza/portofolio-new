import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { CylinderCollider, RigidBody } from '@react-three/rapier';
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { palette, pond, pondDistance, rng } from './layout';
import { actors, type Actor } from './actors';
import { splash } from '../ui/sound';
import { mossyStoneMaterial, rockGeometry } from './stone';

const MAX_RIPPLES = 12;
const FISH_COUNT = 9;
const MAX_DROPS = 90;
const LILY_COUNT = 7;
const REED_COUNT = 44;
// Beach opening on the camera side (+z) so the rim doesn't hide the water and the car can drive in.
const GAP_FROM = Math.PI / 2 - 0.6;
const GAP_TO = Math.PI / 2 + 0.6;
const SUN = new THREE.Vector3(12, 22, 8).normalize();

/** World point on the pond ellipse at angle `a` and normalised radius `r` (1 = water's edge). */
const onEllipse = (a: number, r: number): [number, number] => [pond.x + Math.cos(a) * pond.rx * r, pond.z + Math.sin(a) * pond.rz * r];

const koiColors: [string, string][] = [
  ['#F7F1E6', '#E2462B'], // kohaku: white with red
  ['#F07A28', '#FFF4E4'], // orange with white
  ['#F2B233', '#FFD86E'], // ogon: gold
  ['#F7F1E6', '#26262C'], // white with black
  ['#E2462B', '#26262C'], // red with black
  ['#B77A45', '#E1B27C'], // chagoi: brown
];

// ---------- water ----------

const waterVertex = /* glsl */ `
#include <fog_pars_vertex>
varying vec3 vWorld;
varying vec2 vLocal;
void main() {
  vLocal = position.xy;
  vec4 world = modelMatrix * vec4(position, 1.0);
  vWorld = world.xyz;
  vec4 mvPosition = viewMatrix * world;
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}
`;

const waterFragment = /* glsl */ `
#include <fog_pars_fragment>
uniform float uTime;
uniform vec4 uRipples[${MAX_RIPPLES}]; // x, z, start time, strength
uniform vec3 uShallow;
uniform vec3 uDeep;
uniform vec3 uSky;
uniform vec3 uSun;
varying vec3 vWorld;
varying vec2 vLocal;

float ripples(vec2 p) {
  float h = 0.0;
  for (int i = 0; i < ${MAX_RIPPLES}; i++) {
    vec4 r = uRipples[i];
    float age = uTime - r.z;
    if (r.w <= 0.0 || age < 0.0 || age > 2.5) continue;
    float d = length(p - r.xy);
    float front = age * 1.4;
    float env = exp(-(d - front) * (d - front) * 6.0) * (1.0 - age / 2.5) * r.w;
    h += sin((d - front) * 18.0) * 0.02 * env;
  }
  return h;
}

float waterHeight(vec2 p) {
  return sin(p.x * 1.7 + uTime * 1.2) * 0.010
    + sin(p.y * 2.3 - uTime * 0.9 + p.x * 0.7) * 0.008
    + sin((p.x - p.y) * 5.1 + uTime * 2.3) * 0.003
    + ripples(p);
}

void main() {
  vec2 p = vWorld.xz;
  float e = 0.02;
  float h = waterHeight(p);
  vec3 n = normalize(vec3(-(waterHeight(p + vec2(e, 0.0)) - h) / e, 1.0, -(waterHeight(p + vec2(0.0, e)) - h) / e));
  vec3 v = normalize(cameraPosition - vWorld);

  float r = length(vLocal);
  float depth = smoothstep(1.0, 0.25, r);
  float fresnel = 0.08 + 0.92 * pow(1.0 - max(dot(n, v), 0.0), 4.0);
  vec3 sky = mix(uSky, vec3(1.0), clamp(reflect(-v, n).y, 0.0, 1.0) * 0.4);
  float spec = pow(max(dot(reflect(-uSun, n), v), 0.0), 120.0);
  float crest = clamp(ripples(p) * 40.0, 0.0, 1.0);
  float foam = smoothstep(0.9, 1.0, r) * (0.55 + 0.45 * sin(uTime * 1.5 + atan(vLocal.y, vLocal.x) * 9.0));

  vec3 color = mix(mix(uShallow, uDeep, depth), sky, fresnel * 0.6) + spec * 1.5 + crest * 0.35;
  color = mix(color, vec3(1.0), foam * 0.6);
  float alpha = clamp(mix(0.35, 0.62, depth) + fresnel * 0.3 + spec + crest * 0.3 + foam * 0.5, 0.0, 1.0);
  gl_FragColor = vec4(color, alpha);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
  #include <fog_fragment>
}
`;

function waterMaterial() {
  return new THREE.ShaderMaterial({
    vertexShader: waterVertex,
    fragmentShader: waterFragment,
    transparent: true,
    depthWrite: false,
    fog: true,
    uniforms: THREE.UniformsUtils.merge([
      THREE.UniformsLib.fog,
      {
        uTime: { value: 0 },
        uRipples: { value: Array.from({ length: MAX_RIPPLES }, () => new THREE.Vector4()) },
        uShallow: { value: new THREE.Color('#7FCBC0') },
        uDeep: { value: new THREE.Color('#2F7F86') },
        uSky: { value: new THREE.Color(palette.sky) },
        uSun: { value: SUN },
      },
    ]),
  });
}

/** Sand with animated caustics, brightest in the middle where the water is deepest. */
function sandMaterial(time: THREE.IUniform) {
  const material = new THREE.MeshStandardMaterial({ color: '#D9BE8A', roughness: 1 });
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = time;
    shader.vertexShader = 'varying vec3 vCaustic;\n' + shader.vertexShader.replace(
      '#include <begin_vertex>',
      '#include <begin_vertex>\nvCaustic = vec3((modelMatrix * vec4(transformed, 1.0)).xz, length(position.xy));',
    );
    shader.fragmentShader = 'uniform float uTime;\nvarying vec3 vCaustic;\n' + shader.fragmentShader.replace(
      '#include <color_fragment>',
      `#include <color_fragment>
      vec2 q = vCaustic.xy * 2.2;
      float c = sin(q.x + uTime * 0.9 + sin(q.y * 1.3 + uTime * 0.7) * 1.5) + sin(q.y * 1.1 - uTime * 0.8 + sin(q.x * 1.7 - uTime * 0.5) * 1.5);
      diffuseColor.rgb += pow(1.0 - min(abs(c), 1.0), 6.0) * 0.35 * smoothstep(1.0, 0.6, vCaustic.z);`,
    );
  };
  return material;
}

// ---------- koi ----------

function finGeometry(pts: number[]) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(pts.map((_, i) => (i % 3 === 1 ? 1 : 0)), 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(new Array((pts.length / 3) * 2).fill(0), 2));
  return g;
}

/** Head points along +z. Fins are flat so the fish reads well from the top-down camera. */
function koiGeometry() {
  const body = new THREE.SphereGeometry(1, 16, 10).toNonIndexed().scale(0.07, 0.05, 0.22).translate(0, 0, 0.02);
  const tail = finGeometry([0, 0.005, -0.17, -0.12, 0, -0.4, 0, 0, -0.32, 0, 0.005, -0.17, 0, 0, -0.32, 0.12, 0, -0.4]);
  const fins = finGeometry([0.05, 0, 0.08, 0.15, -0.01, -0.01, 0.05, 0, -0.01, -0.05, 0, 0.08, -0.05, 0, -0.01, -0.15, -0.01, -0.01]);
  return mergeGeometries([body, tail, fins])!;
}

const koiVertexHead = /* glsl */ `
attribute vec3 aSwim; // phase, amplitude, pattern seed
attribute vec3 aBaseColor;
attribute vec3 aPatchColor;
varying vec3 vKoiPos;
varying vec3 vBaseColor;
varying vec3 vPatchColor;
varying float vSeed;
`;

// Travelling sine wave along the body; the tail swings far more than the head.
const koiVertexBody = /* glsl */ `
vec3 transformed = vec3(position);
float tailWeight = smoothstep(0.12, -0.38, position.z);
transformed.x += sin(position.z * 9.0 + aSwim.x) * aSwim.y * (0.25 + tailWeight);
vKoiPos = position;
vBaseColor = aBaseColor;
vPatchColor = aPatchColor;
vSeed = aSwim.z;
`;

const koiFragmentHead = /* glsl */ `
varying vec3 vKoiPos;
varying vec3 vBaseColor;
varying vec3 vPatchColor;
varying float vSeed;
`;

const koiFragmentColor = /* glsl */ `
float spots = sin(vKoiPos.z * 22.0 + vSeed * 7.0) * sin(vKoiPos.x * 40.0 + vSeed * 3.0) + sin(vKoiPos.z * 9.0 - vSeed * 5.0) * 0.8;
vec4 diffuseColor = vec4(mix(vBaseColor, vPatchColor, smoothstep(0.1, 0.3, spots)), opacity);
`;

function koiMaterial() {
  const material = new THREE.MeshStandardMaterial({ roughness: 0.45, side: THREE.DoubleSide });
  material.onBeforeCompile = (shader) => {
    shader.vertexShader = koiVertexHead + shader.vertexShader.replace('#include <begin_vertex>', koiVertexBody);
    shader.fragmentShader = (koiFragmentHead + shader.fragmentShader).replace('vec4 diffuseColor = vec4( diffuse, opacity );', koiFragmentColor);
  };
  return material;
}

type Fish = { x: number; z: number; y: number; heading: number; speed: number; cruise: number; wander: number; scare: number; phase: number; scale: number; depth: number; rise: number; nextRise: number };
type Drop = { x: number; y: number; z: number; vx: number; vy: number; vz: number; age: number; life: number; size: number };
type ActorTrack = { x: number; z: number; inside: boolean; lastRipple: number };

export function Pond() {
  const tracks = useRef(new Map<Actor, ActorTrack>());
  const rippleIndex = useRef(0);

  const scene = useMemo(() => {
    const r = rng(23);
    const water = waterMaterial();
    const time = water.uniforms.uTime;

    // Rocky rim with a sandy beach gap.
    const rocks: { x: number; z: number; s: number; yaw: number }[] = [];
    for (let a = 0; a < Math.PI * 2; a += 0.16 + r() * 0.06) {
      if (a > GAP_FROM && a < GAP_TO) continue;
      const [x, z] = onEllipse(a, 1.03 + r() * 0.07);
      rocks.push({ x, z, s: 0.3 + r() * 0.35, yaw: r() * Math.PI * 2 });
    }
    const rockMesh = new THREE.InstancedMesh(rockGeometry(3, 1), mossyStoneMaterial(0.5), rocks.length);
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const e = new THREE.Euler();
    const color = new THREE.Color();
    rocks.forEach((k, i) => {
      rockMesh.setMatrixAt(i, m.compose(new THREE.Vector3(k.x, k.s * 0.2, k.z), q.setFromEuler(e.set(0, k.yaw, 0)), new THREE.Vector3(k.s, k.s * 0.6, k.s * 0.9)));
      rockMesh.setColorAt(i, color.set(palette.rock).offsetHSL(0, 0, (r() - 0.5) * 0.12));
    });
    rockMesh.castShadow = true;
    rockMesh.receiveShadow = true;

    // Lily pads (notched discs) and a few lotus flowers sitting on them.
    const pads: { x: number; z: number; s: number; yaw: number; phase: number }[] = [];
    for (let guard = 0; pads.length < LILY_COUNT && guard < 500; guard++) {
      const a = r() * Math.PI * 2;
      const [x, z] = onEllipse(a, 0.35 + r() * 0.45);
      const s = 0.25 + r() * 0.2;
      if (pads.some((p) => Math.hypot(p.x - x, p.z - z) < p.s + s + 0.3)) continue;
      pads.push({ x, z, s, yaw: r() * Math.PI * 2, phase: r() * 10 });
    }
    const padMesh = new THREE.InstancedMesh(
      new THREE.CircleGeometry(1, 18, 0.35, Math.PI * 2 - 0.35).rotateX(-Math.PI / 2),
      new THREE.MeshStandardMaterial({ roughness: 0.6, side: THREE.DoubleSide }),
      pads.length,
    );
    pads.forEach((_, i) => padMesh.setColorAt(i, color.set(palette.leaf).offsetHSL((r() - 0.5) * 0.04, 0, (r() - 0.5) * 0.1)));
    padMesh.receiveShadow = true;
    const flowerPads = pads.slice(0, 3);
    const flowerParts = [
      { geometry: new THREE.ConeGeometry(0.14, 0.14, 6, 1, true).rotateX(Math.PI).translate(0, 0.07, 0), color: '#F4A6B8' },
      { geometry: new THREE.ConeGeometry(0.08, 0.1, 5, 1, true).rotateX(Math.PI).translate(0, 0.08, 0), color: '#FCD9E1' },
      { geometry: new THREE.SphereGeometry(0.03, 6, 4).translate(0, 0.08, 0), color: palette.yellow },
    ].map(({ geometry, color: c }) => {
      const mesh = new THREE.InstancedMesh(geometry, new THREE.MeshStandardMaterial({ color: c, flatShading: true, side: THREE.DoubleSide }), flowerPads.length);
      mesh.castShadow = true;
      return mesh;
    });

    // Reeds with cattail heads, kept to the far (north) side so they frame the pond without hiding it.
    const reeds: { x: number; z: number; h: number; phase: number; head: boolean }[] = [];
    for (let i = 0; i < REED_COUNT; i++) {
      const cluster = Math.floor(r() * 4);
      const a = Math.PI + 0.35 + cluster * 0.75 + (r() - 0.5) * 0.4;
      const [x, z] = onEllipse(a, 0.94 + r() * 0.14);
      reeds.push({ x, z, h: 0.7 + r() * 0.6, phase: r() * 10, head: r() > 0.45 });
    }
    const reedMesh = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.018, 0.028, 1, 4).translate(0, 0.5, 0), new THREE.MeshStandardMaterial({ color: '#7E9A4C', flatShading: true }), reeds.length);
    const headMesh = new THREE.InstancedMesh(new THREE.CapsuleGeometry(0.035, 0.14, 2, 6), new THREE.MeshStandardMaterial({ color: '#6B4A2E' }), reeds.length);
    reedMesh.castShadow = headMesh.castShadow = true;

    // Koi.
    const fish: Fish[] = Array.from({ length: FISH_COUNT }, () => {
      const [x, z] = onEllipse(r() * Math.PI * 2, r() * 0.55);
      return { x, z, y: 0.1, heading: r() * Math.PI * 2, speed: 0.4, cruise: 0.3 + r() * 0.2, wander: 0, scare: 0, phase: r() * 10, scale: 0.8 + r() * 0.4, depth: 0.07 + r() * 0.06, rise: 0, nextRise: 3 + r() * 10 };
    });
    const fishGeometry = koiGeometry();
    const swim = new THREE.InstancedBufferAttribute(new Float32Array(FISH_COUNT * 3), 3).setUsage(THREE.DynamicDrawUsage);
    const base = new Float32Array(FISH_COUNT * 3);
    const patch = new Float32Array(FISH_COUNT * 3);
    fish.forEach((_, i) => {
      const [b, p] = koiColors[i % koiColors.length];
      color.set(b).toArray(base, i * 3);
      color.set(p).toArray(patch, i * 3);
      swim.setZ(i, r() * 10);
    });
    fishGeometry.setAttribute('aSwim', swim);
    fishGeometry.setAttribute('aBaseColor', new THREE.InstancedBufferAttribute(base, 3));
    fishGeometry.setAttribute('aPatchColor', new THREE.InstancedBufferAttribute(patch, 3));
    const fishMesh = new THREE.InstancedMesh(fishGeometry, koiMaterial(), FISH_COUNT);
    fishMesh.castShadow = true;
    fishMesh.frustumCulled = false;

    // Splash droplets.
    const dropMesh = new THREE.InstancedMesh(
      new THREE.IcosahedronGeometry(1, 0),
      new THREE.MeshStandardMaterial({ color: '#E4F6F4', roughness: 0.2, transparent: true, opacity: 0.85 }),
      MAX_DROPS,
    );
    dropMesh.frustumCulled = false;
    const hidden = new THREE.Matrix4().makeScale(0, 0, 0);
    for (let i = 0; i < MAX_DROPS; i++) dropMesh.setMatrixAt(i, hidden);
    const drops: (Drop | null)[] = Array(MAX_DROPS).fill(null);

    return { water, time, rocks, rockMesh, pads, padMesh, flowerPads, flowerParts, reeds, reedMesh, headMesh, fish, fishMesh, swim, drops, dropMesh, sand: sandMaterial(time) };
  }, []);

  const tmp = useMemo(() => ({ m: new THREE.Matrix4(), q: new THREE.Quaternion(), e: new THREE.Euler(), p: new THREE.Vector3(), s: new THREE.Vector3(), up: new THREE.Vector3() }), []);

  const addRipple = (x: number, z: number, strength: number, now: number) => {
    scene.water.uniforms.uRipples.value[rippleIndex.current].set(x, z, now, strength);
    rippleIndex.current = (rippleIndex.current + 1) % MAX_RIPPLES;
  };

  const spray = (x: number, z: number, vx: number, vz: number, count: number) => {
    const { drops } = scene;
    for (let i = 0; i < MAX_DROPS && count > 0; i++) {
      if (drops[i]) continue;
      count--;
      const a = Math.random() * Math.PI * 2;
      const out = 1 + Math.random() * 1.5;
      drops[i] = {
        x: x + Math.cos(a) * 0.7,
        y: pond.water,
        z: z + Math.sin(a) * 0.7,
        vx: vx * 0.3 + Math.cos(a) * out,
        vy: 2 + Math.random() * 2.5,
        vz: vz * 0.3 + Math.sin(a) * out,
        age: 0,
        life: 0.6 + Math.random() * 0.5,
        size: 0.04 + Math.random() * 0.05,
      };
    }
  };

  useFrame(({ clock }, rawDt) => {
    const dt = Math.min(rawDt, 1 / 30);
    const now = clock.elapsedTime;
    const { m, q, e, p, s, up } = tmp;
    scene.time.value = now;

    // Actors near or in the water: ripples as they approach, splash + spray when they drive in.
    const moving: { x: number; z: number; speed: number }[] = [];
    for (const a of actors) {
      let t = tracks.current.get(a);
      if (!t) {
        t = { x: a.x, z: a.z, inside: false, lastRipple: 0 };
        tracks.current.set(a, t);
      }
      const vx = (a.x - t.x) / Math.max(rawDt, 1e-3);
      const vz = (a.z - t.z) / Math.max(rawDt, 1e-3);
      const speed = Math.hypot(vx, vz);
      t.x = a.x;
      t.z = a.z;
      const d = pondDistance(a.x, a.z);
      moving.push({ x: a.x, z: a.z, speed });
      const inside = a.radius > 0 && d < 1;
      if (inside) {
        if (!t.inside && speed > 1.5) {
          splash(Math.min(speed / 12, 1), { x: a.x, y: pond.water, z: a.z });
          spray(a.x, a.z, vx, vz, 10 + Math.floor(speed * 2));
          addRipple(a.x, a.z, 1, now);
          t.lastRipple = now;
        }
        if (speed > 1) {
          spray(a.x, a.z, vx, vz, Math.random() < speed * dt * 4 ? 2 : 0);
          if (now - t.lastRipple > 0.2) {
            addRipple(a.x, a.z, Math.min(speed / 8, 1), now);
            t.lastRipple = now;
          }
        }
      } else if (d < 1.35 && speed > 2 && now - t.lastRipple > 0.5) {
        // footsteps / engine rumble on the bank make small rings at the nearest shore point
        const k = 0.95 / d;
        addRipple(pond.x + (a.x - pond.x) * k, pond.z + (a.z - pond.z) * k, 0.35, now);
        t.lastRipple = now;
      }
      t.inside = inside;
    }

    // Koi: wander, stay inside the ellipse, keep apart, flee from anything nearby.
    const { fish, fishMesh, swim } = scene;
    fish.forEach((f, i) => {
      const dirX = Math.sin(f.heading);
      const dirZ = Math.cos(f.heading);
      f.wander = THREE.MathUtils.clamp(f.wander + (Math.random() - 0.5) * dt * 3, -1, 1);
      let sx = Math.sin(f.heading + f.wander);
      let sz = Math.cos(f.heading + f.wander);

      const ahead = pondDistance(f.x + dirX * 0.9, f.z + dirZ * 0.9);
      if (ahead > 0.6) {
        const cx = pond.x - f.x;
        const cz = pond.z - f.z;
        const cl = Math.hypot(cx, cz) || 1;
        sx += (cx / cl) * (ahead - 0.6) * 8;
        sz += (cz / cl) * (ahead - 0.6) * 8;
      }
      for (const o of fish) {
        if (o === f) continue;
        const dx = f.x - o.x;
        const dz = f.z - o.z;
        const d = Math.hypot(dx, dz);
        if (d < 0.5 && d > 1e-4) {
          sx += (dx / d) * (0.5 - d) * 4;
          sz += (dz / d) * (0.5 - d) * 4;
        } else if (d < 1.5) {
          sx += Math.sin(o.heading) * 0.15;
          sz += Math.cos(o.heading) * 0.15;
        }
      }
      for (const a of moving) {
        const dx = f.x - a.x;
        const dz = f.z - a.z;
        const d = Math.hypot(dx, dz);
        const range = 4 + Math.min(a.speed, 10) * 0.2;
        // someone sitting still on the bank is ignored; only movement scares the koi
        if (d > range || d < 1e-4 || a.speed < 0.3) continue;
        const k = 1 - d / range;
        sx += (dx / d) * k * 6;
        sz += (dz / d) * k * 6;
        f.scare = Math.max(f.scare, k);
      }

      const target = Math.atan2(sx, sz);
      const diff = Math.atan2(Math.sin(target - f.heading), Math.cos(target - f.heading));
      const turnRate = 1.6 + f.scare * 4;
      f.heading += THREE.MathUtils.clamp(diff, -turnRate * dt, turnRate * dt);
      f.speed = THREE.MathUtils.lerp(f.speed, f.cruise + f.scare * 1.8, 1 - Math.exp(-3 * dt));
      f.x += Math.sin(f.heading) * f.speed * dt;
      f.z += Math.cos(f.heading) * f.speed * dt;
      const d = pondDistance(f.x, f.z);
      if (d > 0.82) {
        // hard wall just inside the rocks
        f.x = pond.x + (f.x - pond.x) * (0.82 / d);
        f.z = pond.z + (f.z - pond.z) * (0.82 / d);
        f.heading = Math.atan2(pond.x - f.x, pond.z - f.z);
      }
      f.scare = Math.max(0, f.scare - dt * 0.5);

      // Now and then a calm fish rises to the surface, making a ring.
      if (f.rise === 0 && f.scare === 0 && now > f.nextRise) f.rise = 1e-4;
      if (f.rise > 0) {
        const before = f.rise;
        f.rise += dt / 1.6;
        if (before < 0.5 && f.rise >= 0.5) addRipple(f.x + Math.sin(f.heading) * 0.2 * f.scale, f.z + Math.cos(f.heading) * 0.2 * f.scale, 0.6, now);
        if (f.rise >= 1 || f.scare > 0) {
          f.rise = 0;
          f.nextRise = now + 5 + Math.random() * 10;
        }
      }
      f.y = f.depth + Math.sin(Math.min(f.rise, 1) * Math.PI) * (pond.water - 0.03 - f.depth);

      f.phase += dt * (5 + f.speed * 10);
      swim.setXY(i, f.phase, 0.03 + Math.min(f.speed, 2) * 0.035);
      fishMesh.setMatrixAt(i, m.compose(p.set(f.x, f.y, f.z), q.setFromEuler(e.set(0, f.heading, 0)), s.setScalar(f.scale)));
    });
    swim.needsUpdate = true;
    fishMesh.instanceMatrix.needsUpdate = true;

    // Lily pads and flowers bob on the small waves.
    scene.pads.forEach((pad, i) => {
      const bob = Math.sin(now * 1.3 + pad.phase);
      q.setFromEuler(e.set(bob * 0.04, pad.yaw + Math.sin(now * 0.2 + pad.phase) * 0.15, Math.cos(now * 1.1 + pad.phase) * 0.04));
      m.compose(p.set(pad.x, pond.water + 0.006 + bob * 0.006, pad.z), q, s.setScalar(pad.s));
      scene.padMesh.setMatrixAt(i, m);
      if (i < scene.flowerPads.length) {
        m.compose(p, q, s.setScalar(1));
        for (const part of scene.flowerParts) part.setMatrixAt(i, m);
      }
    });
    scene.padMesh.instanceMatrix.needsUpdate = true;
    for (const part of scene.flowerParts) part.instanceMatrix.needsUpdate = true;

    // Reeds sway in the wind.
    scene.reeds.forEach((reed, i) => {
      q.setFromEuler(e.set(Math.sin(now * 1.4 + reed.phase) * 0.05 + 0.03, 0, Math.cos(now * 1.1 + reed.phase) * 0.06 - 0.04));
      scene.reedMesh.setMatrixAt(i, m.compose(p.set(reed.x, 0, reed.z), q, s.set(1, reed.h, 1)));
      up.set(0, reed.h, 0).applyQuaternion(q).add(p);
      scene.headMesh.setMatrixAt(i, m.compose(up, q, s.setScalar(reed.head ? 1 : 0)));
    });
    scene.reedMesh.instanceMatrix.needsUpdate = true;
    scene.headMesh.instanceMatrix.needsUpdate = true;

    // Splash droplets.
    let anyDrop = false;
    scene.drops.forEach((d, i) => {
      if (!d) return;
      anyDrop = true;
      d.age += dt;
      d.vy -= 9.8 * dt;
      d.x += d.vx * dt;
      d.y += d.vy * dt;
      d.z += d.vz * dt;
      if (d.age > d.life || (d.vy < 0 && d.y < pond.water)) {
        scene.drops[i] = null;
        scene.dropMesh.setMatrixAt(i, m.makeScale(0, 0, 0));
        return;
      }
      scene.dropMesh.setMatrixAt(i, m.compose(p.set(d.x, d.y, d.z), q.identity(), s.setScalar(d.size * (1 - d.age / d.life * 0.5))));
    });
    if (anyDrop) scene.dropMesh.instanceMatrix.needsUpdate = true;
  });

  return (
    <group>
      {/* rim rocks block the car; the beach gap on the south side lets it drive in */}
      <RigidBody type="fixed" colliders={false} userData={{ material: 'stone' }}>
        {scene.rocks.map((k, i) => (
          <CylinderCollider key={i} args={[0.5, k.s * 0.8]} position={[k.x, 0.5, k.z]} />
        ))}
      </RigidBody>
      {/* sandy shore, then the pond bed with caustics */}
      <mesh position={[pond.x, 0.008, pond.z]} rotation={[-Math.PI / 2, 0, 0]} scale={[pond.rx * 1.25, pond.rz * 1.25, 1]} receiveShadow>
        <circleGeometry args={[1, 48]} />
        <meshStandardMaterial color="#E9D5A6" roughness={1} />
      </mesh>
      <mesh position={[pond.x, 0.012, pond.z]} rotation={[-Math.PI / 2, 0, 0]} scale={[pond.rx * 1.02, pond.rz * 1.02, 1]} material={scene.sand} receiveShadow>
        <circleGeometry args={[1, 48]} />
      </mesh>
      <mesh position={[pond.x, pond.water, pond.z]} rotation={[-Math.PI / 2, 0, 0]} scale={[pond.rx, pond.rz, 1]} material={scene.water}>
        <circleGeometry args={[1, 64]} />
      </mesh>
      <primitive object={scene.rockMesh} />
      <primitive object={scene.padMesh} />
      {scene.flowerParts.map((part, i) => (
        <primitive key={i} object={part} />
      ))}
      <primitive object={scene.reedMesh} />
      <primitive object={scene.headMesh} />
      <primitive object={scene.fishMesh} />
      <primitive object={scene.dropMesh} />
    </group>
  );
}
