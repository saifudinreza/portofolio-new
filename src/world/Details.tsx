import { useEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { CuboidCollider, CylinderCollider, RigidBody } from '@react-three/rapier';
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { WORLD_SIZE, distanceToSegment, isClear, palette, pond, pondDistance, rng, roadSegments, trails } from './layout';
import { carState } from './carState';
import { woodMap } from './textures';
import { setCardShare, shrubParts } from './foliage';
import { useStore } from '../store';

const HALF = WORLD_SIZE / 2;
const up = new THREE.Vector3(0, 1, 0);

/** Open meadow: not on a road, area, pad, pond, footpath or the island edge. */
const meadow = (x: number, z: number, roadMargin: number) =>
  Math.abs(x) < HALF - 2 && Math.abs(z) < HALF - 2 && isClear(x, z, roadMargin) && pondDistance(x, z) > 1.35 && trails.every((t) => distanceToSegment(x, z, t) > 1.6);

function instanced(geometry: THREE.BufferGeometry, material: THREE.Material, items: { m: THREE.Matrix4; color?: string }[], shadow = true) {
  const mesh = new THREE.InstancedMesh(geometry, material, Math.max(1, items.length));
  mesh.count = items.length;
  const c = new THREE.Color();
  items.forEach((it, i) => {
    mesh.setMatrixAt(i, it.m);
    if (it.color) mesh.setColorAt(i, c.set(it.color));
  });
  mesh.castShadow = shadow;
  mesh.receiveShadow = true;
  mesh.computeBoundingSphere();
  return mesh;
}

const mat = (p: THREE.Vector3, yaw: number, s: THREE.Vector3 | number) =>
  new THREE.Matrix4().compose(p, new THREE.Quaternion().setFromAxisAngle(up, yaw), typeof s === 'number' ? new THREE.Vector3(s, s, s) : s);

/** Five cupped petals around a golden centre; petals take the instance colour, the centre stays warm. */
function flowerGeometry() {
  const petals = Array.from({ length: 5 }, (_, i) =>
    new THREE.CircleGeometry(0.045, 5).scale(0.6, 1, 1).translate(0, 0.045, 0).rotateX(-1.1).rotateY((i / 5) * Math.PI * 2).toNonIndexed(),
  );
  const centre = new THREE.SphereGeometry(0.022, 6, 3).scale(1, 0.6, 1).translate(0, 0.012, 0).toNonIndexed();
  const g = mergeGeometries([...petals, centre])!;
  const col: number[] = [];
  const petalVerts = petals.reduce((n, p) => n + p.getAttribute('position').count, 0);
  for (let i = 0; i < g.getAttribute('position').count; i++) {
    if (i < petalVerts) col.push(1, 1, 1);
    else col.push(1.4, 1.05, 0.35);
  }
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  return g;
}

// ---------- bushes and flowers ----------

function useVegetation() {
  return useMemo(() => {
    const r = rng(303);
    const shrub = shrubParts();
    const bushes: { m: THREE.Matrix4; color: string }[] = [];
    for (let guard = 0; bushes.length < 70 && guard < 4000; guard++) {
      const x = (r() * 2 - 1) * HALF;
      const z = (r() * 2 - 1) * HALF;
      if (!meadow(x, z, 3)) continue;
      const s = 0.55 + r() * 0.5;
      // the leaf colours live in the shrub's vertex colours; per bush only the lightness shifts
      const l = Math.round((0.85 + r() * 0.25) * 255);
      bushes.push({ m: mat(new THREE.Vector3(x, 0, z), r() * 6.3, new THREE.Vector3(s, s * (0.8 + r() * 0.3), s)), color: `rgb(${l},${l},${l})` });
    }

    // Flowers grow in small patches: a stem and a bright low-poly head.
    const stems: { m: THREE.Matrix4 }[] = [];
    const heads: { m: THREE.Matrix4; color: string }[] = [];
    const petals = [palette.coral, palette.yellow, palette.cream, '#B18CD9', '#F4A6B8'];
    for (let patch = 0, guard = 0; patch < 34 && guard < 3000; guard++) {
      const cx = (r() * 2 - 1) * HALF;
      const cz = (r() * 2 - 1) * HALF;
      if (!meadow(cx, cz, 2.6)) continue;
      patch++;
      const color = petals[Math.floor(r() * petals.length)];
      const n = 5 + Math.floor(r() * 7);
      for (let i = 0; i < n; i++) {
        const x = cx + (r() - 0.5) * 1.6;
        const z = cz + (r() - 0.5) * 1.6;
        if (!meadow(x, z, 2.3)) continue;
        const h = 0.25 + r() * 0.2;
        stems.push({ m: mat(new THREE.Vector3(x, 0, z), 0, new THREE.Vector3(1, h, 1)) });
        heads.push({ m: mat(new THREE.Vector3(x, h, z), r() * 6.3, 0.8 + r() * 0.5), color });
      }
    }

    return {
      // cards receive shadows, the solid cores cast them
      bushes: instanced(shrub.cards, shrub.cardMaterial, bushes, false),
      bushCores: instanced(shrub.core, shrub.coreMaterial, bushes),
      stems: instanced(new THREE.CylinderGeometry(0.008, 0.01, 1, 4).translate(0, 0.5, 0), new THREE.MeshStandardMaterial({ color: '#5E8F46' }), stems, false),
      heads: instanced(flowerGeometry(), new THREE.MeshStandardMaterial({ roughness: 0.6, vertexColors: true, side: THREE.DoubleSide }), heads, false),
    };
  }, []);
}

// ---------- street lamps, fences, benches ----------

type Lamp = { x: number; z: number; yaw: number };
type Fence = { x1: number; z1: number; x2: number; z2: number };
type Bench = { x: number; z: number; yaw: number };

function layoutFurniture() {
  // Lamps every ~11 m along each road, alternating sides, 2.5 m off the centreline.
  const lamps: Lamp[] = [];
  roadSegments.forEach(([x1, z1, x2, z2], i) => {
    const len = Math.hypot(x2 - x1, z2 - z1);
    if (len < 8) return;
    const dx = (x2 - x1) / len;
    const dz = (z2 - z1) / len;
    for (let d = 7, k = 0; d < len - 3; d += 11, k++) {
      const side = (k + i) % 2 ? 1 : -1;
      const x = x1 + dx * d - dz * side * 2.5;
      const z = z1 + dz * d + dx * side * 2.5;
      const nearOtherRoad = roadSegments.some((seg) => distanceToSegment(x, z, seg) < 2.2);
      if (nearOtherRoad || !isClear(x, z, 0) || pondDistance(x, z) < 1.4) continue;
      // lamp head leans over the road
      lamps.push({ x, z, yaw: Math.atan2(dz * side, -dx * side) });
    }
  });

  const fenceRuns: Fence[] = [
    { x1: -21, z1: 5, x2: -21, z2: 13 },
    { x1: 15, z1: 7, x2: 22, z2: 10.5 },
    { x1: 31, z1: 12, x2: 39, z2: 12 },
    { x1: -36, z1: 6, x2: -36, z2: 15 },
    { x1: 36, z1: -4, x2: 36, z2: -10 },
  ];
  const fences = fenceRuns.filter(({ x1, z1, x2, z2 }) => {
    for (let t = 0; t <= 1; t += 0.1) if (!meadow(x1 + (x2 - x1) * t, z1 + (z2 - z1) * t, 2.8)) return false;
    return true;
  });

  const faceTo = (x: number, z: number, tx: number, tz: number) => Math.atan2(tx - x, tz - z);
  const benches: Bench[] = [
    { x: 4.2, z: 31.5, yaw: faceTo(4.2, 31.5, pond.x, pond.z) },
    { x: -16.5, z: 31, yaw: faceTo(-16.5, 31, -22, 26) },
    { x: 20, z: 35.4, yaw: Math.PI },
  ];
  return { lamps, fences, benches };
}

function useFurniture() {
  return useMemo(() => {
    const { lamps, fences, benches } = layoutFurniture();
    const metal = new THREE.MeshStandardMaterial({ color: '#2E3440', metalness: 0.6, roughness: 0.45 });
    const wood = new THREE.MeshStandardMaterial({ color: palette.wood, roughness: 0.85, map: woodMap() });

    // Garden lamp: fluted pole on a stepped base, a curled arm and a six-sided lantern with warm glass.
    const lampGeo = mergeGeometries([
      new THREE.CylinderGeometry(0.05, 0.075, 2.8, 12).translate(0, 1.4, 0),
      new THREE.CylinderGeometry(0.14, 0.19, 0.18, 12).translate(0, 0.09, 0),
      new THREE.CylinderGeometry(0.1, 0.13, 0.14, 12).translate(0, 0.25, 0),
      new THREE.SphereGeometry(0.07, 10, 8).translate(0, 2.82, 0),
      new RoundedBoxGeometry(0.05, 0.05, 0.62, 2, 0.02).translate(0, 2.76, 0.28),
      new THREE.TorusGeometry(0.06, 0.012, 6, 14, Math.PI).rotateY(Math.PI / 2).translate(0, 2.7, 0.08),
      new THREE.ConeGeometry(0.18, 0.13, 6).translate(0, 2.71, 0.56),
      new THREE.CylinderGeometry(0.11, 0.09, 0.04, 6).translate(0, 2.38, 0.56),
    ].map((g) => g.toNonIndexed()))!;
    const bulbGeo = new THREE.CylinderGeometry(0.115, 0.095, 0.26, 6).translate(0, 2.52, 0.56);
    const lampItems = lamps.map((l) => ({ m: mat(new THREE.Vector3(l.x, 0, l.z), l.yaw, 1) }));

    const posts: { m: THREE.Matrix4 }[] = [];
    const rails: { m: THREE.Matrix4 }[] = [];
    for (const f of fences) {
      const len = Math.hypot(f.x2 - f.x1, f.z2 - f.z1);
      const yaw = Math.atan2(f.x2 - f.x1, f.z2 - f.z1);
      const n = Math.max(2, Math.round(len / 1.6) + 1);
      for (let i = 0; i < n; i++) {
        const t = i / (n - 1);
        posts.push({ m: mat(new THREE.Vector3(f.x1 + (f.x2 - f.x1) * t, 0.45, f.z1 + (f.z2 - f.z1) * t), yaw, 1) });
      }
      for (const y of [0.35, 0.7]) rails.push({ m: mat(new THREE.Vector3((f.x1 + f.x2) / 2, y, (f.z1 + f.z2) / 2), yaw, new THREE.Vector3(1, 1, len)) });
    }

    const benchGeo = mergeGeometries([
      ...[-0.16, 0, 0.16].map((z) => new THREE.BoxGeometry(1.5, 0.05, 0.13).translate(0, 0.45, z)),
      ...[0.55, 0.72].map((y) => new THREE.BoxGeometry(1.5, 0.12, 0.04).translate(0, y, -0.25)),
    ])!;
    const benchLegGeo = mergeGeometries([-0.62, 0.62].map((x) => new THREE.BoxGeometry(0.06, 0.45, 0.42).translate(x, 0.22, 0)))!;
    const benchItems = benches.map((b) => ({ m: mat(new THREE.Vector3(b.x, 0, b.z), b.yaw + Math.PI, 1) }));

    return {
      lamps,
      fences,
      benches,
      meshes: [
        instanced(lampGeo, metal, lampItems),
        instanced(bulbGeo, new THREE.MeshStandardMaterial({ color: '#FFF1C9', emissive: '#FFC26B', emissiveIntensity: 2.6, roughness: 0.3 }), lampItems, false),
        instanced(new THREE.BoxGeometry(0.1, 0.9, 0.1), wood, posts),
        instanced(new THREE.BoxGeometry(0.05, 0.1, 1), wood, rails),
        instanced(benchGeo, wood, benchItems),
        instanced(benchLegGeo, metal, benchItems),
      ],
    };
  }, []);
}

// ---------- butterflies and drifting leaves ----------

function useCritters() {
  return useMemo(() => {
    const r = rng(404);
    const wingGeo = new THREE.CircleGeometry(0.1, 6).translate(0.09, 0, 0).rotateX(-Math.PI / 2);
    const colors = [palette.coral, palette.yellow, palette.teal, palette.cream];
    const butterflies = Array.from({ length: 12 }, (_, i) => {
      const group = new THREE.Group();
      const material = new THREE.MeshStandardMaterial({ color: colors[i % colors.length], side: THREE.DoubleSide, roughness: 0.6 });
      const left = new THREE.Mesh(wingGeo, material);
      const right = new THREE.Mesh(wingGeo, material);
      right.scale.x = -1;
      group.add(left, right);
      let hx = 0;
      let hz = 0;
      for (let guard = 0; guard < 400; guard++) {
        hx = (r() * 2 - 1) * (HALF - 6);
        hz = (r() * 2 - 1) * (HALF - 6);
        if (meadow(hx, hz, 3)) break;
      }
      return { group, left, right, home: [hx, hz] as const, phase: r() * 10, seed: r() * 100 };
    });

    const leafMesh = new THREE.InstancedMesh(
      new THREE.PlaneGeometry(0.14, 0.09),
      new THREE.MeshStandardMaterial({ side: THREE.DoubleSide, roughness: 0.8 }),
      36,
    );
    leafMesh.frustumCulled = false;
    const c = new THREE.Color();
    const leaves = Array.from({ length: 36 }, (_, i) => {
      leafMesh.setColorAt(i, c.set(['#7BB463', palette.yellow, '#E9A93A', palette.leafDark][i % 4]));
      return { x: 0, y: -10, z: 0, spin: r() * 6, seed: r() * 50 };
    });
    return { butterflies, leafMesh, leaves };
  }, []);
}

/** Bushes, flowers, lamps, fences, benches, butterflies and leaves drifting on the wind. */
export function Details() {
  const veg = useVegetation();
  const furniture = useFurniture();
  const critters = useCritters();
  const tier = useStore((st) => st.tier);
  useEffect(() => setCardShare(veg.bushes.geometry, tier), [veg, tier]);
  const tmp = useMemo(() => ({ m: new THREE.Matrix4(), q: new THREE.Quaternion(), e: new THREE.Euler(), p: new THREE.Vector3(), s: new THREE.Vector3() }), []);

  useFrame(({ clock }, rawDt) => {
    const dt = Math.min(rawDt, 1 / 30);
    const t = clock.elapsedTime;

    // Butterflies wander in lazy loops around their meadow and flap.
    for (const b of critters.butterflies) {
      const k = t * 0.35 + b.seed;
      const x = b.home[0] + Math.sin(k) * 2.4 + Math.sin(k * 2.3) * 0.8;
      const z = b.home[1] + Math.cos(k * 0.8) * 2.4 + Math.cos(k * 1.9) * 0.8;
      const y = 0.7 + Math.sin(k * 3.1) * 0.35 + Math.sin(t * 9 + b.phase) * 0.04;
      const dx = Math.cos(k) * 2.4 + Math.cos(k * 2.3) * 1.84;
      const dz = -Math.sin(k * 0.8) * 1.92 - Math.sin(k * 1.9) * 1.52;
      b.group.position.set(x, y, z);
      b.group.rotation.y = Math.atan2(dx, dz) - Math.PI / 2;
      const flap = Math.sin(t * 18 + b.phase) * 1.1;
      b.left.rotation.z = flap;
      b.right.rotation.z = -flap;
    }

    // A handful of leaves drift past the car on the breeze and respawn upwind when they land.
    const { leafMesh, leaves } = critters;
    leaves.forEach((l, i) => {
      if (l.y < 0.05 || Math.hypot(l.x - carState.x, l.z - carState.z) > 26) {
        l.x = carState.x - 14 + Math.random() * 10;
        l.z = carState.z - 10 + (Math.random() - 0.3) * 24;
        l.y = 2 + Math.random() * 4;
      }
      l.x += (0.9 + Math.sin(t * 0.7 + l.seed) * 0.4) * dt * 1.6;
      l.z += (0.45 + Math.cos(t * 0.9 + l.seed) * 0.5) * dt * 1.2;
      l.y -= (0.35 + Math.sin(t * 2 + l.seed) * 0.15) * dt;
      l.spin += dt * 3;
      leafMesh.setMatrixAt(i, tmp.m.compose(tmp.p.set(l.x, l.y, l.z), tmp.q.setFromEuler(tmp.e.set(Math.sin(l.spin) * 1.2, l.spin, Math.cos(l.spin * 0.7))), tmp.s.setScalar(1)));
    });
    leafMesh.instanceMatrix.needsUpdate = true;
  });

  return (
    <group>
      <RigidBody type="fixed" colliders={false} userData={{ material: 'metal' }}>
        {furniture.lamps.map((l, i) => (
          <CylinderCollider key={i} args={[1.4, 0.1]} position={[l.x, 1.4, l.z]} />
        ))}
      </RigidBody>
      <RigidBody type="fixed" colliders={false} userData={{ material: 'wood' }}>
        {furniture.fences.map((f, i) => (
          <CuboidCollider
            key={i}
            args={[0.06, 0.45, Math.hypot(f.x2 - f.x1, f.z2 - f.z1) / 2]}
            position={[(f.x1 + f.x2) / 2, 0.45, (f.z1 + f.z2) / 2]}
            rotation={[0, Math.atan2(f.x2 - f.x1, f.z2 - f.z1), 0]}
          />
        ))}
        {furniture.benches.map((b, i) => (
          <CuboidCollider key={i} args={[0.78, 0.4, 0.3]} position={[b.x, 0.4, b.z]} rotation={[0, b.yaw, 0]} />
        ))}
      </RigidBody>
      <primitive object={veg.bushes} />
      <primitive object={veg.bushCores} />
      <primitive object={veg.stems} />
      <primitive object={veg.heads} />
      {furniture.meshes.map((m, i) => (
        <primitive key={i} object={m} />
      ))}
      {critters.butterflies.map((b, i) => (
        <primitive key={i} object={b.group} />
      ))}
      <primitive object={critters.leafMesh} />
    </group>
  );
}
