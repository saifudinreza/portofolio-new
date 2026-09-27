import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { RoundedBox } from '@react-three/drei';
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { Project } from '../data/profile';
import { palette } from './layout';

const M = ({ color, emissive, rough = 0.55, metal = 0 }: { color: string; emissive?: string; rough?: number; metal?: number }) => (
  <meshStandardMaterial color={color} roughness={rough} metalness={metal} emissive={emissive ?? '#000'} emissiveIntensity={emissive ? 0.5 : 0} />
);

/** Triangular prism for a gable roof: ridge along x, slopes down to ±z. */
function roofGeometry(w: number, d: number, h: number) {
  const s = new THREE.Shape();
  s.moveTo(-d / 2, 0);
  s.lineTo(0, h);
  s.lineTo(d / 2, 0);
  s.closePath();
  return new THREE.ExtrudeGeometry(s, { depth: w, bevelEnabled: true, bevelThickness: 0.03, bevelSize: 0.03, bevelSegments: 2 }).rotateY(Math.PI / 2).translate(-w / 2, 0, 0);
}

function Register({ color }: { color: string }) {
  // 11 cream keys in one mesh, plus the coral "pay" key
  const keys = useMemo(
    () => mergeGeometries(Array.from({ length: 11 }, (_, i) => new RoundedBoxGeometry(0.1, 0.05, 0.09, 2, 0.02).translate(-0.2 + (i % 4) * 0.13, 0.28, 0.08 + Math.floor(i / 4) * 0.12)))!,
    [],
  );
  return (
    <>
      <RoundedBox args={[1.2, 0.46, 0.9]} radius={0.08} smoothness={3} castShadow><M color={palette.navy} /></RoundedBox>
      {/* cash drawer */}
      <RoundedBox args={[1.1, 0.14, 0.06]} radius={0.03} smoothness={2} position={[0, -0.12, 0.45]}><M color="#2A4A7F" /></RoundedBox>
      {/* screen on a stalk */}
      <mesh position={[0, 0.32, -0.28]}><cylinderGeometry args={[0.05, 0.07, 0.2, 10]} /><M color={palette.dark} /></mesh>
      <group position={[0, 0.55, -0.26]} rotation={[-0.35, 0, 0]}>
        <RoundedBox args={[0.9, 0.52, 0.08]} radius={0.04} smoothness={2} castShadow><M color={palette.dark} /></RoundedBox>
        <mesh position={[0, 0, 0.045]}><planeGeometry args={[0.78, 0.4]} /><M color={color} emissive={color} rough={0.3} /></mesh>
      </group>
      <mesh geometry={keys}><M color={palette.cream} /></mesh>
      <RoundedBox args={[0.1, 0.05, 0.09]} radius={0.02} smoothness={2} position={[0.19, 0.28, 0.32]}><M color={palette.coral} /></RoundedBox>
      {/* receipt roll */}
      <mesh position={[0.42, 0.3, 0.15]} rotation={[0, 0, Math.PI / 2]}><cylinderGeometry args={[0.08, 0.08, 0.16, 16]} /><M color="#FFFFFF" rough={0.8} /></mesh>
      <mesh position={[0.42, 0.33, 0.34]} rotation={[-0.3, 0, 0]}><planeGeometry args={[0.13, 0.3]} /><meshStandardMaterial color="#FFFFFF" side={THREE.DoubleSide} /></mesh>
    </>
  );
}

function House({ color }: { color: string }) {
  const roof = useMemo(() => roofGeometry(1.25, 1.25, 0.6), []);
  return (
    <>
      <RoundedBox args={[1, 0.8, 1]} radius={0.05} smoothness={2} castShadow><M color={palette.cream} rough={0.8} /></RoundedBox>
      <mesh geometry={roof} position={[0, 0.4, 0]} castShadow><M color={color} rough={0.6} /></mesh>
      <RoundedBox args={[0.18, 0.4, 0.18]} radius={0.03} smoothness={2} position={[0.28, 0.75, -0.2]} castShadow><M color={palette.woodDark} /></RoundedBox>
      {/* door with a knob, two warm windows */}
      <RoundedBox args={[0.28, 0.46, 0.05]} radius={0.03} smoothness={2} position={[0, -0.17, 0.5]}><M color={palette.woodDark} /></RoundedBox>
      <mesh position={[0.09, -0.17, 0.53]}><sphereGeometry args={[0.025, 8, 6]} /><M color={palette.yellow} metal={0.6} rough={0.3} /></mesh>
      {[-0.3, 0.3].map((x) => (
        <group key={x} position={[x, 0.12, 0.5]}>
          <RoundedBox args={[0.24, 0.22, 0.04]} radius={0.02} smoothness={2}><M color={palette.woodDark} /></RoundedBox>
          <mesh position={[0, 0, 0.025]}><planeGeometry args={[0.18, 0.16]} /><M color="#FFE3A6" emissive="#FFB547" /></mesh>
        </group>
      ))}
    </>
  );
}

function Coin({ color, glow }: { color: string; glow?: boolean }) {
  return (
    <>
      <mesh castShadow><cylinderGeometry args={[0.5, 0.5, 0.12, 32]} /><M color={color} emissive={glow ? color : undefined} metal={0.55} rough={0.3} /></mesh>
      <mesh rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[0.47, 0.035, 8, 32]} /><M color={color} metal={0.6} rough={0.25} /></mesh>
    </>
  );
}

