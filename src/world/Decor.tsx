import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Text } from '@react-three/drei';
import { BallCollider, CuboidCollider, CylinderCollider, RigidBody, type RapierRigidBody } from '@react-three/rapier';
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { WORLD_SIZE, aboutArea, contactPads, distanceToSegment, isClear, palette, pondDistance, projectPadPositions, rng, roadSegments, trails, warehouse, zones } from './layout';
import { projects } from '../data/profile';
import { carState } from './carState';
import { useStore, type Tier } from '../store';
import { DISPLAY_FONT } from './common';
import { mossyStoneMaterial, rockGeometry } from './stone';
import { fallenLeafMap, keyMarkerTexture, lightPoolMap, pavingMap } from './decorTextures';
import { woodMap } from './textures';

const HALF = WORLD_SIZE / 2;
const FIREFLIES: Record<Tier, number> = { low: 0, medium: 36, high: 64 };

const meadow = (x: number, z: number, margin = 3) =>
  Math.abs(x) < HALF - 2 && Math.abs(z) < HALF - 2 && isClear(x, z, margin) && pondDistance(x, z) > 1.5 && trails.every((t) => distanceToSegment(x, z, t) > 1.6);
const roadDistance = (x: number, z: number) => Math.min(...roadSegments.map((s) => distanceToSegment(x, z, s)));

// ---------- paved areas ----------

type Area = { kind: 'disc'; x: number; z: number; r: number } | { kind: 'rect'; x: number; z: number; hx: number; hz: number; round: number };

/** The home plaza, the projects courtyard and the strip in front of the contact pads. */
const pavedAreas: Area[] = [
  { kind: 'disc', x: 0, z: 1.5, r: 7.2 },
  { kind: 'rect', x: 26, z: -21, hx: 15.5, hz: 12.8, round: 4 },
  { kind: 'rect', x: 26, z: 30.6, hx: 11.8, hz: 3.9, round: 2 },
];

/** Signed distance to an area's edge (negative inside). */
function areaDistance(a: Area, x: number, z: number) {
  if (a.kind === 'disc') return Math.hypot(x - a.x, z - a.z) - a.r;
  const qx = Math.abs(x - a.x) - (a.hx - a.round);
  const qz = Math.abs(z - a.z) - (a.hz - a.round);
  return Math.hypot(Math.max(qx, 0), Math.max(qz, 0)) + Math.min(Math.max(qx, qz), 0) - a.round;
}
const onPaving = (x: number, z: number) => pavedAreas.some((a) => areaDistance(a, x, z) < -0.3);

/** A grid over the area whose vertex alpha fades out across a wobbly edge, so the paving crumbles into the sand. */
function pavingGeometry(a: Area) {
  const hx = (a.kind === 'disc' ? a.r : a.hx) + 1;
  const hz = (a.kind === 'disc' ? a.r : a.hz) + 1;
  const step = 0.5;
  const nx = Math.ceil((hx * 2) / step);
  const nz = Math.ceil((hz * 2) / step);
  const pos: number[] = [];
  const uv: number[] = [];
  const col: number[] = [];
  const index: number[] = [];
  for (let j = 0; j <= nz; j++) {
    for (let i = 0; i <= nx; i++) {
      const x = a.x - hx + (i * hx * 2) / nx;
      const z = a.z - hz + (j * hz * 2) / nz;
      const wobble = 0.35 * Math.sin(x * 1.3 + z * 0.7) + 0.25 * Math.sin(x * 0.45 - z * 1.9) + 0.15 * Math.sin(x * 3.1 + z * 2.3);
      const d = areaDistance(a, x, z) + wobble;
      const alpha = THREE.MathUtils.clamp(-d / 0.7, 0, 1);
      pos.push(x, 0, z);
      uv.push(x / 3.2, z / 3.2);
      col.push(1, 1, 1, alpha);
      if (i > 0 && j > 0) {
        const p = j * (nx + 1) + i;
        index.push(p - nx - 2, p - 1, p - nx - 1, p - 1, p, p - nx - 1);
      }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 4));
  const normals = new Float32Array(pos.length);
  for (let k = 1; k < normals.length; k += 3) normals[k] = 1;
  g.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
  g.setIndex(index);
  return g;
}

