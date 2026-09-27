import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { CylinderCollider, RigidBody } from '@react-three/rapier';
import * as THREE from 'three';
import { WORLD_SIZE, isClear, palette, rng } from './layout';
import { actors, type Actor } from './actors';
import { thud } from '../ui/sound';

const HALF = WORLD_SIZE / 2;
const TREE_HEIGHT = 2.6;
const STIFFNESS = 30;
const DAMPING = 1.6;
const PUSH = 1.5;
const MAX_LEAN = 0.45;
const HIT_SPEED = 4;
const MAX_LEAVES = 80;

type Tree = { x: number; z: number; s: number; kind: number; ox: number; oz: number; vx: number; vz: number; hitAt: number; leaf: THREE.Color };
type Leaf = { x: number; y: number; z: number; vx: number; vy: number; vz: number; spin: number; seed: number; age: number; life: number };

/** Tree parts; each becomes one InstancedMesh covering every tree, with zero-scale instances for trees of another kind. */
const parts = [
  { kinds: [0, 1, 2], color: palette.woodDark, flat: false, geometry: () => new THREE.CylinderGeometry(0.16, 0.24, 1.2, 7).translate(0, 0.6, 0) },
  { kinds: [0], color: palette.leafDark, flat: true, geometry: () => new THREE.ConeGeometry(1, 2.2, 7).translate(0, 1.9, 0) },
  { kinds: [1], color: palette.leaf, flat: true, geometry: () => new THREE.IcosahedronGeometry(1, 0).translate(0, 1.8, 0) },
  { kinds: [2], color: palette.yellow, flat: true, geometry: () => new THREE.DodecahedronGeometry(0.85, 0).translate(0, 1.6, 0) },
  { kinds: [2], color: '#E9A93A', flat: true, geometry: () => new THREE.DodecahedronGeometry(0.55, 0).translate(0.3, 2.3, 0.1) },
];

const vertexHead = /* glsl */ `
uniform float uTime;
uniform vec2 uWindDir;
attribute vec4 aTree; // spring lean x, z, wind phase, unused
`;

// Lean grows with height (roots stay put), then is rotated back into the instance's local frame.
const vertexBody = /* glsl */ `
vec3 transformed = vec3(position);
#ifdef USE_INSTANCING
vec2 treePos = instanceMatrix[3].xz;
float gust = sin(uTime * 0.7 - dot(treePos, uWindDir) * 0.15) * 0.5 + 0.5;
vec2 lean = uWindDir * (0.03 + 0.06 * gust * gust)
  + vec2(sin(uTime * 1.3 + aTree.z), sin(uTime * 1.7 + aTree.z * 1.9)) * 0.02
  + aTree.xy;
float k = max(position.y - 0.2, 0.0) / ${TREE_HEIGHT.toFixed(1)};
k *= k;
float s = max(length(instanceMatrix[0].xyz), 1e-4);
vec3 offset = vec3(lean.x, 0.0, lean.y) * k * ${TREE_HEIGHT.toFixed(1)};
transformed += transpose(mat3(instanceMatrix)) * offset / (s * s);
transformed.y -= dot(lean, lean) * k * ${(TREE_HEIGHT / 2).toFixed(1)};
#endif
`;

function swayMaterial<T extends THREE.Material>(material: T, uniforms: Record<string, THREE.IUniform>) {
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = vertexHead + shader.vertexShader.replace('#include <begin_vertex>', vertexBody);
  };
  return material;
}

function layout() {
  const r = rng(7);
  const out: Tree[] = [];
  let guard = 0;
  while (out.length < 70 && guard++ < 3000) {
    const x = (r() * 2 - 1) * (HALF - 3);
    const z = (r() * 2 - 1) * (HALF - 3);
    if (!isClear(x, z)) continue;
    if (out.some((t) => Math.hypot(t.x - x, t.z - z) < 3.2)) continue;
    out.push({ x, z, s: 0.8 + r() * 0.7, kind: Math.floor(r() * 3), ox: 0, oz: 0, vx: 0, vz: 0, hitAt: -Infinity, leaf: new THREE.Color() });
  }
  return out;
}

