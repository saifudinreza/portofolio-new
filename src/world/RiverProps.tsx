import { useEffect, useMemo } from 'react';
import { CuboidCollider, RigidBody } from '@react-three/rapier';
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { RIVER_BANK, RIVER_HALF_WIDTH, RIVER_WATER, WORLD_SIZE, palette, riverPath, rng, terrainHeight } from './layout';
import { mossyStoneMaterial } from './stone';
import { trackLamp } from './dayCycle';

const HALF = WORLD_SIZE / 2;
/** The river on the island only (not the stretches that run off past the cliffs). */
const path = riverPath.filter((p) => Math.max(Math.abs(p.x), Math.abs(p.z)) <= HALF - 6);

/**
 * A spot on the bank: a point `frac` (0..1) of the way down the river, `across` metres to one side (side +1 is the
 * left of the flow, -1 the right), plus the river's direction (tx, tz) and the direction towards the water (wx, wz).
 */
export function bankSpot(frac: number, side: 1 | -1, across: number) {
  const p = path[Math.floor(frac * (path.length - 1))];
  const x = p.x - p.tz * side * across;
  const z = p.z + p.tx * side * across;
  const len = Math.hypot(p.x - x, p.z - z) || 1;
  return { x, z, tx: p.tx, tz: p.tz, wx: (p.x - x) / len, wz: (p.z - z) / len };
}

const DOCK_LEN = 4.6;
const DECK_Y = 0.08;
const WALL_LEN = 8;

/** Local (lx across the pier, lz along it, from the shore out over the water) to world, for a pier at `at` facing `yaw`. */
const toWorld = (at: { x: number; z: number }, yaw: number, lx: number, lz: number): [number, number] => [
  at.x + Math.sin(yaw) * lz + Math.cos(yaw) * lx,
  at.z + Math.cos(yaw) * lz - Math.sin(yaw) * lx,
];