function Paving() {
  const meshes = useMemo(() => {
    const material = new THREE.MeshStandardMaterial({ color: '#EADFCB', map: pavingMap(), vertexColors: true, transparent: true, depthWrite: false, roughness: 0.95, polygonOffset: true, polygonOffsetFactor: -2 });
    return pavedAreas.map((a) => {
      const m = new THREE.Mesh(pavingGeometry(a), material);
      m.position.y = 0.008;
      m.receiveShadow = true;
      // roads are transparent too, so draw order (not depth) decides: paving goes on top where they meet
      m.renderOrder = 1;
      return m;
    });
  }, []);
  return (
    <>
      {meshes.map((m, i) => (
        <primitive key={i} object={m} />
      ))}
    </>
  );
}

// ---------- scattered ground detail: leaves, rocks, mushrooms ----------

function useGroundDetail() {
  return useMemo(() => {
    const r = rng(512);
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const e = new THREE.Euler();
    const v = new THREE.Vector3();
    const s = new THREE.Vector3();
    const color = new THREE.Color();

    // Fallen leaves on the roads and paving.
    const leaves: { x: number; z: number }[] = [];
    for (let guard = 0; leaves.length < 320 && guard < 20000; guard++) {
      const x = (r() * 2 - 1) * (HALF - 2);
      const z = (r() * 2 - 1) * (HALF - 2);
      if (roadDistance(x, z) < 1.7 || onPaving(x, z)) leaves.push({ x, z });
    }
    const leafMesh = new THREE.InstancedMesh(
      new THREE.PlaneGeometry(0.2, 0.2).rotateX(-Math.PI / 2),
      new THREE.MeshStandardMaterial({ map: fallenLeafMap(), alphaTest: 0.5, roughness: 0.9, polygonOffset: true, polygonOffsetFactor: -3 }),
      leaves.length,
    );
    const leafColors = ['#E9A93A', '#D9722F', '#F5B83D', '#B8743C', '#8FA650'];
    leaves.forEach((l, i) => {
      leafMesh.setMatrixAt(i, m.compose(v.set(l.x, 0.012, l.z), q.setFromEuler(e.set(0, r() * Math.PI * 2, 0)), s.setScalar(0.7 + r() * 0.7)));
      leafMesh.setColorAt(i, color.set(leafColors[Math.floor(r() * leafColors.length)]).offsetHSL(0, 0, (r() - 0.5) * 0.1));
    });
    leafMesh.receiveShadow = true;

    // Rocks in small clusters out in the meadows; the big ones are solid.
    const rocks: { x: number; z: number; s: number; yaw: number }[] = [];
    for (let guard = 0; rocks.length < 70 && guard < 4000; guard++) {
      const cx = (r() * 2 - 1) * (HALF - 4);
      const cz = (r() * 2 - 1) * (HALF - 4);
      if (!meadow(cx, cz, 3.2)) continue;
      const n = 1 + Math.floor(r() * 3);
      for (let k = 0; k < n; k++) {
        const x = cx + (r() - 0.5) * 1.6;
        const z = cz + (r() - 0.5) * 1.6;
        const sz = k === 0 ? 0.35 + r() * 0.55 : 0.15 + r() * 0.25;
        if (!meadow(x, z, 2.8) || rocks.some((o) => Math.hypot(o.x - x, o.z - z) < o.s + sz)) continue;
        rocks.push({ x, z, s: sz, yaw: r() * Math.PI * 2 });
      }
    }
    const rockMesh = new THREE.InstancedMesh(rockGeometry(7, 1), mossyStoneMaterial(0.55), rocks.length);
    rocks.forEach((k, i) => {
      rockMesh.setMatrixAt(i, m.compose(v.set(k.x, k.s * 0.18, k.z), q.setFromEuler(e.set((r() - 0.5) * 0.3, k.yaw, (r() - 0.5) * 0.3)), s.set(k.s * (1 + r() * 0.4), k.s * (0.7 + r() * 0.3), k.s)));
      rockMesh.setColorAt(i, color.set(r() < 0.3 ? '#C9BBA2' : palette.rock).offsetHSL(0, 0, (r() - 0.5) * 0.12));
    });
    rockMesh.castShadow = rockMesh.receiveShadow = true;

    // Mushrooms in little rings: a pale stem and a rounded cap.
    const shrooms: { x: number; z: number; s: number; cap: string }[] = [];
    for (let patch = 0, guard = 0; patch < 26 && guard < 3000; guard++) {
      const cx = (r() * 2 - 1) * (HALF - 3);
      const cz = (r() * 2 - 1) * (HALF - 3);
      if (!meadow(cx, cz, 3)) continue;
      patch++;
      const cap = ['#D9483B', '#C9A27A', '#E9C08A', '#B5563F'][Math.floor(r() * 4)];
      for (let k = 3 + Math.floor(r() * 4); k > 0; k--) {
        const a = r() * Math.PI * 2;
        const d = 0.2 + r() * 0.5;
        shrooms.push({ x: cx + Math.cos(a) * d, z: cz + Math.sin(a) * d, s: 0.7 + r() * 0.8, cap });
      }
    }
    const stemMesh = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.025, 0.035, 0.14, 8).translate(0, 0.07, 0), new THREE.MeshStandardMaterial({ color: '#F4ECDD', roughness: 0.8 }), shrooms.length);
    const capMesh = new THREE.InstancedMesh(new THREE.SphereGeometry(0.08, 14, 7, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, 0.7, 1).translate(0, 0.13, 0), new THREE.MeshStandardMaterial({ roughness: 0.55 }), shrooms.length);
    shrooms.forEach((k, i) => {
      m.compose(v.set(k.x, 0, k.z), q.setFromEuler(e.set((r() - 0.5) * 0.25, 0, (r() - 0.5) * 0.25)), s.setScalar(k.s));
      stemMesh.setMatrixAt(i, m);
      capMesh.setMatrixAt(i, m);
      capMesh.setColorAt(i, color.set(k.cap));
    });
    capMesh.castShadow = true;

    return { leafMesh, rockMesh, bigRocks: rocks.filter((k) => k.s > 0.45), stemMesh, capMesh };
  }, []);
}

