import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { CuboidCollider, CylinderCollider, RigidBody } from '@react-three/rapier';
import { Text } from '@react-three/drei';
import * as THREE from 'three';
import { POOL_WATER, WORLD_SIZE, palette, poolDistance, rng, terrainHeight, waterfall } from './layout';
import { fallFragment, fallVertex } from './River';
import { Parts, M, shapes } from './geo';
import { mossyStoneMaterial, rockGeometry } from './stone';
import { actors } from './actors';
import { day } from './dayCycle';
import { DISPLAY_FONT, Signboard } from './common';
import { splash } from '../ui/sound';
import { useStore, type Tier } from '../store';

const { box, cyl } = shapes;
const HALF = WORLD_SIZE / 2;
const CLIFF_Z = waterfall.z;
/** Height of the top of the cliff at z: highest behind the main fall, lower to each side. */
const cliffTop = (z: number) => 2.2 + 5.3 * Math.exp(-(((z - CLIFF_Z) / 5.2) ** 2));
const FALLS = [
  { z: CLIFF_Z, width: 4.2, drop: cliffTop(CLIFF_Z) + 0.3 },
  { z: CLIFF_Z - 4.8, width: 2.0, drop: cliffTop(CLIFF_Z - 4.8) + 0.3 },
  { z: CLIFF_Z + 4.8, width: 1.6, drop: cliffTop(CLIFF_Z + 4.8) + 0.3 },
];
/** Where the main fall hits the pool: ripples, foam and mist centre on it. */
const IMPACT = { x: waterfall.cliffX - 1.2, z: CLIFF_Z };

const MIST: Record<Tier, number> = { low: 0, medium: 18, high: 40 };
const RAINBOW_TIERS: Record<Tier, boolean> = { low: false, medium: true, high: true };
const BOULDERS = 22;
const MAX_DROPS = 48;

type Mat = 'rock' | 'rockDark' | 'wood' | 'woodDark' | 'leaf' | 'coral' | 'yellow' | 'cream';
const MATS: Mat[] = ['rock', 'rockDark', 'wood', 'woodDark', 'leaf', 'coral', 'yellow', 'cream'];