/** A wooden fishing pier with a moored rowing boat, a stone retaining wall, and lantern posts along the river. */
export function RiverProps() {
  const parts = useMemo(() => {
    const r = rng(311);
    const m4 = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const e = new THREE.Euler();
    const v = new THREE.Vector3();
    const sc = new THREE.Vector3();
    const color = new THREE.Color();

    // ---- pier ----
    const dock = bankSpot(0.12, 1, RIVER_HALF_WIDTH + RIVER_BANK * 0.9);
    const dockYaw = Math.atan2(dock.wx, dock.wz);
    const plankCount = Math.floor(DOCK_LEN / 0.24);
    const planks = new THREE.InstancedMesh(new RoundedBoxGeometry(1.3, 0.05, 0.21, 1, 0.012), new THREE.MeshStandardMaterial({ roughness: 0.9 }), plankCount);
    for (let i = 0; i < plankCount; i++) {
      planks.setMatrixAt(i, m4.compose(v.set((r() - 0.5) * 0.04, DECK_Y, 0.14 + i * 0.24), q.setFromEuler(e.set(0, (r() - 0.5) * 0.03, 0)), sc.set(1, 1, 1)));
      planks.setColorAt(i, color.set(palette.wood).offsetHSL(0, 0, (r() - 0.5) * 0.12));
    }
    planks.castShadow = planks.receiveShadow = true;
    const postSpots: { lx: number; lz: number; h: number }[] = [];
    for (const lz of [0.5, 1.9, 3.3, 4.5]) {
      for (const lx of [-0.62, 0.62]) {
        const [wx, wz] = toWorld(dock, dockYaw, lx, lz);
        postSpots.push({ lx, lz, h: DECK_Y + 0.35 - terrainHeight(wx, wz) });
      }
    }
    const posts = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.06, 0.07, 1, 8).translate(0, -0.5, 0), new THREE.MeshStandardMaterial({ color: palette.woodDark, roughness: 1 }), postSpots.length);
    postSpots.forEach((k, i) => posts.setMatrixAt(i, m4.compose(v.set(k.lx, DECK_Y + 0.35, k.lz), q.identity(), sc.set(1, k.h, 1))));
    posts.castShadow = true;

    // ---- rowing boat, moored beside the pier end ----
    const boatGeo = new THREE.SphereGeometry(1, 20, 10, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2);
    const bp = boatGeo.getAttribute('position');
    for (let i = 0; i < bp.count; i++) {
      // pinch the ends into a bow and a stern, then stretch it into a boat
      const z = bp.getZ(i);
      bp.setXYZ(i, bp.getX(i) * (1 - 0.8 * z * z) * 0.46, bp.getY(i) * 0.36 + 0.3, z * 1.2);
    }
    boatGeo.computeVertexNormals();
    const boatMat = new THREE.MeshStandardMaterial({ color: palette.coral, roughness: 0.8, side: THREE.DoubleSide });
    const seatGeo = new THREE.BoxGeometry(0.8, 0.05, 0.22);
    const seatMat = new THREE.MeshStandardMaterial({ color: palette.wood, roughness: 0.9 });
    const oarGeo = new THREE.CylinderGeometry(0.02, 0.02, 1.4, 5);
    const boat = { lx: 1.75, lz: 3.2, y: RIVER_WATER - 0.12, yaw: 0.12 };

    // ---- stone retaining wall on the east reach ----
    const wall = bankSpot(0.8, -1, RIVER_HALF_WIDTH + RIVER_BANK + 0.4);
    const wallYaw = Math.atan2(wall.tx, wall.tz);
    const blocks: THREE.Matrix4[] = [];
    for (let c = 0; c < 3; c++) {
      for (let t = -WALL_LEN / 2 + (c % 2) * 0.45; t < WALL_LEN / 2 - 0.4; ) {
        const len = 0.8 + r() * 0.35;
        blocks.push(new THREE.Matrix4().compose(v.set((r() - 0.5) * 0.05, 0.14 + c * 0.27, t + len / 2), q.setFromEuler(e.set(0, (r() - 0.5) * 0.06, 0)), sc.set(0.42, 0.28, len - 0.04)));
        t += len;
      }
    }
    const wallMesh = new THREE.InstancedMesh(new RoundedBoxGeometry(1, 1, 1, 2, 0.14), mossyStoneMaterial(0.4), blocks.length);
    blocks.forEach((b, i) => {
      wallMesh.setMatrixAt(i, b);
      wallMesh.setColorAt(i, color.set(r() < 0.3 ? palette.groundEdge : palette.rock).offsetHSL(0, 0, (r() - 0.5) * 0.1));
    });
    wallMesh.castShadow = wallMesh.receiveShadow = true;

    // ---- lantern posts ----
    const lanternSpots = [
      bankSpot(0.19, -1, RIVER_HALF_WIDTH + RIVER_BANK + 0.6),
      bankSpot(0.63, 1, RIVER_HALF_WIDTH + RIVER_BANK + 0.6),
      bankSpot(0.92, -1, RIVER_HALF_WIDTH + RIVER_BANK + 0.6),
    ].map((s) => ({ x: s.x, z: s.z }));
    const lampMat = trackLamp(new THREE.MeshStandardMaterial({ color: '#FFF1C9', emissive: '#FFC26B', emissiveIntensity: 2.2, roughness: 0.3 }));
    const lampPost = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.05, 0.07, 1.7, 8).translate(0, 0.85, 0), new THREE.MeshStandardMaterial({ color: palette.woodDark, roughness: 1 }), lanternSpots.length);
    const lamp = new THREE.InstancedMesh(new RoundedBoxGeometry(0.24, 0.3, 0.24, 2, 0.05), lampMat, lanternSpots.length);
    const lampCap = new THREE.InstancedMesh(new THREE.ConeGeometry(0.22, 0.16, 4).rotateY(Math.PI / 4).translate(0, 0.08, 0), new THREE.MeshStandardMaterial({ color: palette.coral, roughness: 0.8 }), lanternSpots.length);
    lanternSpots.forEach((l, i) => {
      const y = terrainHeight(l.x, l.z);
      lampPost.setMatrixAt(i, m4.compose(v.set(l.x, y, l.z), q.identity(), sc.set(1, 1, 1)));
      lamp.setMatrixAt(i, m4.compose(v.set(l.x, y + 1.85, l.z), q.identity(), sc.set(1, 1, 1)));
      lampCap.setMatrixAt(i, m4.compose(v.set(l.x, y + 2.0, l.z), q.identity(), sc.set(1, 1, 1)));
    });
    lampPost.castShadow = true;

    return { dock, dockYaw, planks, posts, boatGeo, boatMat, seatGeo, seatMat, oarGeo, boat, wall, wallYaw, wallMesh, lanternSpots, lampPost, lamp, lampCap };
  }, []);

  useEffect(
    () => () => {
      for (const m of [parts.planks, parts.posts, parts.wallMesh, parts.lampPost, parts.lamp, parts.lampCap]) m.geometry.dispose();
      parts.boatGeo.dispose();
      parts.seatGeo.dispose();
      parts.oarGeo.dispose();
    },
    [parts],
  );

  const { dock, dockYaw, boat, wall, wallYaw, lanternSpots } = parts;
  const wallY = terrainHeight(wall.x, wall.z);
  return (
    <group>
      {/* pier and boat share one fixed body, in the pier's own frame (local z runs out over the water) */}
      <RigidBody type="fixed" colliders={false} position={[dock.x, 0, dock.z]} rotation={[0, dockYaw, 0]} userData={{ material: 'wood' }}>
        <CuboidCollider args={[0.65, 0.05, DOCK_LEN / 2]} position={[0, DECK_Y, DOCK_LEN / 2]} />
        <CuboidCollider args={[0.4, 0.2, 1.2]} position={[boat.lx, boat.y + 0.2, boat.lz]} rotation={[0, boat.yaw, 0]} />
        <primitive object={parts.planks} />
        <primitive object={parts.posts} />
        <group position={[boat.lx, boat.y, boat.lz]} rotation={[0, boat.yaw, 0]}>
          <mesh geometry={parts.boatGeo} material={parts.boatMat} castShadow receiveShadow />
          <mesh geometry={parts.seatGeo} material={parts.seatMat} position={[0, 0.3, 0.1]} />
          <mesh geometry={parts.oarGeo} material={parts.seatMat} position={[0.38, 0.38, -0.1]} rotation={[0.2, 0, Math.PI / 2 - 0.2]} />
          <mesh geometry={parts.oarGeo} material={parts.seatMat} position={[-0.38, 0.38, -0.1]} rotation={[0.2, 0, -Math.PI / 2 + 0.2]} />
        </group>
      </RigidBody>
      <RigidBody type="fixed" colliders={false} position={[wall.x, wallY, wall.z]} rotation={[0, wallYaw, 0]} userData={{ material: 'stone' }}>
        <CuboidCollider args={[0.22, 0.42, WALL_LEN / 2]} position={[0, 0.42, 0]} />
        <primitive object={parts.wallMesh} />
      </RigidBody>
      <RigidBody type="fixed" colliders={false} userData={{ material: 'wood' }}>
        {lanternSpots.map((l, i) => (
          <CuboidCollider key={i} args={[0.1, 0.9, 0.1]} position={[l.x, terrainHeight(l.x, l.z) + 0.9, l.z]} />
        ))}
      </RigidBody>
      <primitive object={parts.lampPost} />
      <primitive object={parts.lamp} />
      <primitive object={parts.lampCap} />
    </group>
  );
}