function Coins({ color }: { color: string }) {
  return (
    <>
      {[0, 1, 2, 3].map((i) => (
        <group key={i} position={[(i % 2) * 0.03, i * 0.15 - 0.2, 0]}>
          <Coin color={color} glow={i === 3} />
        </group>
      ))}
      <group position={[0.75, 0.12, 0]} rotation={[0, 0, Math.PI / 2.4]}>
        <Coin color={color} />
      </group>
    </>
  );
}

function Sofa({ color }: { color: string }) {
  return (
    <>
      <RoundedBox args={[1.5, 0.28, 0.76]} radius={0.08} smoothness={3} position={[0, -0.05, 0]} castShadow><M color={color} rough={0.9} /></RoundedBox>
      {[-0.36, 0.36].map((x) => (
        <RoundedBox key={x} args={[0.68, 0.16, 0.6]} radius={0.07} smoothness={3} position={[x, 0.15, 0.05]} castShadow><M color={color} rough={0.95} /></RoundedBox>
      ))}
      {[-0.36, 0.36].map((x) => (
        <RoundedBox key={x} args={[0.68, 0.5, 0.18]} radius={0.08} smoothness={3} position={[x, 0.38, -0.3]} rotation={[-0.12, 0, 0]} castShadow><M color={color} rough={0.95} /></RoundedBox>
      ))}
      {[-0.78, 0.78].map((x) => (
        <RoundedBox key={x} args={[0.18, 0.42, 0.76]} radius={0.08} smoothness={3} position={[x, 0.12, 0]} castShadow><M color={color} rough={0.9} /></RoundedBox>
      ))}
      {[[-0.65, -0.3], [0.65, -0.3], [-0.65, 0.3], [0.65, 0.3]].map(([x, z]) => (
        <mesh key={`${x}${z}`} position={[x, -0.25, z]}><cylinderGeometry args={[0.035, 0.025, 0.14, 8]} /><M color={palette.woodDark} /></mesh>
      ))}
    </>
  );
}

function Bag({ color }: { color: string }) {
  return (
    <>
      <RoundedBox args={[0.9, 1, 0.5]} radius={0.05} smoothness={2} castShadow><M color={color} rough={0.85} /></RoundedBox>
      {/* folded top edge */}
      <RoundedBox args={[0.92, 0.1, 0.52]} radius={0.03} smoothness={2} position={[0, 0.46, 0]}><M color={palette.cream} rough={0.85} /></RoundedBox>
      {[-0.13, 0.13].map((z) => (
        <mesh key={z} position={[0, 0.62, z]}><torusGeometry args={[0.2, 0.025, 8, 20, Math.PI]} /><M color={palette.dark} /></mesh>
      ))}
      {/* price tag on a string */}
      <RoundedBox args={[0.16, 0.22, 0.02]} radius={0.02} smoothness={2} position={[0.48, 0.2, 0.2]} rotation={[0, 0, 0.3]}><M color={palette.yellow} /></RoundedBox>
    </>
  );
}

function Key({ color }: { color: string }) {
  return (
    <>
      <mesh castShadow rotation={[Math.PI / 2, 0, 0]} position={[-0.42, 0, 0]}><torusGeometry args={[0.3, 0.1, 14, 28]} /><M color={color} metal={0.6} rough={0.3} /></mesh>
      <RoundedBox args={[0.95, 0.15, 0.13]} radius={0.05} smoothness={2} position={[0.3, 0, 0]} castShadow><M color={color} metal={0.6} rough={0.3} /></RoundedBox>
      {[0.55, 0.7].map((x, i) => (
        <RoundedBox key={x} args={[0.1, i ? 0.18 : 0.26, 0.13]} radius={0.03} smoothness={2} position={[x, -0.14 - (i ? 0 : 0.04), 0]} castShadow><M color={color} metal={0.6} rough={0.3} /></RoundedBox>
      ))}
      {/* key ring with a little tag */}
      <mesh rotation={[0, Math.PI / 2, 0]} position={[-0.78, 0, 0]}><torusGeometry args={[0.13, 0.02, 8, 20]} /><M color="#C9CED6" metal={0.8} rough={0.25} /></mesh>
      <RoundedBox args={[0.2, 0.3, 0.04]} radius={0.04} smoothness={2} position={[-0.92, -0.2, 0]} rotation={[0, 0, -0.3]}><M color={palette.cream} /></RoundedBox>
    </>
  );
}

/** Small model that floats above each project pad and hints at what the project is. */
export function ProjectProp({ kind, color }: { kind: Project['prop']; color: string }) {
  const ref = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (!ref.current) return;
    ref.current.rotation.y = clock.elapsedTime * 0.6;
    ref.current.position.y = 1.2 + Math.sin(clock.elapsedTime * 1.6) * 0.12;
  });
  return (
    <group ref={ref} scale={0.9}>
      {kind === 'register' && <Register color={color} />}
      {kind === 'house' && <House color={color} />}
      {kind === 'coins' && <Coins color={color} />}
      {kind === 'sofa' && <Sofa color={color} />}
      {kind === 'bag' && <Bag color={color} />}
      {kind === 'key' && <Key color={color} />}
    </group>
  );
}