/** A sheet of falling water: bows out towards the pool as it falls. uv.x across, uv.y from the lip (0) down to the pool (1). */
function curtain(x0: number, z: number, width: number, top: number, bottom: number) {
  const rows = 14;
  const cols = 10;
  const pos: number[] = [];
  const uv: number[] = [];
  const index: number[] = [];
  for (let r = 0; r <= rows; r++) {
    const t = r / rows;
    const y = top + (bottom - top) * t;
    const out = 0.15 + 1.1 * t * t;
    for (let c = 0; c <= cols; c++) {
      const u = c / cols;
      // the sheet narrows a little where it gathers speed, and fans out again at the bottom
      const w = width * (0.9 + 0.1 * Math.sin(t * Math.PI) - 0.0 + 0.12 * t * t);
      pos.push(x0 - out, y, z + (u - 0.5) * w);
      uv.push(u, t);
      if (r > 0 && c > 0) {
        const a = (r - 1) * (cols + 1) + c - 1;
        const b = r * (cols + 1) + c - 1;
        index.push(a, b, a + 1, b, b + 1, a + 1);
      }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(index);
  return g;
}

/** A strip of flowing water on the ground: from `(x0, z0)` to `(x1, z1)`, following the terrain (the pool's bank). */
function runoff(x0: number, z0: number, x1: number, z1: number, width: number, lift = 0.05) {
  const rows = 12;
  const dx = x1 - x0;
  const dz = z1 - z0;
  const len = Math.hypot(dx, dz);
  const nx = -dz / len;
  const nz = dx / len;
  const pos: number[] = [];
  const uv: number[] = [];
  const index: number[] = [];
  for (let r = 0; r <= rows; r++) {
    const t = r / rows;
    const cx = x0 + dx * t;
    const cz = z0 + dz * t;
    const w = width * (0.85 + 0.4 * t);
    for (const side of [-1, 1]) {
      const x = cx + nx * w * 0.5 * side;
      const z = cz + nz * w * 0.5 * side;
      pos.push(x, Math.max(terrainHeight(x, z), POOL_WATER - 0.2) + lift, z);
      uv.push(side < 0 ? 0 : 1, t);
    }
    if (r > 0) {
      const a = (r - 1) * 2;
      index.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(index);
  return g;
}

/** The little stream along the top of the cliff that feeds a fall: from the island edge to the lip. */
function stream(z: number, width: number, top: number) {
  const g = new THREE.PlaneGeometry(1, 1, 1, 6);
  const pos = g.getAttribute('position');
  for (let i = 0; i < pos.count; i++) {
    // plane x -> along the stream (from the edge, x = HALF, to the lip), plane y -> across it
    const u = pos.getX(i) + 0.5;
    const across = pos.getY(i);
    pos.setXYZ(i, HALF + 0.5 - u * (HALF + 0.5 - (waterfall.cliffX + 0.2)), top, z + across * width);
  }
  const uv = g.getAttribute('uv');
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getY(i), 1 - uv.getX(i) * 0.15);
  g.computeVertexNormals();
  return g;
}

function buildParts() {
  const r = rng(808);
  const piles = Object.fromEntries(MATS.map((m) => [m, new Parts()])) as Record<Mat, Parts>;
  const add = (mat: Mat, g: THREE.BufferGeometry, m: THREE.Matrix4) => piles[mat].add(g, m);
  const rocks = [rockGeometry(31, 1), rockGeometry(32, 1), rockGeometry(33, 1)];
  const rock = (x: number, y: number, z: number, s: number, flat = 0.8) =>
    add(r() < 0.35 ? 'rockDark' : 'rock', rocks[Math.floor(r() * 3)], M(x, y, z, (r() - 0.5) * 0.4, r() * 6.3, (r() - 0.5) * 0.4, s * (1 + r() * 0.3), s * flat, s));

  // cliff: columns of stacked boulders from z = -22 to -2, three deep, higher behind the main fall
  const colliders: { x: number; z: number; hx: number; hz: number; h: number }[] = [];
  for (let z = CLIFF_Z - 10; z <= CLIFF_Z + 10.01; z += 2.2) {
    const h = cliffTop(z);
    for (const x of [waterfall.cliffX + 1.7, waterfall.cliffX + 3.7, waterfall.cliffX + 5.4]) {
      for (let y = 0.6; y < h; y += 1.4) rock(x + (r() - 0.5) * 0.6, y, z + (r() - 0.5) * 0.7, 1.35 + r() * 0.4);
      rock(x + (r() - 0.5) * 0.4, h - 0.45, z + (r() - 0.5) * 0.5, 1.4 + r() * 0.3);
    }
    colliders.push({ x: waterfall.cliffX + 3.7, z, hx: 3.3, hz: 1.2, h });
  }
  // ledges and a few big boulders jutting out at the foot, either side of the main fall
  for (const dz of [-3.2, 3.2, -6.4, 6.4]) rock(waterfall.cliffX + 0.6, 0.3, CLIFF_Z + dz, 0.9 + r() * 0.3, 0.7);

  // boulders round the pool (solid, so the car cannot drive in), leaving the cliff side to the cliff
  const ring: { x: number; z: number; s: number }[] = [];
  for (let i = 0; i < BOULDERS * 2; i++) {
    const a = (i / (BOULDERS * 2)) * Math.PI * 2;
    const x = waterfall.x + Math.cos(a) * waterfall.rx * 1.25;
    const z = waterfall.z + Math.sin(a) * waterfall.rz * 1.25;
    if (x > waterfall.cliffX - 1.2) continue;
    if (Math.hypot(x - 57.3, z + 7.7) < 1.6) continue; // the seat rock
    const s = 0.5 + r() * 0.35;
    ring.push({ x, z, s });
    rock(x, s * 0.35, z, s);
  }
  // rocks in the pool: a few stepping stones from the west bank, and boulders at the foot of the fall (the water flows over them)
  const stones: [number, number, number][] = [[55.2, -11.2, 0.4], [56.6, -12.0, 0.35], [57.8, -13.2, 0.42], [59.1, -12.4, 0.36]];
  for (const [x, z, s] of stones) rock(x, POOL_WATER - 0.25 + s * 0.5, z, s, 0.45);
  for (const [dx, dz, s] of [[-0.6, -2.0, 0.9], [-1.6, 1.8, 0.8], [-2.8, -0.4, 0.7], [-3.4, 2.6, 0.6], [-2.4, -2.8, 0.65]] as const) rock(IMPACT.x + dx, POOL_WATER - 0.2 + s * 0.4, IMPACT.z + dz, s, 0.8);
  // the flat rock the bather sits on, at the pool's south edge
  add('rock', rocks[1], M(57.3, 0.0, -7.7, 0, 0.7, 0, 1.0, 0.28, 0.9));

  // lookout deck at the end of the road, with a rail along the pool side, a bench and a fallen log by the shore
  const L = waterfall.lookout;
  add('wood', box(5.2, 0.12, 3.8), M(L.x, 0, L.z));
  for (let k = -2; k <= 2; k++) add('woodDark', box(0.12, 0.7, 0.12), M(L.x + 2.5, 0.12, L.z + k * 0.85));
  add('woodDark', box(0.1, 0.1, 3.8), M(L.x + 2.5, 0.78, L.z));
  add('wood', box(1.5, 0.1, 0.45), M(L.x - 0.6, 0.45, L.z - 1.55));
  add('woodDark', box(0.1, 0.4, 0.4), M(L.x - 1.2, 0.05, L.z - 1.55));
  add('woodDark', box(0.1, 0.4, 0.4), M(L.x, 0.05, L.z - 1.55));
  add('wood', box(1.5, 0.35, 0.08), M(L.x - 0.6, 0.55, L.z - 1.78));
  add('wood', cyl(0.25, 0.28, 3.2, 10), M(53.6, 0.3, -15.6, Math.PI / 2, 0.5, 0));

  // reeds, flowers and ferns round the water
  for (let i = 0; i < 46; i++) {
    const a = r() * Math.PI * 2;
    const d = 1.28 + r() * 0.5;
    const x = waterfall.x + Math.cos(a) * waterfall.rx * d;
    const z = waterfall.z + Math.sin(a) * waterfall.rz * d;
    if (x > waterfall.cliffX - 1.5) continue;
    const h = 0.5 + r() * 0.7;
    for (let k = 0; k < 4; k++) add('leaf', new THREE.ConeGeometry(0.05, h, 3).translate(0, h / 2, 0), M(x + (r() - 0.5) * 0.3, Math.max(terrainHeight(x, z), 0), z + (r() - 0.5) * 0.3, (r() - 0.5) * 0.5, r() * 6.3, (r() - 0.5) * 0.5));
    if (r() < 0.45) add(r() < 0.5 ? 'coral' : r() < 0.5 ? 'yellow' : 'cream', new THREE.IcosahedronGeometry(0.07, 0), M(x + 0.2, h * 0.6, z + 0.2));
  }
  return { piles, colliders, ring };
}

/**
 * The waterfall at the east edge of the island: a stacked-boulder cliff with three falls (a wide main one and a thin one
 * on each side), a plunge pool dug into the terrain with rocks the water pours over, foam and mist at the foot, a rainbow
 * on bright days, boulders round the rim, and a lookout deck at the end of the new east road. Bathers (see
 * `npcRoutes`) wade and splash in the pool; their splashes come from here.
 */
export function Waterfall() {
  const tier = useStore((s) => s.tier);
  const mist = useRef<THREE.Points>(null);
  const bow = useRef<THREE.Mesh>(null);
  const dropMesh = useRef<THREE.InstancedMesh>(null);

  const scene = useMemo(() => {
    const { piles, colliders, ring } = buildParts();
    const stone = Object.assign(mossyStoneMaterial(0.5), { color: new THREE.Color('#CFC3AB') });
    const stoneDark = Object.assign(mossyStoneMaterial(0.5), { color: new THREE.Color('#A89E8A') });
    const solid = (c: string, extra: THREE.MeshStandardMaterialParameters = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.9, ...extra });
    const materials: Record<Mat, THREE.Material> = {
      rock: stone,
      rockDark: stoneDark,
      wood: solid(palette.wood),
      woodDark: solid(palette.woodDark),
      leaf: solid('#6E9A46', { flatShading: true, side: THREE.DoubleSide }),
      coral: solid(palette.coral),
      yellow: solid(palette.yellow),
      cream: solid(palette.cream),
    };
    const meshes = MATS.filter((m) => !piles[m].empty).map((m) => ({ key: m, geometry: piles[m].merged(), material: materials[m] }));

    // all the moving water that uses the falling-water shader, in one mesh
    const time = { value: 0 };
    const fallMaterial = new THREE.ShaderMaterial({
      vertexShader: fallVertex,
      fragmentShader: fallFragment,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      fog: true,
      uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uTime: time }]),
    });
    const waterParts: THREE.BufferGeometry[] = [];
    for (const f of FALLS) {
      waterParts.push(curtain(waterfall.cliffX, f.z, f.width, f.drop, POOL_WATER + 0.02));
      waterParts.push(stream(f.z, f.width * 0.8, f.drop - 0.05));
    }
    // the two thin falls land beside the pool, and run down the bank over rocks into it
    waterParts.push(runoff(waterfall.cliffX - 1.0, FALLS[1].z, waterfall.cliffX - 3.4, FALLS[1].z + 2.0, 1.5));
    waterParts.push(runoff(waterfall.cliffX - 1.0, FALLS[2].z, waterfall.cliffX - 3.4, FALLS[2].z - 2.0, 1.3));
    const falls = new THREE.Mesh(mergeWater(waterParts), fallMaterial);
    falls.frustumCulled = false;

    // pool surface
    const poolMaterial = new THREE.ShaderMaterial({
      vertexShader: poolVertex,
      fragmentShader: poolFragment,
      transparent: true,
      depthWrite: false,
      fog: true,
      uniforms: THREE.UniformsUtils.merge([
        THREE.UniformsLib.fog,
        {
          uTime: time,
          uCenter: { value: new THREE.Vector2(waterfall.x, waterfall.z) },
          uRadii: { value: new THREE.Vector2(waterfall.rx * 1.16, waterfall.rz * 1.16) },
          uImpact: { value: new THREE.Vector2(IMPACT.x, IMPACT.z) },
          uShallow: { value: new THREE.Color('#7FD6C8') },
          uDeep: { value: new THREE.Color('#1F8C93') },
        },
      ]),
    });
    const poolGeo = new THREE.CircleGeometry(1, 56).rotateX(-Math.PI / 2);

    // mist rising from the foot of the main fall: all the motion happens in the vertex shader
    const count = MIST.high;
    const mr = rng(5);
    const base = new Float32Array(count * 3);
    const seed = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      base.set([IMPACT.x - mr() * 1.8, POOL_WATER, IMPACT.z + (mr() - 0.5) * 4.6], i * 3);
      seed[i] = mr();
    }
    const mistGeo = new THREE.BufferGeometry();
    mistGeo.setAttribute('position', new THREE.BufferAttribute(base, 3));
    mistGeo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
    const mistMaterial = new THREE.ShaderMaterial({
      vertexShader: mistVertex,
      fragmentShader: mistFragment,
      transparent: true,
      depthWrite: false,
      uniforms: { uTime: time },
    });

    // rainbow: six coloured bands of a half ring, standing in the spray and facing the camera's side of the island
    const bandColors = ['#FF5A5A', '#FF9F4A', '#FFE066', '#6FD66F', '#5AB0FF', '#9C7BFF'];
    const bands: THREE.BufferGeometry[] = [];
    bandColors.forEach((c, i) => {
      const g = new THREE.RingGeometry(5.0 + i * 0.28, 5.0 + (i + 1) * 0.28, 40, 1, 0, Math.PI);
      const col = new THREE.Color(c);
      const n = g.getAttribute('position').count;
      const colors = new Float32Array(n * 3);
      for (let k = 0; k < n; k++) col.toArray(colors, k * 3);
      g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
      bands.push(g);
    });
    const rainbowGeo = mergeBands(bands);
    const rainbowMat = new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide, fog: false });

    // splash droplets from the bathers
    const drops = Array.from({ length: MAX_DROPS }, () => ({ live: false, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, age: 0, life: 0, size: 0 }));
    const dropGeo = new THREE.IcosahedronGeometry(1, 0);
    const dropMat = new THREE.MeshStandardMaterial({ color: '#E4F6F4', roughness: 0.2, transparent: true, opacity: 0.85 });

    return { meshes, colliders, ring, falls, fallMaterial, poolGeo, poolMaterial, mistGeo, mistMaterial, rainbowGeo, rainbowMat, drops, dropGeo, dropMat, time };
  }, []);

  useEffect(
    () => () => {
      for (const m of scene.meshes) m.geometry.dispose();
      scene.falls.geometry.dispose();
      scene.poolGeo.dispose();
      scene.mistGeo.dispose();
      scene.rainbowGeo.dispose();
      scene.dropGeo.dispose();
    },
    [scene],
  );

  useEffect(() => {
    scene.mistGeo.setDrawRange(0, MIST[tier]);
  }, [scene, tier]);

  const tmp = useMemo(() => ({ m: new THREE.Matrix4(), q: new THREE.Quaternion(), p: new THREE.Vector3(), s: new THREE.Vector3(), hidden: new THREE.Matrix4().makeScale(0, 0, 0), spawn: 0, last: new Map<object, number>() }), []);
  useFrame(({ clock, camera }, rawDt) => {
    const dt = Math.min(rawDt, 1 / 30);
    const now = clock.elapsedTime;
    scene.time.value = now;
    const far = camera.position.distanceTo(tmp.p.set(waterfall.x, 2, waterfall.z)) > 110;
    if (far) return;

    // rainbow: only on a bright day, fading in and out with the sun and away with the rain
    const sunUp = THREE.MathUtils.smoothstep(day.t, 0.3, 0.42) * (1 - THREE.MathUtils.smoothstep(day.t, 0.58, 0.7));
    scene.rainbowMat.opacity = RAINBOW_TIERS[tier] ? 0.32 * sunUp * (1 - day.rain) : 0;
    if (bow.current) bow.current.visible = scene.rainbowMat.opacity > 0.01;

    // bathers splash: droplets and a sound, while they play in the pool
    const mesh = dropMesh.current;
    if (!mesh) return;
    tmp.spawn += dt;
    for (const a of actors) {
      if (!a.splashing || poolDistance(a.x, a.z) > 1.15) continue;
      if (tmp.spawn > 0.07 && tier !== 'low') {
        const d = scene.drops.find((q) => !q.live);
        if (d) {
          const ang = Math.random() * Math.PI * 2;
          Object.assign(d, { live: true, x: a.x + Math.cos(ang) * 0.5, y: POOL_WATER + 0.3, z: a.z + Math.sin(ang) * 0.5, vx: Math.cos(ang) * 0.8, vy: 2 + Math.random() * 1.8, vz: Math.sin(ang) * 0.8, age: 0, life: 0.7, size: 0.04 + Math.random() * 0.04 });
        }
      }
      const last = tmp.last.get(a) ?? -10;
      if (now - last > 0.9 && Math.random() < dt * 3) {
        tmp.last.set(a, now);
        splash(0.25, { x: a.x, y: POOL_WATER, z: a.z });
      }
    }
    if (tmp.spawn > 0.07) tmp.spawn = 0;
    scene.drops.forEach((d, i) => {
      if (!d.live) {
        mesh.setMatrixAt(i, tmp.hidden);
        return;
      }
      d.age += dt;
      d.vy -= 9.8 * dt;
      d.x += d.vx * dt;
      d.y += d.vy * dt;
      d.z += d.vz * dt;
      if (d.age > d.life || (d.vy < 0 && d.y < POOL_WATER)) {
        d.live = false;
        mesh.setMatrixAt(i, tmp.hidden);
        return;
      }
      mesh.setMatrixAt(i, tmp.m.compose(tmp.p.set(d.x, d.y, d.z), tmp.q.identity(), tmp.s.setScalar(d.size * (1 - (d.age / d.life) * 0.5))));
    });
    mesh.instanceMatrix.needsUpdate = true;
  });

  const shadows = tier !== 'low';
  return (
    <group>
      <RigidBody type="fixed" colliders={false} userData={{ material: 'stone' }}>
        {scene.colliders.map((c, i) => (
          <CuboidCollider key={i} args={[c.hx, c.h / 2, c.hz]} position={[c.x, c.h / 2, c.z]} />
        ))}
        {scene.ring.map((k, i) => (
          <CylinderCollider key={i} args={[0.5, k.s * 0.8]} position={[k.x, 0.5, k.z]} />
        ))}
      </RigidBody>
      <RigidBody type="fixed" colliders={false} userData={{ material: 'wood' }}>
        <CuboidCollider args={[2.6, 0.06, 1.9]} position={[waterfall.lookout.x, 0.06, waterfall.lookout.z]} />
        <CuboidCollider args={[0.1, 0.5, 1.9]} position={[waterfall.lookout.x + 2.5, 0.6, waterfall.lookout.z]} />
      </RigidBody>
      {scene.meshes.map((m) => (
        <mesh key={m.key} geometry={m.geometry} material={m.material} castShadow={shadows && (m.key === 'rock' || m.key === 'rockDark')} receiveShadow />
      ))}
      <mesh geometry={scene.poolGeo} material={scene.poolMaterial} position={[waterfall.x, POOL_WATER, waterfall.z]} scale={[waterfall.rx * 1.16, 1, waterfall.rz * 1.16]} renderOrder={2} />
      <primitive object={scene.falls} renderOrder={3} />
      <points ref={mist} geometry={scene.mistGeo} material={scene.mistMaterial} frustumCulled={false} renderOrder={4} />
      <mesh ref={bow} geometry={scene.rainbowGeo} material={scene.rainbowMat} position={[IMPACT.x - 2.5, 0.4, IMPACT.z + 1]} rotation={[0, 0.58, 0]} renderOrder={5} visible={false} />
      <instancedMesh ref={dropMesh} args={[scene.dropGeo, scene.dropMat, MAX_DROPS]} frustumCulled={false} />
      {/* name of the place, on a signboard facing the road */}
      <Signboard position={[waterfall.lookout.x - 4.2, 0, waterfall.lookout.z + 3.2]} rotation={-Math.PI / 2} width={3} height={0.9} color={palette.navy}>
        <Text fontSize={0.4} color={palette.cream} font={DISPLAY_FONT} anchorX="center" anchorY="middle">ZARE FALLS</Text>
      </Signboard>
    </group>
  );
}

