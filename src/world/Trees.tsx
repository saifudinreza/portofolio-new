import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { CylinderCollider, RigidBody } from '@react-three/rapier';
import * as THREE from 'three';
import { WORLD_SIZE, distanceToSegment, isClear, pondDistance, rng, trails } from './layout';
import { actors, type Actor } from './actors';
import { carState } from './carState';
import { barkMap, leafClusterMap, needleMap, singleLeafMap } from './foliageTextures';
import { canopyGeometry, coreGeometry, kinds, setCardShare, trunkGeometry } from './foliage';
import { useStore, type Tier } from '../store';

const HALF = WORLD_SIZE / 2;
const TREE_HEIGHT = 3.6;
const STIFFNESS = 30;
const DAMPING = 1.6;
const PUSH = 1.5;
const MAX_LEAN = 0.45;
const HIT_SPEED = 4;
const MAX_LEAVES = 140;
/** Seconds between leaves drifting down from some tree near the car, per quality tier. */
const AMBIENT_LEAF_EVERY: Record<Tier, number> = { low: 0.9, medium: 0.4, high: 0.22 };

type Tree = { x: number; z: number; s: number; kind: number; slot: number; ox: number; oz: number; vx: number; vz: number; hitAt: number };
type Leaf = { x: number; y: number; z: number; vx: number; vy: number; vz: number; spin: number; seed: number; age: number; life: number };

// ---------- sway ----------

const vertexHead = /* glsl */ `
uniform float uTime;
uniform vec2 uWindDir;
attribute vec4 aTree; // spring lean x, z, wind phase, unused
`;