// ---------- signpost and lanterns ----------

const signTargets = [
  { zone: 'projects' as const, label: 'PROJECTS', color: palette.teal },
  { zone: 'skills' as const, label: 'SKILLS', color: palette.navy },
  { zone: 'about' as const, label: 'ABOUT', color: '#C98A1F' },
  { zone: 'contact' as const, label: 'CONTACT', color: palette.coral },
];
const SIGNPOST = { x: -4.2, z: 6.4 };

/** Arrow-shaped board, pointing along +x, with bevelled edges. */
function arrowGeometry(len: number, h: number) {
  const s = new THREE.Shape();
  s.moveTo(0, -h / 2);
  s.lineTo(len - h * 0.5, -h / 2);
  s.lineTo(len, 0);
  s.lineTo(len - h * 0.5, h / 2);
  s.lineTo(0, h / 2);
  s.closePath();
  return new THREE.ExtrudeGeometry(s, { depth: 0.05, bevelEnabled: true, bevelThickness: 0.015, bevelSize: 0.015, bevelSegments: 2 }).translate(0, 0, -0.025);
}

const signYaw = (zone: (typeof signTargets)[number]['zone']) => {
  const [tx, tz] = zones[zone].spawn;
  return Math.atan2(-(tz - SIGNPOST.z), tx - SIGNPOST.x);
};

