import { Text } from '@react-three/drei';
import { CuboidCollider, RigidBody } from '@react-three/rapier';
import { circuitGates, palette } from './layout';
import { DISPLAY_FONT, isCar } from './common';
import { passGate, useCircuit } from '../game/circuit';

const POST_X = 2.6; // posts just outside the 3.8 m wide road
const POST_H = 2.7;
// The trigger is wider than the posts so cutting a corner over the verge still counts.
const SENSOR_HALF_WIDTH = 4;

function Gate({ index, x, z, yaw }: { index: number; x: number; z: number; yaw: number }) {
  // the gate to aim for glows: the start while no lap runs, then each checkpoint in turn
  const lit = useCircuit((s) => (s.active ? s.next : 0) === index);
  const start = index === 0;
  const color = start ? palette.coral : palette.teal;
  const label = start ? 'START · FINISH' : `${index} / ${circuitGates.length - 1}`;
  return (
    <>
      <group position={[x, 0, z]} rotation={[0, yaw, 0]}>
        {[-POST_X, POST_X].map((px) => (
          <mesh key={px} position={[px, POST_H / 2, 0]} castShadow>
            <cylinderGeometry args={[0.08, 0.1, POST_H, 10]} />
            <meshStandardMaterial color={palette.cream} roughness={0.6} />
          </mesh>
        ))}
        <mesh position={[0, POST_H - 0.25, 0]} castShadow>
          <boxGeometry args={[POST_X * 2 + 0.2, 0.46, 0.08]} />
          <meshStandardMaterial color={color} emissive={color} emissiveIntensity={lit ? 0.9 : 0.05} roughness={0.7} />
        </mesh>
        {/* readable from both directions */}
        {[0, Math.PI].map((r) => (
          <Text key={r} rotation={[0, r, 0]} position={[0, POST_H - 0.25, r ? -0.05 : 0.05]} fontSize={0.26} color={palette.cream} font={DISPLAY_FONT} anchorX="center" anchorY="middle">
            {label}
          </Text>
        ))}
      </group>
      <RigidBody type="fixed" colliders={false} position={[x, 1.2, z]} rotation={[0, yaw, 0]}>
        <CuboidCollider sensor args={[SENSOR_HALF_WIDTH, 1.2, 0.8]} onIntersectionEnter={(p) => isCar(p) && passGate(index)} />
      </RigidBody>
    </>
  );
}

/** Time-trial gates along the roads. Logic and best time live in game/circuit.ts. */
export function Circuit() {
  return (
    <group>
      {circuitGates.map(([x, z, yaw], i) => (
        <Gate key={i} index={i} x={x} z={z} yaw={yaw} />
      ))}
    </group>
  );
}