export function Trees() {
  const velocities = useRef(new Map<Actor, { x: number; z: number; vx: number; vz: number }>());

  const { trees, meshes, treeAttr, uniforms, leaves, leafMesh } = useMemo(() => {
    const trees = layout();
    const r = rng(11);
    const uniforms = { uTime: { value: 0 }, uWindDir: { value: new THREE.Vector2(0.89, 0.45) } };
    const treeData = new Float32Array(trees.length * 4);
    trees.forEach((_, i) => (treeData[i * 4 + 2] = r() * Math.PI * 2));
    const treeAttr = new THREE.InstancedBufferAttribute(treeData, 4).setUsage(THREE.DynamicDrawUsage);
    const depthMaterial = swayMaterial(new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking }), uniforms);

    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const up = new THREE.Vector3(0, 1, 0);
    const yaws = trees.map(() => r() * Math.PI * 2);
    // per-tree hue/lightness jitter so neighbours of the same kind don't look cloned
    const jitter = trees.map(() => [(r() - 0.5) * 0.04, (r() - 0.5) * 0.08] as const);

    const meshes = parts.map((part) => {
      const geometry = part.geometry();
      geometry.setAttribute('aTree', treeAttr);
      const material = swayMaterial(new THREE.MeshStandardMaterial({ flatShading: part.flat }), uniforms);
      const mesh = new THREE.InstancedMesh(geometry, material, trees.length);
      mesh.castShadow = true;
      mesh.customDepthMaterial = depthMaterial;
      const color = new THREE.Color();
      trees.forEach((t, i) => {
        const shown = part.kinds.includes(t.kind);
        q.setFromAxisAngle(up, yaws[i]);
        m.compose(new THREE.Vector3(t.x, 0, t.z), q, new THREE.Vector3().setScalar(shown ? t.s : 0));
        mesh.setMatrixAt(i, m);
        color.set(part.color).offsetHSL(jitter[i][0], 0, jitter[i][1]);
        mesh.setColorAt(i, color);
        if (shown && part.flat && t.leaf.r + t.leaf.g + t.leaf.b === 0) t.leaf.copy(color);
      });
      mesh.computeBoundingSphere();
      return mesh;
    });

    const leafMesh = new THREE.InstancedMesh(
      new THREE.PlaneGeometry(0.2, 0.13),
      new THREE.MeshStandardMaterial({ side: THREE.DoubleSide, roughness: 0.9 }),
      MAX_LEAVES,
    );
    leafMesh.frustumCulled = false;
    leafMesh.castShadow = true;
    const hidden = new THREE.Matrix4().makeScale(0, 0, 0);
    for (let i = 0; i < MAX_LEAVES; i++) {
      leafMesh.setMatrixAt(i, hidden);
      leafMesh.setColorAt(i, new THREE.Color());
    }
    const leaves: (Leaf | null)[] = Array(MAX_LEAVES).fill(null);
    return { trees, meshes, treeAttr, uniforms, leaves, leafMesh };
  }, []);

  const spawnLeaves = (t: Tree, dirX: number, dirZ: number, speed: number) => {
    let n = 3 + Math.floor(speed / 3);
    for (let i = 0; i < MAX_LEAVES && n > 0; i++) {
      if (leaves[i]) continue;
      n--;
      const a = Math.random() * Math.PI * 2;
      const rad = Math.random() * 0.8 * t.s;
      leaves[i] = {
        x: t.x + Math.cos(a) * rad,
        y: (1.4 + Math.random()) * t.s,
        z: t.z + Math.sin(a) * rad,
        vx: dirX * speed * 0.08 + (Math.random() - 0.5) * 1.5,
        vy: 0.5 + Math.random() * 1.5,
        vz: dirZ * speed * 0.08 + (Math.random() - 0.5) * 1.5,
        spin: Math.random() * Math.PI * 2,
        seed: Math.random() * 10,
        age: 0,
        life: 4 + Math.random() * 2,
      };
      leafMesh.setColorAt(i, t.leaf);
    }
    leafMesh.instanceColor!.needsUpdate = true;
  };

  const tmp = useMemo(() => ({ m: new THREE.Matrix4(), q: new THREE.Quaternion(), e: new THREE.Euler(), p: new THREE.Vector3(), s: new THREE.Vector3() }), []);

  useFrame(({ clock }, rawDt) => {
    const dt = Math.min(rawDt, 1 / 30);
    const now = clock.elapsedTime;
    uniforms.uTime.value = now;

    // Actor velocity from position deltas; `prev` is last frame's, still valid on the frame a car stops against a trunk.
    const moving: { a: Actor; vx: number; vz: number; pvx: number; pvz: number }[] = [];
    for (const a of actors) {
      const v = velocities.current.get(a);
      if (!v) {
        velocities.current.set(a, { x: a.x, z: a.z, vx: 0, vz: 0 });
        continue;
      }
      const vx = (a.x - v.x) / Math.max(rawDt, 1e-3);
      const vz = (a.z - v.z) / Math.max(rawDt, 1e-3);
      if (a.radius > 0) moving.push({ a, vx, vz, pvx: v.vx, pvz: v.vz });
      Object.assign(v, { x: a.x, z: a.z, vx, vz });
    }

    const data = treeAttr.array as Float32Array;
    let dirty = false;
    trees.forEach((t, i) => {
      const k = STIFFNESS / t.s;
      let ax = -k * t.ox - DAMPING * t.vx;
      let az = -k * t.oz - DAMPING * t.vz;
      for (const { a, vx, vz, pvx, pvz } of moving) {
        const dx = t.x - a.x;
        const dz = t.z - a.z;
        const d = Math.hypot(dx, dz);
        const range = 1.6 * t.s + a.radius;
        if (d > range) continue;
        const f = (1 - d / range) ** 2;
        ax += vx * f * PUSH;
        az += vz * f * PUSH;

        const speed = Math.hypot(pvx, pvz);
        if (d < 0.3 * t.s + 1.1 && speed > HIT_SPEED && now - t.hitAt > 0.6) {
          t.hitAt = now;
          const kick = (Math.min(speed / 12, 1) * 2.2) / speed;
          t.vx += pvx * kick;
          t.vz += pvz * kick;
          spawnLeaves(t, pvx / speed, pvz / speed, speed);
          thud(Math.min(speed / 15, 1));
        }
      }
      t.vx += ax * dt;
      t.vz += az * dt;
      t.ox += t.vx * dt;
      t.oz += t.vz * dt;
      const lean = Math.hypot(t.ox, t.oz);
      if (lean > MAX_LEAN) {
        t.ox *= MAX_LEAN / lean;
        t.oz *= MAX_LEAN / lean;
      }
      if (data[i * 4] !== t.ox || data[i * 4 + 1] !== t.oz) {
        data[i * 4] = t.ox;
        data[i * 4 + 1] = t.oz;
        dirty = true;
      }
    });
    if (dirty) treeAttr.needsUpdate = true;

    let anyLeaf = false;
    leaves.forEach((l, i) => {
      if (!l) return;
      anyLeaf = true;
      l.age += dt;
      if (l.age > l.life) {
        leaves[i] = null;
        leafMesh.setMatrixAt(i, tmp.m.makeScale(0, 0, 0));
        return;
      }
      const onGround = l.y <= 0.02;
      if (!onGround) {
        const drag = 1 - 1.8 * dt;
        l.vx = l.vx * drag + Math.sin(now * 5 + l.seed) * 2 * dt;
        l.vz = l.vz * drag + Math.cos(now * 4 + l.seed) * 2 * dt;
        l.vy = Math.max(l.vy - 4 * dt, -1.2);
        l.x += l.vx * dt;
        l.y = Math.max(l.y + l.vy * dt, 0.02);
        l.z += l.vz * dt;
        l.spin += dt * 4;
      }
      tmp.e.set(onGround ? -Math.PI / 2 : Math.sin(l.spin + l.seed) * 1.2, l.seed, onGround ? 0 : Math.cos(l.spin) * 0.8);
      const fade = Math.min(1, (l.life - l.age) / 0.6);
      leafMesh.setMatrixAt(i, tmp.m.compose(tmp.p.set(l.x, l.y, l.z), tmp.q.setFromEuler(tmp.e), tmp.s.setScalar(fade)));
    });
    if (anyLeaf) leafMesh.instanceMatrix.needsUpdate = true;
  });

  return (
    <group>
      {/* colliders stay static; only the visuals sway */}
      <RigidBody type="fixed" colliders={false}>
        {trees.map((t, i) => (
          <CylinderCollider key={i} args={[1.2 * t.s, 0.3 * t.s]} position={[t.x, 1.2 * t.s, t.z]} />
        ))}
      </RigidBody>
      {meshes.map((mesh, i) => (
        <primitive key={i} object={mesh} />
      ))}
      <primitive object={leafMesh} />
    </group>
  );
}
