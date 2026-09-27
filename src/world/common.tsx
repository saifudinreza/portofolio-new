import type { ReactNode } from 'react';
import { Text } from '@react-three/drei';
import { CuboidCollider, RigidBody, type IntersectionEnterPayload } from '@react-three/rapier';
import { palette } from './layout';

export const DISPLAY_FONT = '/fonts/ArchivoBlack-Regular.ttf';
export const BODY_FONT = '/fonts/DMSans.ttf';

const isCar = (p: IntersectionEnterPayload) => !!(p.other.rigidBody?.userData as { isCar?: boolean } | undefined)?.isCar;

/** Invisible trigger volume that fires when the car drives in or out. */
export function Sensor({ position, size, onEnter, onExit }: {
  position: [number, number, number];
  size: [number, number, number];
  onEnter: () => void;
  onExit: () => void;
}) {
  return (
    <RigidBody type="fixed" colliders={false} position={position}>
      <CuboidCollider
        sensor
        args={[size[0] / 2, size[1] / 2, size[2] / 2]}
        onIntersectionEnter={(p) => isCar(p) && onEnter()}
        onIntersectionExit={(p) => isCar(p) && onExit()}
      />
    </RigidBody>
  );
}

/** Text painted flat on the ground, readable from the default camera. */
export function GroundText({ children, position, size = 1, color = palette.navy, font = DISPLAY_FONT, maxWidth, align = 'center', rotation = 0 }: {
  children: string;
  position: [number, number];
  size?: number;
  color?: string;
  font?: string;
  maxWidth?: number;
  align?: 'left' | 'center' | 'right';
  rotation?: number;
}) {
  return (
    <Text
      position={[position[0], 0.02, position[1]]}
      rotation={[-Math.PI / 2, 0, rotation]}
      fontSize={size}
      color={color}
      font={font}
      maxWidth={maxWidth}
      textAlign={align}
      anchorX={align}
      anchorY="middle"
      lineHeight={1.15}
    >
      {children}
    </Text>
  );
}

/** A wooden signboard on two posts. */
export function Signboard({ position, rotation = 0, width = 4, height = 1.6, color = palette.cream, children }: {
  position: [number, number, number];
  rotation?: number;
  width?: number;
  height?: number;
  color?: string;
  children?: ReactNode;
}) {
  const postH = 1.2 + height;
  return (
    <group position={position} rotation={[0, rotation, 0]}>
      <RigidBody type="fixed" colliders="cuboid" userData={{ material: 'wood' }}>
        {[-width / 2 + 0.2, width / 2 - 0.2].map((x) => (
          <mesh key={x} position={[x, postH / 2, -0.05]} castShadow>
            <boxGeometry args={[0.18, postH, 0.18]} />
            <meshStandardMaterial color={palette.woodDark} />
          </mesh>
        ))}
      </RigidBody>
      <mesh position={[0, 1.2 + height / 2, 0.06]} castShadow receiveShadow>
        <boxGeometry args={[width, height, 0.14]} />
        <meshStandardMaterial color={color} roughness={0.8} />
      </mesh>
      <group position={[0, 1.2 + height / 2, 0.14]}>{children}</group>
    </group>
  );
}
