import { useEffect, useMemo } from 'react';
import { CuboidCollider, RigidBody } from '@react-three/rapier';
import { Text } from '@react-three/drei';
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { bridge, bridgeDeckHeight, palette, rng } from './layout';
import { plankMap } from './textures';
import { mossyStoneMaterial } from './stone';
import { trackLamp } from './dayCycle';
import { DISPLAY_FONT } from './common';

const { deckHalf, ramp, halfWidth, height: DECK, hump: HUMP } = bridge;
const PLANK_STEP = 0.3;
/** Lengthwise step of the parapet blocks and the hand rail. */
const BLOCK_STEP = 0.55;
const RAIL_STEP = 0.6;
/** Centre line of the stone side walls (under the parapet). */
const SIDE_X = halfWidth + 0.08;
const FACE_THICK = 0.5;
/** The arch under the deck: a half ellipse centred on the river bed, spanning the water. */
const ARCH = { rx: 3.3, ry: 0.95, cy: -0.62 };

const deckY = bridgeDeckHeight;
/** Slope of the deck (rise per metre along z) at `a`. */
const slopeAt = (a: number) => {
  const m = Math.abs(a);
  const d = m <= deckHalf ? (-2 * HUMP * m) / (deckHalf * deckHalf) : -DECK / ramp;
  return Math.sign(a) * d;
};
/** Pitch about x that lays a board along the deck at `a` (positive tips the +z end down, like the ramp colliders). */
const pitchAt = (a: number) => -Math.atan(slopeAt(a));

/** The stone side face: the deck's curved top edge, with the arch cut out and the river bed under it. */
function faceGeometry() {
  const bottom = -0.8;
  const top = (a: number) => deckY(a) - 0.1;
  const shape = new THREE.Shape();
  shape.moveTo(-deckHalf, bottom);
  shape.lineTo(deckHalf, bottom);
  for (let a = deckHalf; a >= -deckHalf - 0.001; a -= 0.35) shape.lineTo(Math.max(a, -deckHalf), top(Math.max(a, -deckHalf)));
  shape.closePath();
  const hole = new THREE.Path();
  hole.moveTo(-ARCH.rx, ARCH.cy);
  for (let i = 0; i <= 28; i++) {
    const t = Math.PI - (i / 28) * Math.PI;
    hole.lineTo(ARCH.rx * Math.cos(t), ARCH.cy + ARCH.ry * Math.sin(t));
  }
  hole.closePath();
  shape.holes.push(hole);
  const g = new THREE.ExtrudeGeometry(shape, { depth: FACE_THICK, bevelEnabled: false, curveSegments: 1 });
  g.translate(0, 0, -FACE_THICK / 2);
  // shape (u, v, depth) -> bridge frame (z along the road, y up, x across it)
  g.applyMatrix4(new THREE.Matrix4().set(0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 0, 0, 0, 0, 1));
  g.computeVertexNormals();
  return g;
}

/** The underside of the arch between the two faces, so the vault reads as a tunnel when seen from the side. */
function vaultGeometry() {
  const steps = 24;
  const pos: number[] = [];
  const index: number[] = [];
  for (const x of [-SIDE_X, SIDE_X]) {
    for (let i = 0; i <= steps; i++) {
      const t = (i / steps) * Math.PI;
      pos.push(x, ARCH.cy + ARCH.ry * Math.sin(t) - 0.01, ARCH.rx * Math.cos(t));
    }
  }
  for (let i = 0; i < steps; i++) index.push(i, i + 1, steps + 1 + i, i + 1, steps + 2 + i, steps + 1 + i);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(index);
  g.computeVertexNormals();
  return g;
}

/**
 * Low stone arch bridge with a timber deck, carrying the Home → Projects road over the river. Built in local space
 * (+z along the road) and turned to match it. The deck humps up over the arch (see `bridgeDeckHeight`, which the car and
 * the walkers use too), with a stone parapet and timber hand rail, a lantern pillar at each corner, a plaque on each
 * side and bollards at the ends. Physics is simple: the hump is a few tilted boxes, one per ramp, a wall each side, and
 * a block of stone at each end of the arch; the arch itself and the stonework are visual only.
 */
