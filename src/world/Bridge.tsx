import { useMemo } from 'react';
import { CuboidCollider, RigidBody } from '@react-three/rapier';
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { bridge, palette, rng } from './layout';
import { plankMap } from './textures';

const { deckHalf, ramp, halfWidth, height: DECK } = bridge;
const SLOPE = Math.atan2(DECK, ramp);
const PLANK_STEP = 0.3;
const POST_STEP = 1.4;
const RAIL_X = halfWidth + 0.06;

/** Deck height at `along` metres from the centre (flat deck, then a straight ramp down to the ground). */
const deckY = (along: number) => {
  const a = Math.abs(along);
  return a <= deckHalf ? DECK : Math.max(0, DECK * (1 - (a - deckHalf) / ramp));
};

/**
 * Wooden footbridge carrying the Home → Projects road over the river. Built in local space (+z along the road)
 * and turned to match it. Boards are slightly uneven and never quite the same colour; posts and rails are dark wood.
 * Physics is kept simple: a flat deck box, one box per ramp and a rail wall on each side.
 */
export function Bridge() {
  const parts = useMemo(() => {
    const r = rng(17);
    const q = new THREE.Quaternion();
    const e = new THREE.Euler();
    const p = new THREE.Vector3();
    const s = new THREE.Vector3(1, 1, 1);
    const color = new THREE.Color();

    const planks: THREE.Matrix4[] = [];
    for (let a = -deckHalf - ramp + PLANK_STEP / 2; a < deckHalf + ramp; a += PLANK_STEP) {
      const onRamp = Math.abs(a) > deckHalf;
      const pitch = onRamp ? Math.sign(a) * SLOPE : 0;
      const y = deckY(a) - 0.035 + (r() - 0.5) * 0.02;
      planks.push(new THREE.Matrix4().compose(p.set((r() - 0.5) * 0.06, Math.max(y, 0.01), a), q.setFromEuler(e.set(pitch, (r() - 0.5) * 0.03, (r() - 0.5) * 0.025)), s));
    }
    const wood = new THREE.MeshStandardMaterial({ color: palette.wood, roughness: 0.85, map: plankMap() });
    const plankMesh = new THREE.InstancedMesh(new RoundedBoxGeometry(halfWidth * 2 + 0.3, 0.07, PLANK_STEP - 0.035, 2, 0.02), wood, planks.length);
    planks.forEach((pm, i) => {
      plankMesh.setMatrixAt(i, pm);
      plankMesh.setColorAt(i, color.set('#ffffff').offsetHSL((r() - 0.5) * 0.02, 0, (r() - 0.5) * 0.14));
    });
    plankMesh.castShadow = plankMesh.receiveShadow = true;

    // Posts along both rails, a thicker one at each end; pilings under the deck standing in the water.
    const dark = new THREE.MeshStandardMaterial({ color: palette.woodDark, roughness: 0.9, map: plankMap() });
    const posts: THREE.Matrix4[] = [];
    for (let a = -deckHalf; a <= deckHalf + 0.01; a += POST_STEP) {
      for (const side of [-1, 1]) posts.push(new THREE.Matrix4().compose(p.set(side * RAIL_X, DECK + 0.3, a), q.identity(), s.set(1, 1, 1)));
    }
    const postMesh = new THREE.InstancedMesh(new RoundedBoxGeometry(0.15, 0.95, 0.15, 2, 0.03), dark, posts.length);
    posts.forEach((pm, i) => postMesh.setMatrixAt(i, pm));
    postMesh.castShadow = true;

    const pilings: THREE.Matrix4[] = [];
    for (const a of [-deckHalf + 0.6, -1.4, 1.4, deckHalf - 0.6]) {
      for (const side of [-1, 1]) pilings.push(new THREE.Matrix4().compose(p.set(side * (halfWidth - 0.35), (DECK - 0.1 - 0.35) / 2, a), q.identity(), s.set(1, 1, 1)));
    }
    const pilingMesh = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.12, 0.14, DECK - 0.1 + 0.35, 10), dark, pilings.length);
    pilings.forEach((pm, i) => pilingMesh.setMatrixAt(i, pm));
    pilingMesh.castShadow = true;

    // Two long stringers under the deck boards, and one down each ramp on each side.
    const beam = new RoundedBoxGeometry(0.16, 0.14, 1, 2, 0.03);
    const beams: THREE.Matrix4[] = [];
    for (const side of [-1, 1]) {
      beams.push(new THREE.Matrix4().compose(p.set(side * (halfWidth - 0.35), DECK - 0.14, 0), q.identity(), s.set(1, 1, deckHalf * 2)));
      for (const end of [-1, 1]) {
        const len = Math.hypot(ramp, DECK);
        beams.push(new THREE.Matrix4().compose(p.set(side * (halfWidth - 0.35), DECK / 2 - 0.12, end * (deckHalf + ramp / 2)), q.setFromEuler(e.set(end * SLOPE, 0, 0)), s.set(1, 1, len)));
      }
    }
    const beamMesh = new THREE.InstancedMesh(beam, dark, beams.length);
    beams.forEach((bm, i) => beamMesh.setMatrixAt(i, bm));

    // Top and middle rails on each side.
    const railGeometry = new RoundedBoxGeometry(0.1, 0.09, deckHalf * 2 + 0.15, 2, 0.03);
    const rails = [-1, 1].flatMap((side) => [
      { x: side * RAIL_X, y: DECK + 0.74, s: 1 },
      { x: side * RAIL_X, y: DECK + 0.4, s: 0.7 },
    ]);
    return { plankMesh, postMesh, pilingMesh, beamMesh, railGeometry, rails, wood: dark };
  }, []);

  const rampLen = Math.hypot(ramp, DECK);
  return (
    <group position={[bridge.x, 0, bridge.z]} rotation={[0, bridge.yaw, 0]}>
      <RigidBody type="fixed" colliders={false} friction={1} userData={{ material: 'wood' }}>
        <CuboidCollider args={[halfWidth + 0.15, 0.1, deckHalf]} position={[0, DECK - 0.1, 0]} />
        {[-1, 1].map((end) => (
          // top face runs from the deck edge down to the ground; the box sits 0.1 below it along its normal
          <CuboidCollider
            key={end}
            args={[halfWidth + 0.15, 0.1, rampLen / 2]}
            position={[0, DECK / 2 - 0.1 * Math.cos(SLOPE), end * (deckHalf + ramp / 2) - end * 0.1 * Math.sin(SLOPE)]}
            rotation={[end * SLOPE, 0, 0]}
          />
        ))}
        {[-1, 1].map((side) => (
          <CuboidCollider key={side} args={[0.08, 0.42, deckHalf]} position={[side * RAIL_X, DECK + 0.42, 0]} />
        ))}
      </RigidBody>
      <primitive object={parts.plankMesh} />
      <primitive object={parts.postMesh} />
      <primitive object={parts.pilingMesh} />
      <primitive object={parts.beamMesh} />
      {parts.rails.map((rl, i) => (
        <mesh key={i} geometry={parts.railGeometry} material={parts.wood} position={[rl.x, rl.y, 0]} scale={[rl.s, rl.s, 1]} castShadow />
      ))}
    </group>
  );
}
