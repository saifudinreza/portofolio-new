import { useMemo } from 'react';
import { CuboidCollider, CylinderCollider, RigidBody } from '@react-three/rapier';
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { WORLD_SIZE, lighthouse, scaled, distanceToSegment, isClear, pondDistance, rng, trails } from './layout';
import { trackLamp } from './dayCycle';
import { fallenLeafMap } from './decorTextures';
import { woodMap } from './textures';
import { useStore } from '../store';

// Extra scenery so no corner of the island is empty: tree stumps and logs, crate stacks, leaves lying in the
// meadows, and a lighthouse on the south-west coast that can be seen from across the island. Everything is
// instanced (one draw call per kind); only the crates and the lighthouse are solid.

const HALF = WORLD_SIZE / 2;
const up = new THREE.Vector3(0, 1, 0);

/** Open meadow: clear of roads, areas, pads, the pond, the river and footpaths. */
const open = (x: number, z: number, margin = 3.2) =>
  Math.abs(x) < HALF - 3 && Math.abs(z) < HALF - 3 && isClear(x, z, margin) && pondDistance(x, z) > 1.8 && trails.every((t) => distanceToSegment(x, z, t) > 1.8);

/** Lighthouse position, out on the south-west coast of the enlarged island; clear of the river, roads and every zone. */
const LIGHTHOUSE = lighthouse;

const mat = (x: number, y: number, z: number, yaw: number, s: number | THREE.Vector3 = 1) =>
  new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromAxisAngle(up, yaw), typeof s === 'number' ? new THREE.Vector3(s, s, s) : s);

/** Paint a geometry's vertices by face direction: end grain (facing up/down) light, bark dark. */
function endGrain(g: THREE.BufferGeometry, bark: THREE.Color, cut: THREE.Color) {
  const n = g.getAttribute('normal');
  const col: number[] = [];
  for (let i = 0; i < n.count; i++) {
    const c = Math.abs(n.getY(i)) > 0.9 ? cut : bark;
    col.push(c.r, c.g, c.b);
  }
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  return g;
}

function instance(geometry: THREE.BufferGeometry, material: THREE.Material, matrices: THREE.Matrix4[], opts: { shadow?: boolean; colors?: THREE.Color[] } = {}) {
  const mesh = new THREE.InstancedMesh(geometry, material, Math.max(1, matrices.length));
  mesh.count = matrices.length;
  matrices.forEach((m, i) => {
    mesh.setMatrixAt(i, m);
    if (opts.colors) mesh.setColorAt(i, opts.colors[i]);
  });
  mesh.castShadow = opts.shadow ?? true;
  mesh.receiveShadow = true;
  mesh.computeBoundingSphere();
  return mesh;
}

function useScenery() {
  return useMemo(() => {
    const r = rng(1701);
    const bark = new THREE.Color('#7A5639');
    const cut = new THREE.Color('#E2BE8A');

    // Stumps, some with a log or two lying next to them.
    const stumps: THREE.Matrix4[] = [];
    const logs: THREE.Matrix4[] = [];
    for (let guard = 0, n = 0; n < scaled(16) && guard < scaled(3000); guard++) {
      const x = (r() * 2 - 1) * (HALF - 4);
      const z = (r() * 2 - 1) * (HALF - 4);
      if (!open(x, z)) continue;
      n++;
      stumps.push(mat(x, 0, z, r() * 6.3, 0.8 + r() * 0.5));
      if (r() < 0.6) {
        const yaw = r() * Math.PI;
        const lx = x + Math.cos(yaw) * 0.9;
        const lz = z + Math.sin(yaw) * 0.9;
        if (open(lx, lz)) logs.push(mat(lx, 0.14, lz, -yaw, 0.8 + r() * 0.5));
      }
    }

    // Crate stacks: two or three boxes, solid.
    const crates: { m: THREE.Matrix4; x: number; y: number; z: number; yaw: number; s: number }[] = [];
    for (let guard = 0, n = 0; n < scaled(12) && guard < scaled(3000); guard++) {
      const cx = (r() * 2 - 1) * (HALF - 5);
      const cz = (r() * 2 - 1) * (HALF - 5);
      if (!open(cx, cz, 3.4)) continue;
      n++;
      const yaw = r() * 6.3;
      const count = 2 + Math.floor(r() * 2);
      for (let k = 0; k < count; k++) {
        const s = 0.55 + r() * 0.15;
        // two on the ground side by side, the third on top
        const [dx, dy] = k === 2 ? [0.12, 0.62] : [k * 0.7 - 0.35, 0];
        const x = cx + Math.cos(yaw) * dx;
        const z = cz - Math.sin(yaw) * dx;
        crates.push({ m: mat(x, 0.31 + dy, z, yaw + (r() - 0.5) * 0.25, s / 0.62), x, y: 0.31 + dy, z, yaw, s });
      }
    }

    // Fallen leaves lying in the meadows (the ones on the roads live in Decor).
    const leaves: THREE.Matrix4[] = [];
    const leafColors: THREE.Color[] = [];
    const palette4 = ['#E9A93A', '#D9722F', '#F5B83D', '#B8743C'];
    for (let guard = 0; leaves.length < scaled(260) && guard < scaled(6000); guard++) {
      const x = (r() * 2 - 1) * (HALF - 3);
      const z = (r() * 2 - 1) * (HALF - 3);
      if (!open(x, z, 2.6)) continue;
      leaves.push(mat(x, 0.03, z, r() * 6.3, 0.9 + r() * 0.8));
      leafColors.push(new THREE.Color(palette4[Math.floor(r() * palette4.length)]).offsetHSL(0, 0, (r() - 0.5) * 0.1));
    }

    const wood = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, map: woodMap() });
    const stumpGeo = endGrain(new THREE.CylinderGeometry(0.24, 0.32, 0.42, 10).translate(0, 0.21, 0), bark, cut);
    // the log lies along x, so its end grain faces sideways: colour by the x component of the normal
    const logGeo = new THREE.CylinderGeometry(0.13, 0.14, 1.3, 8).rotateZ(Math.PI / 2);
    const ln = logGeo.getAttribute('normal');
    const lc: number[] = [];
    for (let i = 0; i < ln.count; i++) {
      const c = Math.abs(ln.getX(i)) > 0.9 ? cut : bark;
      lc.push(c.r, c.g, c.b);
    }
    logGeo.setAttribute('color', new THREE.Float32BufferAttribute(lc, 3));

    const crateGeo = mergeGeometries([
      new RoundedBoxGeometry(0.62, 0.62, 0.62, 2, 0.03).toNonIndexed(),
      ...[-0.31, 0.31].map((y) => new RoundedBoxGeometry(0.66, 0.06, 0.66, 1, 0.01).translate(0, y, 0).toNonIndexed()),
    ])!;
    const crateMat = new THREE.MeshStandardMaterial({ color: '#C68B59', roughness: 0.85, map: woodMap() });

    const leafMat = new THREE.MeshStandardMaterial({ map: fallenLeafMap(), alphaTest: 0.5, roughness: 0.9, polygonOffset: true, polygonOffsetFactor: -3 });

    return {
      crateBoxes: crates,
      meshes: [
        instance(stumpGeo, wood, stumps),
        instance(logGeo, wood, logs),
        instance(crateGeo, crateMat, crates.map((c) => c.m)),
        instance(new THREE.PlaneGeometry(0.2, 0.2).rotateX(-Math.PI / 2), leafMat, leaves, { shadow: false, colors: leafColors }),
      ],
    };
  }, []);
}