// ---------- helpers and shaders ----------

function mergeWater(parts: THREE.BufferGeometry[]) {
  // every part has position, uv and an index: join them into one geometry
  let vertexCount = 0;
  let indexCount = 0;
  for (const g of parts) {
    vertexCount += g.getAttribute('position').count;
    indexCount += g.index!.count;
  }
  const position = new Float32Array(vertexCount * 3);
  const uv = new Float32Array(vertexCount * 2);
  const index = new Uint32Array(indexCount);
  let v = 0;
  let i = 0;
  for (const g of parts) {
    const n = g.getAttribute('position').count;
    position.set(g.getAttribute('position').array as Float32Array, v * 3);
    uv.set(g.getAttribute('uv').array as Float32Array, v * 2);
    const idx = g.index!.array;
    for (let k = 0; k < idx.length; k++) index[i + k] = idx[k] + v;
    v += n;
    i += idx.length;
    g.dispose();
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(position, 3));
  out.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  out.setIndex(new THREE.BufferAttribute(index, 1));
  return out;
}

function mergeBands(parts: THREE.BufferGeometry[]) {
  let vertexCount = 0;
  let indexCount = 0;
  for (const g of parts) {
    vertexCount += g.getAttribute('position').count;
    indexCount += g.index!.count;
  }
  const position = new Float32Array(vertexCount * 3);
  const color = new Float32Array(vertexCount * 3);
  const index = new Uint32Array(indexCount);
  let v = 0;
  let i = 0;
  for (const g of parts) {
    const n = g.getAttribute('position').count;
    position.set(g.getAttribute('position').array as Float32Array, v * 3);
    color.set(g.getAttribute('color').array as Float32Array, v * 3);
    const idx = g.index!.array;
    for (let k = 0; k < idx.length; k++) index[i + k] = idx[k] + v;
    v += n;
    i += idx.length;
    g.dispose();
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(position, 3));
  out.setAttribute('color', new THREE.BufferAttribute(color, 3));
  out.setIndex(new THREE.BufferAttribute(index, 1));
  return out;
}

