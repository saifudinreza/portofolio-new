import { useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { CylinderCollider, RigidBody } from '@react-three/rapier';
import * as THREE from 'three';
import { gemSpots, palette, secretPlaces } from './layout';
import { carState } from './carState';
import { trackLamp } from './dayCycle';
import { mossyStoneMaterial, rockGeometry } from './stone';
import { collectGem, discoverPlace, hasGem, hasPlace } from '../game/achievements';
import { discoverChime, pickup } from '../ui/sound';
import { reducedMotion } from '../ui/device';
import { useStore } from '../store';

// Twelve glowing gems to find, and the hidden places (two cairns at the ends of the long roads, plus the lighthouse).
// One instanced mesh for the gems and one for their light beams; picking up is a distance check against the car every
// frame (twelve of them, so it costs nothing), which also lets the hovering gems demand a jump. Nothing here is needed
// to see the portfolio: it is a game on top of it. Progress is kept by game/achievements.ts.

const PICKUP_RADIUS = 1.7; // metres on the ground
const PICKUP_HEIGHT = 1.35; // how far above or below the gem the car's centre may be: the hovering ones need a jump

/** A small stack of three stones with a flag, as the hidden places' marker. */
function cairnGeometries() {
  const stones = [
    { y: 0.42, s: 0.85 },
    { y: 1.02, s: 0.6 },
    { y: 1.45, s: 0.42 },
  ];
  return stones.map((k) => rockGeometry(9 + Math.round(k.s * 10), 1).scale(k.s, k.s * 0.8, k.s).translate(0, k.y, 0));
}

export function Collectibles() {
  const tier = useStore((s) => s.tier);
  const parts = useMemo(() => {
    const gemMat = trackLamp(new THREE.MeshStandardMaterial({ color: palette.yellow, emissive: '#FFB000', emissiveIntensity: 1.8, roughness: 0.3, metalness: 0.2 }));
    const gems = new THREE.InstancedMesh(new THREE.OctahedronGeometry(0.45, 0).scale(0.8, 1.25, 0.8), gemMat, gemSpots.length);
    gems.frustumCulled = false;
    const beamMat = new THREE.MeshBasicMaterial({ color: '#FFD36B', transparent: true, opacity: 0.16, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, side: THREE.DoubleSide });
    const beams = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.2, 0.2, 7, 10, 1, true).translate(0, 3.5, 0), beamMat, gemSpots.length);
    beams.frustumCulled = false;
    const m = new THREE.Matrix4();
    gemSpots.forEach((g, i) => beams.setMatrixAt(i, m.makeTranslation(g.x, 0, g.z)));

    const cairns = secretPlaces.filter((p) => p.cairn);
    const rocks = cairnGeometries();
    const rockMesh = rocks.map((geo) => {
      const mesh = new THREE.InstancedMesh(geo, mossyStoneMaterial(0.4), cairns.length);
      const tint = new THREE.Color(palette.rock);
      cairns.forEach((p, i) => {
        mesh.setMatrixAt(i, m.makeTranslation(p.x, 0, p.z));
        mesh.setColorAt(i, tint);
      });
      mesh.castShadow = mesh.receiveShadow = true;
      mesh.computeBoundingSphere();
      return mesh;
    });
    // flag: a dark pole and a coral pennant, one geometry with vertex colours
    const pole = new THREE.CylinderGeometry(0.035, 0.045, 2.2, 6).translate(0, 2.55, 0);
    const flag = new THREE.BufferGeometry();
    flag.setAttribute('position', new THREE.Float32BufferAttribute([0.03, 3.5, 0, 0.03, 2.9, 0, 0.85, 3.2, 0], 3));
    flag.setIndex([0, 1, 2, 2, 1, 0]);
    flag.computeVertexNormals();
    const paint = (g: THREE.BufferGeometry, color: string) => {
      const n = g.index ? g.toNonIndexed() : g;
      const c = new THREE.Color(color);
      const count = n.getAttribute('position').count;
      n.setAttribute('color', new THREE.Float32BufferAttribute(Array.from({ length: count }, () => [c.r, c.g, c.b]).flat(), 3));
      n.deleteAttribute('uv');
      return n;
    };
    const flagGeo = new THREE.BufferGeometry();
    const poleP = paint(pole, palette.woodDark);
    const flagP = paint(flag, palette.coral);
    const pos = new Float32Array([...poleP.getAttribute('position').array, ...flagP.getAttribute('position').array]);
    const col = new Float32Array([...poleP.getAttribute('color').array, ...flagP.getAttribute('color').array]);
    flagGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    flagGeo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    flagGeo.computeVertexNormals();
    const flags = new THREE.InstancedMesh(flagGeo, new THREE.MeshStandardMaterial({ vertexColors: true, side: THREE.DoubleSide, roughness: 0.8 }), cairns.length);
    cairns.forEach((p, i) => flags.setMatrixAt(i, m.makeTranslation(p.x, 0, p.z)));
    flags.castShadow = true;
    flags.computeBoundingSphere();
    return { gems, beams, cairns, rockMesh, flags, shown: gemSpots.map(() => true) };
  }, []);

  const still = useMemo(() => reducedMotion(), []);
  const mtx = useMemo(() => ({ m: new THREE.Matrix4(), q: new THREE.Quaternion(), e: new THREE.Euler(), p: new THREE.Vector3(), s: new THREE.Vector3() }), []);

  useFrame(({ clock }) => {
    const { gems, beams, shown } = parts;
    const started = useStore.getState().started;
    const t = clock.elapsedTime;
    let beamsChanged = false;
    gemSpots.forEach((g, i) => {
      const got = hasGem(g.id);
      if (got) {
        if (shown[i]) {
          // a collected gem disappears (and comes back if the progress is reset)
          shown[i] = false;
          gems.setMatrixAt(i, mtx.m.makeScale(0, 0, 0));
          beams.setMatrixAt(i, mtx.m.makeScale(0, 0, 0));
          beamsChanged = true;
          gems.instanceMatrix.needsUpdate = true;
        }
        return;
      }
      if (!shown[i]) {
        shown[i] = true;
        beams.setMatrixAt(i, mtx.m.makeTranslation(g.x, 0, g.z));
        beamsChanged = true;
      }
      const bob = still ? 0 : Math.sin(t * 1.6 + i) * 0.12;
      gems.setMatrixAt(i, mtx.m.compose(mtx.p.set(g.x, g.y + bob, g.z), mtx.q.setFromEuler(mtx.e.set(0, still ? 0.6 * i : t * 0.9 + i, 0)), mtx.s.setScalar(1)));
      gems.instanceMatrix.needsUpdate = true;
      if (started && Math.hypot(carState.x - g.x, carState.z - g.z) < PICKUP_RADIUS && Math.abs(carState.y - g.y) < PICKUP_HEIGHT) {
        collectGem(g.id);
        pickup();
      }
    });
    if (beamsChanged) beams.instanceMatrix.needsUpdate = true;
    if (started) {
      for (const p of secretPlaces) {
        if (!hasPlace(p.id) && Math.hypot(carState.x - p.x, carState.z - p.z) < p.radius) {
          discoverPlace(p.id, p.label);
          discoverChime();
        }
      }
    }
  });

  return (
    <group>
      <primitive object={parts.gems} />
      {tier !== 'low' && <primitive object={parts.beams} />}
      {parts.rockMesh.map((mesh, i) => (
        <primitive key={i} object={mesh} />
      ))}
      <primitive object={parts.flags} />
      <RigidBody type="fixed" colliders={false} userData={{ material: 'stone' }}>
        {parts.cairns.map((p) => (
          <CylinderCollider key={p.id} args={[1, 0.75]} position={[p.x, 1, p.z]} />
        ))}
      </RigidBody>
    </group>
  );
}