function Signpost() {
  // everything static is two meshes: the post with its knob, and the four boards coloured per vertex
  const { post, boards } = useMemo(() => {
    const colour = (g: THREE.BufferGeometry, c: string) => {
      const n = g.toNonIndexed();
      const col = new THREE.Color(c);
      n.setAttribute('color', new THREE.Float32BufferAttribute(Array.from({ length: n.getAttribute('position').count }, () => [col.r, col.g, col.b]).flat(), 3));
      return n;
    };
    const post = mergeGeometries([
      colour(new THREE.CylinderGeometry(0.07, 0.09, 2.7, 10).translate(0, 1.35, 0), palette.woodDark),
      colour(new THREE.SphereGeometry(0.1, 12, 8).translate(0, 2.74, 0), palette.yellow),
    ])!;
    const boards = mergeGeometries(
      signTargets.map((t, i) => colour(arrowGeometry(1.5, 0.32).rotateY(signYaw(t.zone)).translate(0, 2.4 - i * 0.38, 0), t.color)),
    )!;
    return { post, boards };
  }, []);
  return (
    <group position={[SIGNPOST.x, 0, SIGNPOST.z]}>
      <RigidBody type="fixed" colliders={false} userData={{ material: 'wood' }}>
        <CylinderCollider args={[1.35, 0.1]} position={[0, 1.35, 0]} />
      </RigidBody>
      <mesh geometry={post} castShadow>
        <meshStandardMaterial vertexColors roughness={0.8} />
      </mesh>
      <mesh geometry={boards} castShadow>
        <meshStandardMaterial vertexColors roughness={0.7} />
      </mesh>
      {signTargets.map((t, i) => (
        <group key={t.zone} position={[0, 2.4 - i * 0.38, 0]} rotation={[0, signYaw(t.zone), 0]}>
          <Text position={[0.68, 0, 0.045]} fontSize={0.17} color={palette.cream} font={DISPLAY_FONT} anchorX="center" anchorY="middle">
            {t.label}
          </Text>
        </group>
      ))}
    </group>
  );
}

/** Stone lanterns around the home plaza, with a warm glow and a pool of light on the paving. */
function Lanterns() {
  const spots = useMemo(() => {
    const out: [number, number][] = [];
    for (let a = 0; a < Math.PI * 2 && out.length < 7; a += Math.PI / 9) {
      const x = Math.cos(a) * 7.7;
      const z = 1.5 + Math.sin(a) * 7.7;
      if (roadDistance(x, z) < 2.4 || Math.hypot(x - SIGNPOST.x, z - SIGNPOST.z) < 2 || Math.hypot(x + 8, z - 10) < 3.5) continue;
      if (out.some(([ox, oz]) => Math.hypot(ox - x, oz - z) < 4)) continue;
      out.push([x, z]);
    }
    return out;
  }, []);
  const parts = useMemo(() => {
    const stone = new THREE.MeshStandardMaterial({ color: '#CFC4B0', roughness: 0.95 });
    const glow = new THREE.MeshStandardMaterial({ color: '#FFE3A6', emissive: '#FFB547', emissiveIntensity: 2.2, roughness: 0.4 });
    const body = mergeGeometries([
      new THREE.CylinderGeometry(0.26, 0.32, 0.16, 10).translate(0, 0.08, 0),
      new THREE.CylinderGeometry(0.1, 0.13, 0.55, 10).translate(0, 0.43, 0),
      new RoundedBoxGeometry(0.46, 0.08, 0.46, 2, 0.02).translate(0, 0.74, 0),
      new THREE.ConeGeometry(0.4, 0.26, 4, 1).rotateY(Math.PI / 4).translate(0, 1.18, 0),
      new THREE.SphereGeometry(0.05, 8, 6).translate(0, 1.33, 0),
    ].map((g) => g.toNonIndexed()))!;
    const light = new RoundedBoxGeometry(0.3, 0.28, 0.3, 2, 0.04).translate(0, 0.92, 0);
    const pool = new THREE.MeshBasicMaterial({ color: '#FFC870', map: lightPoolMap(), transparent: true, opacity: 0.35, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false });
    return { stone, glow, body, light, pool };
  }, []);
  const meshes = useMemo(() => {
    const m = new THREE.Matrix4();
    const make = (g: THREE.BufferGeometry, mat: THREE.Material, shadow: boolean) => {
      const mesh = new THREE.InstancedMesh(g, mat, spots.length);
      spots.forEach(([x, z], i) => mesh.setMatrixAt(i, m.makeTranslation(x, 0, z)));
      mesh.castShadow = shadow;
      mesh.receiveShadow = true;
      mesh.computeBoundingSphere();
      return mesh;
    };
    return [make(parts.body, parts.stone, true), make(parts.light, parts.glow, false), make(new THREE.PlaneGeometry(3.2, 3.2).rotateX(-Math.PI / 2).translate(0, 0.015, 0), parts.pool, false)];
  }, [spots, parts]);
  return (
    <>
      <RigidBody type="fixed" colliders={false} userData={{ material: 'stone' }}>
        {spots.map(([x, z], i) => (
          <CylinderCollider key={i} args={[0.6, 0.3]} position={[x, 0.6, z]} />
        ))}
      </RigidBody>
      {meshes.map((mesh, i) => (
        <primitive key={i} object={mesh} />
      ))}
    </>
  );
}