const poolVertex = /* glsl */ `
#include <fog_pars_vertex>
varying vec3 vWorld;
void main() {
  vec4 world = modelMatrix * vec4(position, 1.0);
  vWorld = world.xyz;
  vec4 mvPosition = viewMatrix * world;
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}
`;

const poolFragment = /* glsl */ `
#include <fog_pars_fragment>
uniform float uTime;
uniform vec2 uCenter;
uniform vec2 uRadii;
uniform vec2 uImpact;
uniform vec3 uShallow;
uniform vec3 uDeep;
varying vec3 vWorld;
void main() {
  vec2 q = (vWorld.xz - uCenter) / uRadii;
  float d = length(q);
  float depth = smoothstep(1.0, 0.15, d);
  vec3 col = mix(uShallow, uDeep, depth);
  // rings spreading from where the fall lands, and a churning white patch there
  float r = length(vWorld.xz - uImpact);
  float ring = sin(r * 5.5 - uTime * 3.2) * 0.5 + 0.5;
  col += vec3(0.07) * smoothstep(0.65, 1.0, ring) * exp(-r * 0.28);
  float churn = smoothstep(3.0, 0.4, r) * (0.55 + 0.45 * sin(r * 9.0 - uTime * 6.0 + vWorld.x * 2.0 + vWorld.z * 1.7));
  col = mix(col, vec3(1.0), clamp(churn, 0.0, 1.0) * 0.6);
  // gentle ripples and foam along the shore
  col += vec3(0.04) * sin(vWorld.x * 3.1 + uTime * 1.3) * sin(vWorld.z * 2.7 - uTime * 1.1);
  float shore = smoothstep(0.78, 1.0, d) * (0.5 + 0.5 * sin(d * 46.0 - uTime * 2.0));
  col = mix(col, vec3(1.0), shore * 0.5);
  float alpha = clamp(mix(0.62, 0.9, depth) + churn * 0.2 + shore * 0.3, 0.0, 0.95);
  gl_FragColor = vec4(col, alpha);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
  #include <fog_fragment>
}
`;

const mistVertex = /* glsl */ `
uniform float uTime;
attribute float aSeed;
varying float vAge;
void main() {
  float age = fract(uTime * 0.22 + aSeed);
  vAge = age;
  vec3 p = position + vec3(-age * 1.6 + sin(uTime * 0.7 + aSeed * 40.0) * 0.3, age * 3.4, sin(uTime * 0.5 + aSeed * 23.0) * 0.5);
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = (1.6 + age * 3.2) * (190.0 / -mv.z);
}
`;

const mistFragment = /* glsl */ `
varying float vAge;
void main() {
  float d = length(gl_PointCoord - 0.5) * 2.0;
  float soft = pow(clamp(1.0 - d, 0.0, 1.0), 1.6);
  gl_FragColor = vec4(1.0, 1.0, 1.0, soft * (1.0 - vAge) * 0.22);
}
`;
