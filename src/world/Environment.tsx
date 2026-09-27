import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { CuboidCollider, RigidBody } from '@react-three/rapier';
import * as THREE from 'three';
import { WORLD_SIZE, palette, roadSegments } from './layout';
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