// ---------- things to knock about ----------

function barrelGeometry() {
  const pts: THREE.Vector2[] = [];
  for (let i = 0; i <= 10; i++) {
    const t = i / 10;
    pts.push(new THREE.Vector2(0.3 + Math.sin(t * Math.PI) * 0.05, t * 0.9 - 0.45));
  }
  const body = new THREE.LatheGeometry(pts, 18);
  const lids = [0.45, -0.45].map((y) => new THREE.CircleGeometry(0.3, 18).rotateX(y > 0 ? -Math.PI / 2 : Math.PI / 2).translate(0, y, 0));
  const hoops = [-0.28, 0.28].map((y) => new THREE.TorusGeometry(0.335, 0.018, 6, 24).rotateX(Math.PI / 2).translate(0, y, 0));
  // one mesh per barrel: painted body and lids, dark iron hoops (vertex colour multiplies the paint)
  const parts = [body, ...lids, ...hoops].map((g, i) => {
    const n = g.toNonIndexed();
    const c = i < 3 ? 1 : 0.22;
    n.setAttribute('color', new THREE.Float32BufferAttribute(new Array(n.getAttribute('position').count * 3).fill(c), 3));
    return n;
  });
  return mergeGeometries(parts)!;
}

function Knockables() {
  const parts = useMemo(() => {
    const barrel = barrelGeometry();
    const crate = new RoundedBoxGeometry(0.8, 0.8, 0.8, 2, 0.05);
    // beach ball: six coloured segments around the axis
    const ball = new THREE.SphereGeometry(0.45, 24, 16);
    const p = ball.getAttribute('position');
    const cols: number[] = [];
    const segColors = [palette.coral, palette.cream, palette.teal, palette.yellow, palette.cream, palette.navy].map((c) => new THREE.Color(c));
    for (let i = 0; i < p.count; i++) {
      const a = Math.atan2(p.getZ(i), p.getX(i)) + Math.PI;
      const c = Math.abs(p.getY(i)) > 0.42 ? segColors[1] : segColors[Math.floor((a / (Math.PI * 2)) * 6) % 6];
      cols.push(c.r, c.g, c.b);
    }
    ball.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
    return {
      barrel,
      crate,
      ball,
      wood: new THREE.MeshStandardMaterial({ color: '#D39C66', map: woodMap(), roughness: 0.85 }),
      ballMat: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.35 }),
    };
  }, []);
  // Everything starts exactly at rest (standing on the ground or squarely on the crate below) and asleep, so
  // the physics engine skips it until the car or someone bumps into it. A barrel balanced on three others never
  // settled and kept the solver busy every frame.
  const barrels: { p: [number, number, number]; c: string }[] = [
    { p: [warehouse.x - 5.6, 0.45, warehouse.z + 4.4], c: palette.navy },
    { p: [warehouse.x - 4.9, 0.45, warehouse.z + 4.8], c: palette.teal },
    { p: [warehouse.x - 5.3, 0.45, warehouse.z + 5.5], c: palette.coral },
    { p: [warehouse.x - 4.4, 0.45, warehouse.z + 5.9], c: palette.yellow },
  ];
  const crates: [number, number, number][] = [
    [33.2, 0.4, -5.2], [34.02, 0.4, -5.2], [34.84, 0.4, -5.2],
    [33.61, 1.2, -5.2], [34.43, 1.2, -5.2],
    [34.02, 2.0, -5.2],
  ];
  const bodies = useRef<(RapierRigidBody | null)[]>([]);
  useEffect(() => {
    for (const b of bodies.current) b?.sleep();
  }, []);
  let n = 0;
  const keep = () => {
    const i = n++;
    return (b: RapierRigidBody | null) => void (bodies.current[i] = b);
  };
  return (
    <>
      {barrels.map((b, i) => (
        <RigidBody key={i} ref={keep()} position={b.p} colliders={false} linearDamping={0.3} angularDamping={0.4} userData={{ material: 'metal' }}>
          <CylinderCollider args={[0.45, 0.33]} mass={0.25} friction={0.6} />
          <mesh geometry={parts.barrel} castShadow receiveShadow>
            <meshStandardMaterial color={b.c} roughness={0.5} metalness={0.2} vertexColors />
          </mesh>
        </RigidBody>
      ))}
      {crates.map((p, i) => (
        <RigidBody key={i} ref={keep()} position={p} colliders={false} linearDamping={0.2} angularDamping={0.3} userData={{ material: 'wood' }}>
          <CuboidCollider args={[0.4, 0.4, 0.4]} mass={0.2} friction={0.7} />
          <mesh geometry={parts.crate} material={parts.wood} castShadow receiveShadow />
        </RigidBody>
      ))}
      <RigidBody ref={keep()} position={[4.6, 0.45, 3.2]} colliders={false} linearDamping={0.35} angularDamping={0.5} userData={{ material: 'plastic' }}>
        <BallCollider args={[0.45]} mass={0.05} restitution={0.8} friction={0.5} />
        <mesh geometry={parts.ball} material={parts.ballMat} castShadow />
      </RigidBody>
    </>
  );
}

