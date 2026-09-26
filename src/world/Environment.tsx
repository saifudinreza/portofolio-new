import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { CuboidCollider, CylinderCollider, RigidBody } from '@react-three/rapier';
import * as THREE from 'three';
import { WORLD_SIZE, aboutArea, contactPads, distanceToSegment, palette, projectPadPositions, roadSegments, warehouse, zones } from './layout';
import { carState } from './carState';
import { BODY_FONT, GroundText } from './common';

const HALF = WORLD_SIZE / 2;

/** Soft sun that follows the car so shadows stay crisp without a huge shadow map. */
export function Lights() {
  const sun = useRef<THREE.DirectionalLight>(null);
  const target = useMemo(() => new THREE.Object3D(), []);
  useFrame(() => {
    if (!sun.current) return;
    sun.current.position.set(carState.x + 12, 22, carState.z + 8);
    target.position.set(carState.x, 0, carState.z);
    target.updateMatrixWorld();
  });
  return (
    <>
      <hemisphereLight args={['#FFF4E0', '#C9A77A', 1.3]} />
      <directionalLight
        ref={sun}
        target={target}
        intensity={2.2}
        color="#FFE9C7"
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-26}
        shadow-camera-right={26}
        shadow-camera-top={26}
        shadow-camera-bottom={-26}
        shadow-camera-near={1}
        shadow-camera-far={60}
        shadow-bias={-0.0005}
        shadow-normalBias={0.03}
      />
      <primitive object={target} />
    </>
  );
}

export function Ground() {
  return (
    <>
      <RigidBody type="fixed" colliders={false} friction={1}>
        <CuboidCollider args={[HALF, 1, HALF]} position={[0, -1, 0]} />
        {/* invisible walls around the island */}
        <CuboidCollider args={[HALF, 3, 0.5]} position={[0, 2, -HALF]} />
        <CuboidCollider args={[HALF, 3, 0.5]} position={[0, 2, HALF]} />
        <CuboidCollider args={[0.5, 3, HALF]} position={[-HALF, 2, 0]} />
        <CuboidCollider args={[0.5, 3, HALF]} position={[HALF, 2, 0]} />
      </RigidBody>
      <mesh position={[0, -1.5, 0]} receiveShadow>
        <boxGeometry args={[WORLD_SIZE, 3, WORLD_SIZE]} />
        <meshStandardMaterial color={palette.ground} roughness={1} />
      </mesh>
      {/* darker skirt below the top surface gives the island some depth */}
      <mesh position={[0, -4, 0]}>
        <boxGeometry args={[WORLD_SIZE - 1, 3, WORLD_SIZE - 1]} />
        <meshStandardMaterial color={palette.groundEdge} roughness={1} />
      </mesh>
    </>
  );
}

/** Light dirt roads from the centre to each area. */
export function Paths() {
  const segments = roadSegments.filter((_, i) => i !== 5);
  return (
    <group>
      {segments.map(([x1, z1, x2, z2], i) => {
        const dx = x2 - x1;
        const dz = z2 - z1;
        const len = Math.hypot(dx, dz);
        return (
          <mesh key={i} position={[(x1 + x2) / 2, 0.006, (z1 + z2) / 2]} rotation={[-Math.PI / 2, 0, Math.atan2(dx, dz)]} receiveShadow>
            <planeGeometry args={[3, len]} />
            <meshStandardMaterial color={palette.path} roughness={1} />
          </mesh>
        );
      })}
      <GroundText position={[9, 3.2]} size={0.5} color={palette.woodDark} rotation={0.35}>PROJECTS</GroundText>
      <GroundText position={[-9, 3.2]} size={0.5} color={palette.woodDark} rotation={-0.2}>SKILLS</GroundText>
      <GroundText position={[-6, 12]} size={0.5} color={palette.woodDark} rotation={0.5}>ABOUT</GroundText>
      <GroundText position={[6.5, 12]} size={0.5} color={palette.woodDark} rotation={-0.45}>CONTACT</GroundText>
    </group>
  );
}

// Deterministic pseudo random so the world looks the same on every load.
function rng(seed: number) {
  return () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };
}

const keepClear: [number, number, number][] = [
  [0, 0, 11], // home
  [26, -20, 17], // projects
  [warehouse.x, warehouse.z, 10],
  [aboutArea.x, aboutArea.z, 9],
  [26, 29, 13], // contact
  [-8, 10, 5], // ramp
  [9, 16, 5], // cones
];

