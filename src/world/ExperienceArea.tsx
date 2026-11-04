import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { RoundedBox, Text } from '@react-three/drei';
import { CuboidCollider, RigidBody } from '@react-three/rapier';
import * as THREE from 'three';
import { useStore, type Spot } from '../store';
import { experience } from '../data/profile';
import { experienceArea, palette } from './layout';
import { BODY_FONT, DISPLAY_FONT, GroundText, Sensor, Signboard } from './common';
import { woodMap } from './textures';
import { reducedMotion } from '../ui/device';

// The Experience area at the end of the west road: a pad with a floating briefcase, a big sign, two milestone boards
// beside it (one per job, from profile.experience) and a couple of crates for the warehouse years.

const SPOT: Spot = { kind: 'experience' };
const sameSpot = (a: Spot | null, b: Spot) => JSON.stringify(a) === JSON.stringify(b);
const PAD_RADIUS = 4;

/** A briefcase: leather body, a handle, two gold clasps. Turns slowly and bobs over the pad. */
function Briefcase({ still }: { still: boolean }) {
  const group = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    const g = group.current;
    if (!g || still) return;
    g.position.y = 1.55 + Math.sin(clock.elapsedTime * 1.4) * 0.1;
    g.rotation.y = clock.elapsedTime * 0.5;
  });
  return (
    <group ref={group} position={[0, 1.55, 0]} rotation={[0, 0.6, 0]}>
      <RoundedBox args={[1.5, 1, 0.42]} radius={0.08} smoothness={3} castShadow>
        <meshStandardMaterial color="#7A4B2E" roughness={0.6} />
      </RoundedBox>
      <mesh position={[0, 0.5, 0]} rotation={[0, 0, 0]} castShadow>
        <torusGeometry args={[0.2, 0.04, 8, 16, Math.PI]} />
        <meshStandardMaterial color="#3B2518" roughness={0.6} />
      </mesh>
      {[-0.45, 0.45].map((x) => (
        <mesh key={x} position={[x, 0.18, 0.22]}>
          <boxGeometry args={[0.14, 0.12, 0.04]} />
          <meshStandardMaterial color={palette.yellow} metalness={0.5} roughness={0.35} />
        </mesh>
      ))}
      <mesh position={[0, 0.02, 0.215]}>
        <boxGeometry args={[1.5, 0.03, 0.01]} />
        <meshStandardMaterial color="#3B2518" />
      </mesh>
    </group>
  );
}

function Crate({ x, y, z, yaw, size = 1.1 }: { x: number; y: number; z: number; yaw: number; size?: number }) {
  return (
    <RigidBody type="fixed" colliders={false} position={[x, y, z]} rotation={[0, yaw, 0]} userData={{ material: 'wood' }}>
      <CuboidCollider args={[size / 2, size / 2, size / 2]} />
      <RoundedBox args={[size, size, size]} radius={0.05} smoothness={2} castShadow receiveShadow>
        <meshStandardMaterial color={palette.wood} map={woodMap()} roughness={0.85} />
      </RoundedBox>
    </RigidBody>
  );
}

export function ExperienceArea() {
  const setSpot = useStore((s) => s.setSpot);
  const clearSpotIf = useStore((s) => s.clearSpotIf);
  const active = useStore((s) => sameSpot(s.spot, SPOT));
  const still = reducedMotion();
  const { x, z } = experienceArea;
  const color = palette.coral;

  return (
    <group>
      {/* the pad */}
      <group position={[x, 0, z]}>
        <mesh position={[0, 0.03, 0]} receiveShadow>
          <cylinderGeometry args={[PAD_RADIUS, PAD_RADIUS, 0.06, 48]} />
          <meshStandardMaterial color={active ? color : palette.cream} roughness={0.8} />
        </mesh>
        <mesh position={[0, 0.065, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[PAD_RADIUS - 0.35, PAD_RADIUS - 0.12, 48]} />
          <meshStandardMaterial color={active ? palette.cream : color} emissive={color} emissiveIntensity={active ? 0.5 : 0.15} />
        </mesh>
        <Briefcase still={still} />
      </group>

      <Signboard position={[x, 0, z - 6]} width={6} height={2.2} color={palette.navy}>
        <Text fontSize={0.62} color={palette.cream} font={DISPLAY_FONT} anchorX="center" position={[0, 0.35, 0]}>EXPERIENCE</Text>
        <Text fontSize={0.26} color={palette.cream} font={BODY_FONT} anchorX="center" position={[0, -0.35, 0]} maxWidth={5.4} textAlign="center">Where I have worked</Text>
      </Signboard>

      {/* milestone boards: one per job, in a row with the big sign and facing south like every sign here (the camera always looks from that side) */}
      {experience.slice(0, 2).map((job, i) => (
        <Signboard key={job.title} position={[x + 7.4 + i * 4.6, 0, z - 6]} width={3.8} height={1.9} color={palette.cream}>
          <Text fontSize={0.2} color={palette.coral} font={DISPLAY_FONT} anchorX="center" position={[0, 0.6, 0]}>{job.period.toUpperCase()}</Text>
          <Text fontSize={0.3} color={palette.navy} font={DISPLAY_FONT} anchorX="center" position={[0, 0.18, 0]} maxWidth={3.4} textAlign="center">{job.title}</Text>
          <Text fontSize={0.19} color={palette.woodDark} font={BODY_FONT} anchorX="center" position={[0, -0.42, 0]} maxWidth={3.3} textAlign="center">{job.place}</Text>
        </Signboard>
      ))}

      {/* crates from the warehouse years */}
      <Crate x={x - 6.2} y={0.55} z={z + 2.4} yaw={0.3} />
      <Crate x={x - 6.4} y={0.55} z={z + 3.6} yaw={-0.2} />
      <Crate x={x - 6.3} y={1.65} z={z + 3} yaw={0.1} size={0.95} />

      <GroundText position={[x, z + 5.4]} size={1.1}>EXPERIENCE</GroundText>
      <GroundText position={[x, z + 6.6]} size={0.4} color={palette.woodDark} font={BODY_FONT}>Warehouse operations · retail</GroundText>
      <Sensor position={[x, 1, z]} size={[7, 2, 7]} onEnter={() => setSpot(SPOT)} onExit={() => clearSpotIf((s) => sameSpot(s, SPOT))} />
    </group>
  );
}