/** White tower with three red bands, a gallery, a glowing lantern room and a red cap. */
function useLighthouse() {
  return useMemo(() => {
    const white = new THREE.Color('#F4ECDD');
    const red = new THREE.Color('#D9483B');
    const tint = (g: THREE.BufferGeometry, c: THREE.Color) => {
      const n = g.getAttribute('position').count;
      g.setAttribute('color', new THREE.Float32BufferAttribute(Array.from({ length: n }, () => [c.r, c.g, c.b]).flat(), 3));
      return g.toNonIndexed();
    };
    // tapered tower in five stacked segments, alternating white and red
    const parts: THREE.BufferGeometry[] = [];
    const base = 1.5;
    const top = 0.95;
    const height = 8;
    const segs = 5;
    for (let i = 0; i < segs; i++) {
      const r0 = base + ((top - base) * i) / segs;
      const r1 = base + ((top - base) * (i + 1)) / segs;
      const h = height / segs;
      parts.push(tint(new THREE.CylinderGeometry(r1, r0, h, 14, 1, true).translate(0, i * h + h / 2, 0), i % 2 ? red : white));
    }
    parts.push(tint(new THREE.CylinderGeometry(base + 0.25, base + 0.35, 0.5, 14).translate(0, 0.25, 0), new THREE.Color('#9C8F7B')));
    parts.push(tint(new THREE.CylinderGeometry(1.35, 1.1, 0.25, 14).translate(0, height + 0.12, 0), new THREE.Color('#40444C')));
    parts.push(tint(new THREE.CylinderGeometry(0.1, 0.1, 0.6, 6).translate(1.2, height + 0.55, 0), new THREE.Color('#40444C')));
    parts.push(tint(new THREE.ConeGeometry(1.05, 0.9, 14).translate(0, height + 1.95, 0), red));
    const body = mergeGeometries(parts)!;
    const lantern = new THREE.CylinderGeometry(0.72, 0.72, 1.1, 12).translate(0, height + 0.8, 0);
    const bodyMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, side: THREE.DoubleSide });
    const glow = trackLamp(new THREE.MeshStandardMaterial({ color: '#FFF1C9', emissive: '#FFC26B', emissiveIntensity: 2.4, roughness: 0.3 }));
    return { body, lantern, bodyMat, glow };
  }, []);
}

export function Scenery() {
  const tier = useStore((s) => s.tier);
  const { meshes, crateBoxes } = useScenery();
  const lh = useLighthouse();
  return (
    <group>
      {/* the leaves are a detail only worth drawing above Low */}
      {meshes.map((mesh, i) => (i === 3 && tier === 'low' ? null : <primitive key={i} object={mesh} />))}
      <RigidBody type="fixed" colliders={false} userData={{ material: 'wood' }}>
        {crateBoxes.map((c, i) => (
          <CuboidCollider key={i} args={[c.s / 2, c.s / 2, c.s / 2]} position={[c.x, c.y, c.z]} rotation={[0, c.yaw, 0]} />
        ))}
      </RigidBody>
      <group position={[LIGHTHOUSE.x, 0, LIGHTHOUSE.z]}>
        <mesh geometry={lh.body} material={lh.bodyMat} castShadow receiveShadow />
        <mesh geometry={lh.lantern} material={lh.glow} />
        <RigidBody type="fixed" colliders={false} userData={{ material: 'stone' }}>
          <CylinderCollider args={[4.5, 1.45]} position={[0, 4.5, 0]} />
        </RigidBody>
      </group>
    </group>
  );
}
