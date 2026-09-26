import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import type * as THREE from 'three';
import type { Project } from '../data/profile';
import { palette } from './layout';

const M = ({ color, emissive }: { color: string; emissive?: string }) => (
  <meshStandardMaterial color={color} roughness={0.6} emissive={emissive ?? '#000'} emissiveIntensity={emissive ? 0.4 : 0} />
);

/** Small low-poly object that floats above each project pad and hints at what the project is. */
export function ProjectProp({ kind, color }: { kind: Project['prop']; color: string }) {
  const ref = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (!ref.current) return;
    ref.current.rotation.y = clock.elapsedTime * 0.6;
    ref.current.position.y = 1.2 + Math.sin(clock.elapsedTime * 1.6) * 0.12;
  });
  return (
    <group ref={ref} scale={0.9}>
      {kind === 'register' && (
        <>
          <mesh castShadow position={[0, 0, 0]}><boxGeometry args={[1.2, 0.5, 0.9]} /><M color={palette.navy} /></mesh>
          <mesh castShadow position={[0, 0.45, -0.2]} rotation={[-0.4, 0, 0]}><boxGeometry args={[0.9, 0.5, 0.08]} /><M color={color} emissive={color} /></mesh>
          <mesh castShadow position={[0, 0.28, 0.25]}><boxGeometry args={[0.8, 0.06, 0.3]} /><M color={palette.cream} /></mesh>
        </>
      )}
      {kind === 'house' && (
        <>
          <mesh castShadow><boxGeometry args={[1, 0.8, 1]} /><M color={palette.cream} /></mesh>
          <mesh castShadow position={[0, 0.7, 0]} rotation={[0, Math.PI / 4, 0]}><coneGeometry args={[0.95, 0.6, 4]} /><M color={color} /></mesh>
          <mesh position={[0, -0.12, 0.51]}><boxGeometry args={[0.28, 0.5, 0.02]} /><M color={palette.woodDark} /></mesh>
        </>
      )}
      {kind === 'coins' && (
        <>
          {[0, 1, 2, 3].map((i) => (
            <mesh key={i} castShadow position={[0, i * 0.18 - 0.2, 0]}><cylinderGeometry args={[0.5, 0.5, 0.14, 24]} /><M color={color} emissive={i === 3 ? color : undefined} /></mesh>
          ))}
          <mesh castShadow position={[0.75, 0.1, 0]} rotation={[0, 0, Math.PI / 2.4]}><cylinderGeometry args={[0.45, 0.45, 0.12, 24]} /><M color={color} /></mesh>
        </>
      )}
      {kind === 'sofa' && (
        <>
          <mesh castShadow><boxGeometry args={[1.4, 0.35, 0.7]} /><M color={color} /></mesh>
          <mesh castShadow position={[0, 0.35, -0.28]}><boxGeometry args={[1.4, 0.5, 0.16]} /><M color={color} /></mesh>
          {[-0.72, 0.72].map((x) => (
            <mesh key={x} castShadow position={[x, 0.2, 0]}><boxGeometry args={[0.16, 0.5, 0.7]} /><M color={palette.woodDark} /></mesh>
          ))}
        </>
      )}
      {kind === 'bag' && (
        <>
          <mesh castShadow><boxGeometry args={[0.9, 1, 0.5]} /><M color={color} /></mesh>
          <mesh position={[0, 0.62, 0]}><torusGeometry args={[0.24, 0.05, 8, 20, Math.PI]} /><M color={palette.dark} /></mesh>
        </>
      )}
      {kind === 'key' && (
        <>
          <mesh castShadow rotation={[Math.PI / 2, 0, 0]} position={[-0.4, 0, 0]}><torusGeometry args={[0.32, 0.1, 10, 24]} /><M color={color} /></mesh>
          <mesh castShadow position={[0.3, 0, 0]}><boxGeometry args={[0.9, 0.14, 0.14]} /><M color={color} /></mesh>
          <mesh castShadow position={[0.62, -0.14, 0]}><boxGeometry args={[0.12, 0.22, 0.14]} /><M color={color} /></mesh>
        </>
      )}
    </group>
  );
}