function isClear(x: number, z: number) {
  if (keepClear.some(([cx, cz, r]) => Math.hypot(x - cx, z - cz) < r)) return false;
  for (const p of [...projectPadPositions, ...contactPads]) if (Math.hypot(x - p[0], z - p[1]) < 5) return false;
  if (Object.values(zones).some((zn) => Math.hypot(x - zn.spawn[0], z - zn.spawn[1]) < 5)) return false;
  // stay well clear of the roads
  return roadSegments.every((seg) => distanceToSegment(x, z, seg) > 4);
}

export function Trees() {
  const trees = useMemo(() => {
    const r = rng(7);
    const out: { x: number; z: number; s: number; kind: number }[] = [];
    let guard = 0;
    while (out.length < 70 && guard++ < 3000) {
      const x = (r() * 2 - 1) * (HALF - 3);
      const z = (r() * 2 - 1) * (HALF - 3);
      if (!isClear(x, z)) continue;
      if (out.some((t) => Math.hypot(t.x - x, t.z - z) < 3.2)) continue;
      out.push({ x, z, s: 0.8 + r() * 0.7, kind: Math.floor(r() * 3) });
    }
    return out;
  }, []);

  return (
    <group>
      {trees.map((t, i) => (
        <RigidBody key={i} type="fixed" colliders={false} position={[t.x, 0, t.z]}>
          <CylinderCollider args={[1.2 * t.s, 0.3 * t.s]} position={[0, 1.2 * t.s, 0]} />
          <group scale={t.s}>
            <mesh position={[0, 0.6, 0]} castShadow>
              <cylinderGeometry args={[0.16, 0.24, 1.2, 7]} />
              <meshStandardMaterial color={palette.woodDark} />
            </mesh>
            {t.kind === 0 && (
              <mesh position={[0, 1.9, 0]} castShadow>
                <coneGeometry args={[1, 2.2, 7]} />
                <meshStandardMaterial color={palette.leafDark} flatShading />
              </mesh>
            )}
            {t.kind === 1 && (
              <mesh position={[0, 1.8, 0]} castShadow>
                <icosahedronGeometry args={[1, 0]} />
                <meshStandardMaterial color={palette.leaf} flatShading />
              </mesh>
            )}
            {t.kind === 2 && (
              <>
                <mesh position={[0, 1.6, 0]} castShadow>
                  <dodecahedronGeometry args={[0.85, 0]} />
                  <meshStandardMaterial color={palette.yellow} flatShading />
                </mesh>
                <mesh position={[0.3, 2.3, 0.1]} castShadow>
                  <dodecahedronGeometry args={[0.55, 0]} />
                  <meshStandardMaterial color="#E9A93A" flatShading />
                </mesh>
              </>
            )}
          </group>
        </RigidBody>
      ))}
    </group>
  );
}

/** A jump ramp and a slalom of traffic cones, purely for fun. */
export function Playground() {
  const cones = useMemo(() => Array.from({ length: 7 }, (_, i) => [6 + i * 1.6, 14 + (i % 2) * 1.4] as [number, number]), []);
  return (
    <group>
      <RigidBody type="fixed" colliders="cuboid" position={[-8, 0.55, 10]} rotation={[0.2, 0, 0]} friction={0.4}>
        <mesh castShadow receiveShadow>
          <boxGeometry args={[3.2, 0.3, 5.6]} />
          <meshStandardMaterial color={palette.coral} />
        </mesh>
      </RigidBody>
      {[-1.45, 1.45].map((x) => (
        <mesh key={x} position={[-8 + x, 0.62, 10]} rotation={[0.2, 0, 0]}>
          <boxGeometry args={[0.2, 0.36, 5.62]} />
          <meshStandardMaterial color={palette.cream} />
        </mesh>
      ))}
      <GroundText position={[-8, 14.4]} size={0.45} color={palette.coral}>JUMP!</GroundText>
      {cones.map(([x, z], i) => (
        <RigidBody key={i} position={[x, 0.4, z]} colliders="hull" mass={0.08} friction={0.8}>
          <mesh castShadow>
            <coneGeometry args={[0.3, 0.8, 12]} />
            <meshStandardMaterial color={i % 2 ? palette.cream : palette.coral} />
          </mesh>
        </RigidBody>
      ))}
    </group>
  );
}

export function HomeText() {
  return (
    <group>
      <GroundText position={[0, 1.6]} size={0.62} color={palette.woodDark} font={BODY_FONT}>Full Stack Web Developer · Kendal, Indonesia</GroundText>
      <GroundText position={[0, 9.8]} size={0.36} color={palette.woodDark} font={BODY_FONT}>W A S D or arrows to drive · Shift boost · Space brake · H horn · R reset</GroundText>
    </group>
  );
}