export function Bridge() {
  const parts = useMemo(() => {
    const r = rng(17);
    const q = new THREE.Quaternion();
    const e = new THREE.Euler();
    const p = new THREE.Vector3();
    const s = new THREE.Vector3(1, 1, 1);
    const color = new THREE.Color();
    const m4 = () => new THREE.Matrix4();

    // ---- deck boards ----
    const planks: THREE.Matrix4[] = [];
    for (let a = -deckHalf - ramp + PLANK_STEP / 2; a < deckHalf + ramp; a += PLANK_STEP) {
      const y = deckY(a) - 0.035 + (r() - 0.5) * 0.02;
      planks.push(m4().compose(p.set((r() - 0.5) * 0.06, Math.max(y, 0.01), a), q.setFromEuler(e.set(pitchAt(a), (r() - 0.5) * 0.03, (r() - 0.5) * 0.025)), s));
    }
    const wood = new THREE.MeshStandardMaterial({ color: palette.wood, roughness: 0.85, map: plankMap() });
    const plankMesh = new THREE.InstancedMesh(new RoundedBoxGeometry(halfWidth * 2 + 0.3, 0.07, PLANK_STEP - 0.035, 2, 0.02), wood, planks.length);
    planks.forEach((pm, i) => {
      plankMesh.setMatrixAt(i, pm);
      plankMesh.setColorAt(i, color.set('#ffffff').offsetHSL((r() - 0.5) * 0.02, 0, (r() - 0.5) * 0.14));
    });
    plankMesh.castShadow = plankMesh.receiveShadow = true;

    // ---- stone parapet: blocks along both sides of the deck, lower where it runs down the ramps ----
    const stone = mossyStoneMaterial(0.5);
    const blocks: THREE.Matrix4[] = [];
    for (const side of [-1, 1]) {
      for (let a = -deckHalf - ramp + BLOCK_STEP / 2; a < deckHalf + ramp; a += BLOCK_STEP) {
        const t = Math.max(0, (Math.abs(a) - deckHalf) / ramp);
        const h = 0.5 * (1 - 0.7 * t);
        blocks.push(m4().compose(p.set(side * SIDE_X, deckY(a) + h / 2 - 0.02, a), q.setFromEuler(e.set(pitchAt(a), 0, 0)), s.set(0.36, h, BLOCK_STEP + 0.04)));
      }
    }
    const blockMesh = new THREE.InstancedMesh(new RoundedBoxGeometry(1, 1, 1, 2, 0.12), stone, blocks.length);
    blocks.forEach((bm, i) => {
      blockMesh.setMatrixAt(i, bm);
      blockMesh.setColorAt(i, color.set(r() < 0.3 ? palette.groundEdge : palette.rock).offsetHSL(0, 0, (r() - 0.5) * 0.1));
    });
    blockMesh.castShadow = blockMesh.receiveShadow = true;

    // ---- timber hand rail on top of the parapet, over the arched part of the deck ----
    const railPieces: THREE.Matrix4[] = [];
    for (const side of [-1, 1]) {
      for (let a = -deckHalf + RAIL_STEP / 2; a < deckHalf; a += RAIL_STEP) {
        railPieces.push(m4().compose(p.set(side * SIDE_X, deckY(a) + 0.54, a), q.setFromEuler(e.set(pitchAt(a), 0, 0)), s.set(1, 1, RAIL_STEP + 0.03)));
      }
    }
    const dark = new THREE.MeshStandardMaterial({ color: palette.woodDark, roughness: 0.9, map: plankMap() });
    const railMesh = new THREE.InstancedMesh(new RoundedBoxGeometry(0.16, 0.07, 1, 2, 0.025), dark, railPieces.length);
    railPieces.forEach((rm, i) => railMesh.setMatrixAt(i, rm));
    railMesh.castShadow = true;

    // ---- arch ring: wedge stones round the opening on both faces, and the faces and vault themselves ----
    const rings: THREE.Matrix4[] = [];
    const ringColors: THREE.Color[] = [];
    const R = { rx: ARCH.rx + 0.22, ry: ARCH.ry + 0.22 };
    const count = 17;
    for (const side of [-1, 1]) {
      for (let i = 0; i < count; i++) {
        const t = (i + 0.5) * (Math.PI / count);
        const x = R.rx * Math.cos(t);
        const y = ARCH.cy + R.ry * Math.sin(t);
        const ta = -R.rx * Math.sin(t);
        const ty = R.ry * Math.cos(t);
        rings.push(m4().compose(p.set(side * SIDE_X, y, x), q.setFromEuler(e.set(Math.atan2(-ty, ta), 0, 0)), s.set(FACE_THICK + 0.05, 0.42, 0.62)));
        ringColors.push(new THREE.Color(r() < 0.5 ? '#CFC3AB' : palette.rock).offsetHSL(0, 0, (r() - 0.5) * 0.08));
      }
    }
    const ringMesh = new THREE.InstancedMesh(new RoundedBoxGeometry(1, 1, 1, 2, 0.1), new THREE.MeshStandardMaterial({ roughness: 0.9 }), rings.length);
    rings.forEach((rm, i) => {
      ringMesh.setMatrixAt(i, rm);
      ringMesh.setColorAt(i, ringColors[i]);
    });
    ringMesh.castShadow = ringMesh.receiveShadow = true;

    const faceGeo = faceGeometry();
    const vaultGeo = vaultGeometry();
    const faceMat = new THREE.MeshStandardMaterial({ color: '#C9BDA6', roughness: 0.95, side: THREE.DoubleSide });
    const vaultMat = new THREE.MeshStandardMaterial({ color: '#A89E8A', roughness: 1, side: THREE.DoubleSide });

    // ---- lantern pillars at the four corners, and bollards at the ends ----
    const corners: { x: number; a: number }[] = [];
    for (const side of [-1, 1]) for (const end of [-1, 1]) corners.push({ x: side * SIDE_X, a: end * (deckHalf - 0.2) });
    const pillarMesh = new THREE.InstancedMesh(new RoundedBoxGeometry(0.42, 1.05, 0.42, 2, 0.06), stone, corners.length);
    const lampMat = trackLamp(new THREE.MeshStandardMaterial({ color: '#FFF1C9', emissive: '#FFC26B', emissiveIntensity: 2.4, roughness: 0.3 }));
    const lampMesh = new THREE.InstancedMesh(new RoundedBoxGeometry(0.26, 0.3, 0.26, 2, 0.05), lampMat, corners.length);
    const capMesh = new THREE.InstancedMesh(new THREE.ConeGeometry(0.24, 0.18, 4).rotateY(Math.PI / 4).translate(0, 0.09, 0), new THREE.MeshStandardMaterial({ color: palette.coral, roughness: 0.8 }), corners.length);
    corners.forEach((c, i) => {
      const base = deckY(c.a);
      pillarMesh.setMatrixAt(i, m4().compose(p.set(c.x, base + 0.5, c.a), q.identity(), s.set(1, 1, 1)));
      lampMesh.setMatrixAt(i, m4().compose(p.set(c.x, base + 1.2, c.a), q.identity(), s.set(1, 1, 1)));
      capMesh.setMatrixAt(i, m4().compose(p.set(c.x, base + 1.37, c.a), q.identity(), s.set(1, 1, 1)));
    });
    pillarMesh.castShadow = true;

    const bollards: { x: number; a: number }[] = [];
    for (const side of [-1, 1]) for (const end of [-1, 1]) bollards.push({ x: side * (halfWidth + 0.65), a: end * (deckHalf + ramp + 0.5) });
    const bollardMesh = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.13, 0.16, 0.55, 10).translate(0, 0.275, 0), new THREE.MeshStandardMaterial({ color: palette.cream, roughness: 0.8 }), bollards.length);
    bollards.forEach((b, i) => bollardMesh.setMatrixAt(i, m4().compose(p.set(b.x, 0, b.a), q.identity(), s.set(1, 1, 1))));
    bollardMesh.castShadow = true;

    // ---- colliders: the arched deck as short tilted boxes whose top faces follow the hump ----
    const deckBoxes: { y: number; z: number; len: number; tilt: number }[] = [];
    const SEG = 8;
    for (let i = 0; i < SEG; i++) {
      const a0 = -deckHalf + (2 * deckHalf * i) / SEG;
      const a1 = -deckHalf + (2 * deckHalf * (i + 1)) / SEG;
      const y0 = deckY(a0);
      const y1 = deckY(a1);
      const tilt = Math.atan2(-(y1 - y0), a1 - a0);
      const len = Math.hypot(a1 - a0, y1 - y0);
      // top face through the middle of the segment; the box sits 0.1 below it along its normal
      deckBoxes.push({ y: (y0 + y1) / 2 - 0.1 * Math.cos(tilt), z: (a0 + a1) / 2 - 0.1 * Math.sin(tilt), len: len + 0.08, tilt });
    }

    return { plankMesh, blockMesh, railMesh, ringMesh, faceGeo, vaultGeo, faceMat, vaultMat, pillarMesh, lampMesh, capMesh, bollardMesh, bollards, deckBoxes };
  }, []);

  useEffect(
    () => () => {
      for (const m of [parts.plankMesh, parts.blockMesh, parts.railMesh, parts.ringMesh, parts.pillarMesh, parts.lampMesh, parts.capMesh, parts.bollardMesh]) m.geometry.dispose();
      parts.faceGeo.dispose();
      parts.vaultGeo.dispose();
    },
    [parts],
  );

  const rampLen = Math.hypot(ramp, DECK);
  const SLOPE = Math.atan2(DECK, ramp);
  return (
    <group position={[bridge.x, 0, bridge.z]} rotation={[0, bridge.yaw, 0]}>
      <RigidBody type="fixed" colliders={false} friction={1} userData={{ material: 'wood' }}>
        {parts.deckBoxes.map((b, i) => (
          <CuboidCollider key={i} args={[halfWidth + 0.15, 0.1, b.len / 2]} position={[0, b.y, b.z]} rotation={[b.tilt, 0, 0]} />
        ))}
        {[-1, 1].map((end) => (
          // top face runs from the deck edge down to the ground; the box sits 0.1 below it along its normal
          <CuboidCollider
            key={end}
            args={[halfWidth + 0.15, 0.1, rampLen / 2]}
            position={[0, DECK / 2 - 0.1 * Math.cos(SLOPE), end * (deckHalf + ramp / 2) - end * 0.1 * Math.sin(SLOPE)]}
            rotation={[end * SLOPE, 0, 0]}
          />
        ))}
        {/* the parapet and its lantern pillars */}
        {[-1, 1].map((side) => (
          <CuboidCollider key={side} args={[0.18, 0.55, deckHalf]} position={[side * SIDE_X, DECK + 0.62, 0]} />
        ))}
        {/* the stone at each end of the arch, down to the river bed, so nothing drives into the faces from the bank */}
        {[-1, 1].flatMap((side) => [-1, 1].map((end) => <CuboidCollider key={`${side}${end}`} args={[FACE_THICK / 2, 0.6, 0.45]} position={[side * SIDE_X, -0.2, end * (ARCH.rx + 0.45)]} />))}
        {parts.bollards.map((b, i) => (
          <CuboidCollider key={i} args={[0.15, 0.28, 0.15]} position={[b.x, 0.28, b.a]} />
        ))}
      </RigidBody>
      <primitive object={parts.plankMesh} />
      <primitive object={parts.blockMesh} />
      <primitive object={parts.railMesh} />
      <primitive object={parts.ringMesh} />
      <primitive object={parts.pillarMesh} />
      <primitive object={parts.lampMesh} />
      <primitive object={parts.capMesh} />
      <primitive object={parts.bollardMesh} />
      {[-1, 1].map((side) => (
        <mesh key={side} geometry={parts.faceGeo} material={parts.faceMat} position={[side * SIDE_X, 0, 0]} castShadow receiveShadow />
      ))}
      <mesh geometry={parts.vaultGeo} material={parts.vaultMat} receiveShadow />
      {/* a small plaque on the outside of each parapet */}
      {[-1, 1].map((side) => (
        <group key={side} position={[side * (SIDE_X + 0.2), deckY(0) + 0.25, 0]} rotation={[0, side * (Math.PI / 2), 0]}>
          <mesh castShadow>
            <boxGeometry args={[1.5, 0.36, 0.05]} />
            <meshStandardMaterial color={palette.cream} roughness={0.8} />
          </mesh>
          <Text fontSize={0.15} color={palette.navy} font={DISPLAY_FONT} anchorX="center" anchorY="middle" position={[0, 0, 0.03]}>REZA&apos;S BRIDGE</Text>
        </group>
      ))}
    </group>
  );
}