// Lean grows with height (roots stay put), then is rotated back into the instance's local frame.
// Leaf cards also flutter a little on their own.
const vertexBody = /* glsl */ `
vec3 transformed = vec3(position);
#ifdef LEAF_FLUTTER
transformed += vec3(
  sin(uTime * 2.3 + position.x * 3.1 + position.z * 2.3 + aTree.z),
  sin(uTime * 2.9 + position.y * 3.7 + aTree.z) * 0.6,
  cos(uTime * 2.1 + position.z * 2.9 + position.y * 1.7)
) * 0.025;
#endif
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

function swayMaterial<T extends THREE.Material>(material: T, uniforms: Record<string, THREE.IUniform>, flutter = false) {
  if (flutter) material.defines = { ...material.defines, LEAF_FLUTTER: '' };
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = vertexHead + shader.vertexShader.replace('#include <begin_vertex>', vertexBody);
  };
  return material;
}

function pickKind(v: number) {
  let acc = 0;
  for (let i = 0; i < kinds.length; i++) {
    acc += kinds[i].weight;
    if (v < acc) return i;
  }
  return 0;
}

function layout() {
  const r = rng(7);
  const out: Tree[] = [];
  let guard = 0;
  while (out.length < 70 && guard++ < 3000) {
    const x = (r() * 2 - 1) * (HALF - 3);
    const z = (r() * 2 - 1) * (HALF - 3);
    // extra room around the pond so canopies don't overhang the rim
    if (!isClear(x, z) || pondDistance(x, z) < 1.6 || trails.some((seg) => distanceToSegment(x, z, seg) < 2)) continue;
    if (out.some((t) => Math.hypot(t.x - x, t.z - z) < 3.2)) continue;
    out.push({ x, z, s: 0.8 + r() * 0.5, kind: pickKind(r()), slot: 0, ox: 0, oz: 0, vx: 0, vz: 0, hitAt: -Infinity });
  }
  return out;
}

/** Trees and big shrubs in five kinds, swaying in the wind and when something brushes or hits them. */
export function Trees() {
  const velocities = useRef(new Map<Actor, { x: number; z: number; vx: number; vz: number }>());
  const tier = useStore((s) => s.tier);
  const ambient = useRef(0);

  const { trees, meshes, attrs, uniforms, leaves, leafMesh } = useMemo(() => {
    const trees = layout();
    const r = rng(11);
    const uniforms = { uTime: { value: 0 }, uWindDir: { value: new THREE.Vector2(0.89, 0.45) } };
    const leafTex = leafClusterMap();
    const needleTex = needleMap();
    const bark = barkMap();
    const trunkDepth = swayMaterial(new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking }), uniforms);

    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const up = new THREE.Vector3(0, 1, 0);
    const color = new THREE.Color();

    const meshes: THREE.InstancedMesh[] = [];
    const attrs: THREE.InstancedBufferAttribute[] = [];
    kinds.forEach((kind, ki) => {
      const mine = trees.filter((t) => t.kind === ki);
      mine.forEach((t, i) => (t.slot = i));
      const data = new Float32Array(Math.max(mine.length, 1) * 4);
      mine.forEach((_, i) => (data[i * 4 + 2] = r() * Math.PI * 2));
      const attr = new THREE.InstancedBufferAttribute(data, 4).setUsage(THREE.DynamicDrawUsage);
      attrs.push(attr);
      if (!mine.length) return;

      const map = kind.texture === 'needles' ? needleTex : leafTex;
      const trunkGeo = trunkGeometry(kind);
      const canopyGeo = canopyGeometry(kind, 100 + ki);
      const coreGeo = coreGeometry(kind);
      trunkGeo.setAttribute('aTree', attr);
      canopyGeo.setAttribute('aTree', attr);
      coreGeo.setAttribute('aTree', attr);
      const core = new THREE.InstancedMesh(coreGeo, swayMaterial(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95 }), uniforms), mine.length);
      core.customDepthMaterial = trunkDepth;
      core.castShadow = core.receiveShadow = true;
      const trunk = new THREE.InstancedMesh(trunkGeo, swayMaterial(new THREE.MeshStandardMaterial({ color: kind.bark, map: bark, roughness: 0.95 }), uniforms), mine.length);
      const canopy = new THREE.InstancedMesh(
        canopyGeo,
        swayMaterial(new THREE.MeshStandardMaterial({ map, alphaTest: 0.5, side: THREE.DoubleSide, vertexColors: true, roughness: 0.85 }), uniforms, true),
        mine.length,
      );
      trunk.customDepthMaterial = trunkDepth;
      // the solid core casts the canopy's shadow; re-rendering every alpha-tested card into the shadow map
      // cost about a sixth of the frame on High for a shadow that looks the same
      trunk.castShadow = true;
      canopy.castShadow = false;
      trunk.receiveShadow = canopy.receiveShadow = true;
      mine.forEach((t, i) => {
        m.compose(new THREE.Vector3(t.x, 0, t.z), q.setFromAxisAngle(up, r() * Math.PI * 2), new THREE.Vector3().setScalar(t.s));
        trunk.setMatrixAt(i, m);
        canopy.setMatrixAt(i, m);
        core.setMatrixAt(i, m);
        // per-tree lightness nudge so neighbours of the same kind don't look cloned
        const l = 0.9 + r() * 0.18;
        canopy.setColorAt(i, color.setRGB(l, l, l));
        core.setColorAt(i, color);
        trunk.setColorAt(i, color.setRGB(l, l, l));
      });
      trunk.computeBoundingSphere();
      canopy.computeBoundingSphere();
      core.computeBoundingSphere();
      meshes.push(trunk, core, canopy);
    });

    const leafMesh = new THREE.InstancedMesh(
      new THREE.PlaneGeometry(0.2, 0.2),
      new THREE.MeshStandardMaterial({ side: THREE.DoubleSide, roughness: 0.9, map: singleLeafMap(), alphaTest: 0.5 }),
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
    return { trees, meshes, attrs, uniforms, leaves, leafMesh };
  }, []);

  useEffect(() => {
    for (const m of meshes) if ((m.material as THREE.MeshStandardMaterial).alphaTest > 0) setCardShare(m.geometry, tier);
  }, [meshes, tier]);

  const dropLeaf = (t: Tree, vx: number, vy: number, vz: number, y: number, life: number) => {
    const i = leaves.indexOf(null);
    if (i < 0) return;
    const a = Math.random() * Math.PI * 2;
    const rad = Math.random() * 0.9 * t.s;
    leaves[i] = {
      x: t.x + Math.cos(a) * rad,
      y,
      z: t.z + Math.sin(a) * rad,
      vx,
      vy,
      vz,
      spin: Math.random() * Math.PI * 2,
      seed: Math.random() * 10,
      age: 0,
      life,
    };
    const k = kinds[t.kind];
    leafMesh.setColorAt(i, new THREE.Color(k.colors[Math.floor(Math.random() * k.colors.length)]));
    leafMesh.instanceColor!.needsUpdate = true;
  };

  const spawnLeaves = (t: Tree, dirX: number, dirZ: number, speed: number) => {
    const k = kinds[t.kind];
    for (let n = 3 + Math.floor(speed / 3); n > 0; n--) {
      const vx = dirX * speed * 0.08 + (Math.random() - 0.5) * 1.5;
      const vz = dirZ * speed * 0.08 + (Math.random() - 0.5) * 1.5;
      dropLeaf(t, vx, 0.5 + Math.random() * 1.5, vz, (Math.max(k.leafY, 0.8) + Math.random()) * t.s, 4 + Math.random() * 2);
    }
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

    const dirty = new Set<number>();
    trees.forEach((t) => {
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
      const data = attrs[t.kind].array as Float32Array;
      if (data[t.slot * 4] !== t.ox || data[t.slot * 4 + 1] !== t.oz) {
        data[t.slot * 4] = t.ox;
        data[t.slot * 4 + 1] = t.oz;
        dirty.add(t.kind);
      }
    });
    for (const k of dirty) attrs[k].needsUpdate = true;

    // Now and then a leaf lets go from a tree near the car and drifts down on the wind.
    ambient.current += dt;
    if (ambient.current > AMBIENT_LEAF_EVERY[tier]) {
      ambient.current = 0;
      const t = trees[Math.floor(Math.random() * trees.length)];
      if (kinds[t.kind].sheds && Math.hypot(t.x - carState.x, t.z - carState.z) < 26) {
        dropLeaf(t, uniforms.uWindDir.value.x * 0.6, 0, uniforms.uWindDir.value.y * 0.6, kinds[t.kind].leafY * t.s * (0.8 + Math.random() * 0.3), 7 + Math.random() * 3);
      }
    }

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
        l.vy = Math.max(l.vy - 4 * dt, -0.9);
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
      <RigidBody type="fixed" colliders={false} userData={{ material: 'foliage' }}>
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