// ---------- fireflies ----------

type Fly = { x: number; y: number; z: number; phase: number; speed: number };

/** Warm specks of light drifting over the grass around the car. */
function Fireflies() {
  const tier = useStore((s) => s.tier);
  const count = FIREFLIES[tier];
  const { mesh, flies } = useMemo(() => {
    const mesh = new THREE.InstancedMesh(
      new THREE.SphereGeometry(0.035, 6, 4),
      new THREE.MeshBasicMaterial({ color: '#FFE9A8', transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }),
      FIREFLIES.high,
    );
    mesh.frustumCulled = false;
    const r = rng(77);
    const flies: Fly[] = Array.from({ length: FIREFLIES.high }, () => ({ x: 0, y: -10, z: 0, phase: r() * 10, speed: 0.3 + r() * 0.4 }));
    return { mesh, flies };
  }, []);
  const tmp = useMemo(() => ({ m: new THREE.Matrix4(), q: new THREE.Quaternion(), p: new THREE.Vector3(), s: new THREE.Vector3() }), []);
  useFrame(({ clock }, rawDt) => {
    const dt = Math.min(rawDt, 1 / 30);
    const now = clock.elapsedTime;
    mesh.count = count;
    for (let i = 0; i < count; i++) {
      const f = flies[i];
      const d = Math.hypot(f.x - carState.x, f.z - carState.z);
      if (f.y < -5 || d > 20) {
        // respawn in a ring around the car, over open ground
        const a = Math.random() * Math.PI * 2;
        const r = 5 + Math.random() * 14;
        f.x = carState.x + Math.cos(a) * r;
        f.z = carState.z + Math.sin(a) * r;
        f.y = 0.3 + Math.random() * 1.3;
      }
      f.x += Math.sin(now * f.speed + f.phase) * dt * 0.4;
      f.z += Math.cos(now * f.speed * 0.8 + f.phase * 1.3) * dt * 0.4;
      f.y += Math.sin(now * 1.3 + f.phase) * dt * 0.15;
      const pulse = 0.35 + 0.65 * Math.max(0, Math.sin(now * 1.7 + f.phase * 3));
      mesh.setMatrixAt(i, tmp.m.compose(tmp.p.set(f.x, f.y, f.z), tmp.q, tmp.s.setScalar(pulse)));
    }
    mesh.instanceMatrix.needsUpdate = true;
  });
  return <primitive object={mesh} />;
}

// ---------- interaction markers ----------

/** Everything you can park on, with the label its marker shows. */
const markerSpots = [
  ...projectPadPositions.slice(0, projects.length).map(([x, z], i) => ({ x, z, y: 3.3, label: projects[i].name })),
  ...contactPads.map(([x, z], i) => ({ x, z, y: 2.6, label: ['GitHub', 'LinkedIn', 'Email'][i] })),
  { x: aboutArea.x, z: aboutArea.z, y: 3.2, label: 'About' },
  { x: warehouse.x, z: warehouse.z + 1, y: 4.2, label: 'Skills' },
];

/** A floating ↵ key and label above each spot, fading in as the car comes near and out once it is parked. */
function Markers() {
  const sprites = useMemo(
    () =>
      markerSpots.map((m) => {
        const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: keyMarkerTexture(m.label), transparent: true, depthWrite: false, opacity: 0 }));
        s.scale.set(2.6, 1.6, 1);
        s.position.set(m.x, m.y, m.z);
        s.visible = false;
        return s;
      }),
    [],
  );
  useFrame(({ clock }) => {
    const parked = useStore.getState().spot !== null;
    sprites.forEach((s, i) => {
      const m = markerSpots[i];
      const d = Math.hypot(carState.x - m.x, carState.z - m.z);
      // near enough to notice, not yet parked on it (the card takes over then)
      const target = d < 11 && !(d < 2.6 && parked) ? THREE.MathUtils.clamp((11 - d) / 4, 0, 1) : 0;
      const mat = s.material;
      mat.opacity += (target - mat.opacity) * 0.12;
      s.visible = mat.opacity > 0.02;
      s.position.y = m.y + Math.sin(clock.elapsedTime * 2 + i) * 0.1;
    });
  });
  return (
    <>
      {sprites.map((s, i) => (
        <primitive key={i} object={s} />
      ))}
    </>
  );
}

/** Paving, scattered leaves, rocks, mushrooms, the signpost, lanterns, things to knock about, fireflies and markers. */
export function Decor() {
  const ground = useGroundDetail();
  const tier = useStore((s) => s.tier);
  return (
    <group>
      <Paving />
      <primitive object={ground.leafMesh} />
      <primitive object={ground.rockMesh} />
      <primitive object={ground.stemMesh} />
      <primitive object={ground.capMesh} />
      <RigidBody type="fixed" colliders={false} userData={{ material: 'stone' }}>
        {ground.bigRocks.map((k, i) => (
          <CylinderCollider key={i} args={[k.s * 0.4, k.s * 0.85]} position={[k.x, k.s * 0.4, k.z]} />
        ))}
      </RigidBody>
      <Signpost />
      <Lanterns />
      <Knockables />
      {tier !== 'low' && <Fireflies />}
      <Markers />
    </group>
  );
}
