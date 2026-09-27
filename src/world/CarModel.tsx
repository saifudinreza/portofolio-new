import { useMemo, useRef, type MutableRefObject } from 'react';
import { useFrame } from '@react-three/fiber';
import { RoundedBox, Text } from '@react-three/drei';
import * as THREE from 'three';
import { carState } from './carState';
import { DISPLAY_FONT } from './common';
import { palette } from './layout';
import { glowMap, treadMap } from './textures';

// Forward is +z, the car's right is +x (wheel on the right, as in Indonesia).
const WHEELS: [number, number, number, boolean][] = [
  [-0.6, -0.12, 0.6, true],
  [0.6, -0.12, 0.6, true],
  [-0.6, -0.12, -0.62, false],
  [0.6, -0.12, -0.62, false],
];

function useCarMaterials() {
  return useMemo(() => {
    const paint = new THREE.MeshPhysicalMaterial({ color: palette.navy, metalness: 0.35, roughness: 0.35, clearcoat: 1, clearcoatRoughness: 0.08 });
    const cream = new THREE.MeshPhysicalMaterial({ color: palette.cream, roughness: 0.4, clearcoat: 0.8, clearcoatRoughness: 0.15 });
    const teal = new THREE.MeshPhysicalMaterial({ color: palette.teal, roughness: 0.35, clearcoat: 1, clearcoatRoughness: 0.1 });
    const glass = new THREE.MeshPhysicalMaterial({ color: '#9FD3E6', metalness: 0.1, roughness: 0.05, transparent: true, opacity: 0.35, clearcoat: 1, envMapIntensity: 1.6, depthWrite: false });
    const chrome = new THREE.MeshStandardMaterial({ color: '#E8ECEF', metalness: 1, roughness: 0.18 });
    const trim = new THREE.MeshStandardMaterial({ color: '#2A2D34', roughness: 0.6 });
    const seat = new THREE.MeshStandardMaterial({ color: palette.coral, roughness: 0.8 });
    const head = new THREE.MeshStandardMaterial({ color: '#FFF6D8', emissive: '#FFE3A0', emissiveIntensity: 3 });
    const tail = new THREE.MeshStandardMaterial({ color: '#E0462E', emissive: '#FF4A2A', emissiveIntensity: 0.8 });
    const tread = treadMap();
    const rubber = new THREE.MeshStandardMaterial({ color: '#1F2126', roughness: 0.92, bumpMap: tread, bumpScale: 2 });
    const flag = new THREE.MeshStandardMaterial({ color: palette.coral, side: THREE.DoubleSide, roughness: 0.7 });
    return { paint, cream, teal, glass, chrome, trim, seat, head, tail, rubber, flag };
  }, []);
}

/** Rounded, slightly bulging tyre: a lathe profile spun around the x axle. */
function tyreGeometry() {
  const pts = [
    [0.17, -0.11], [0.25, -0.11], [0.275, -0.085], [0.285, -0.04], [0.285, 0.04], [0.275, 0.085], [0.25, 0.11], [0.17, 0.11],
  ].map(([r, y]) => new THREE.Vector2(r, y));
  return new THREE.LatheGeometry(pts, 28).rotateZ(Math.PI / 2);
}

function Wheel({ x, mats, tyre }: { x: number; mats: ReturnType<typeof useCarMaterials>; tyre: THREE.BufferGeometry }) {
  const out = x > 0 ? 1 : -1;
  return (
    <>
      <mesh geometry={tyre} material={mats.rubber} castShadow />
      {/* rim: dish, five spokes and a hub, on the outer face */}
      <mesh material={mats.chrome} position={[out * 0.07, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.175, 0.175, 0.05, 20]} />
      </mesh>
      <mesh material={mats.trim} position={[out * 0.098, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.15, 0.15, 0.01, 20]} />
      </mesh>
      {[0, 1, 2, 3, 4].map((i) => (
        <mesh key={i} material={mats.chrome} position={[out * 0.105, 0, 0]} rotation={[(i * Math.PI * 2) / 5, 0, 0]}>
          <boxGeometry args={[0.02, 0.27, 0.035]} />
        </mesh>
      ))}
      <mesh material={mats.chrome} position={[out * 0.11, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.045, 0.05, 0.03, 12]} />
      </mesh>
    </>
  );
}

function Plate({ z, flip }: { z: number; flip?: boolean }) {
  return (
    <group position={[0, -0.09, z]} rotation={[0, flip ? Math.PI : 0, 0]}>
      <mesh>
        <boxGeometry args={[0.34, 0.1, 0.012]} />
        <meshStandardMaterial color={palette.cream} roughness={0.5} />
      </mesh>
      <Text position={[0, 0, 0.008]} fontSize={0.068} color={palette.navy} font={DISPLAY_FONT} anchorX="center" anchorY="middle">REZA</Text>
    </group>
  );
}

/** Coral flag on the antenna, flapping harder the faster the car goes. */
function Flag({ material }: { material: THREE.Material }) {
  const geometry = useMemo(() => new THREE.PlaneGeometry(0.24, 0.14, 10, 3).translate(0.12, 0, 0), []);
  const base = useMemo(() => Float32Array.from(geometry.attributes.position.array), [geometry]);
  useFrame(({ clock }) => {
    const pos = geometry.attributes.position;
    const t = clock.elapsedTime;
    const speed = Math.min(Math.abs(carState.speed), 20);
    for (let i = 0; i < pos.count; i++) {
      const x = base[i * 3];
      const wave = Math.sin(x * 26 - t * (6 + speed * 0.9)) * x * (0.18 + speed * 0.012);
      pos.setZ(i, base[i * 3 + 2] + wave);
    }
    pos.needsUpdate = true;
    geometry.computeVertexNormals();
  });
  // flag streams backwards (−z) from the pole
  return <mesh geometry={geometry} material={material} position={[0, 0.2, 0]} rotation={[0, Math.PI / 2, 0]} castShadow />;
}

type Refs = {
  chassis: MutableRefObject<THREE.Group | null>;
  wheels: MutableRefObject<(THREE.Group | null)[]>;
  frontPivots: MutableRefObject<(THREE.Group | null)[]>;
};

/** The car's looks: body, glass, interior, lights, wheels and the visual suspension. Physics lives in Car. */
export function CarModel({ chassis, wheels, frontPivots }: Refs) {
  const mats = useCarMaterials();
  const tyre = useMemo(() => tyreGeometry(), []);
  const suspension = useRef<THREE.Group>(null);
  const spring = useRef({ y: 0, v: 0, lastVy: 0 });
  const beam = useRef<THREE.Mesh>(null);
  // Headlight pool painted on the ground: an additive glow decal instead of real spotlights, which
  // would add a light to every lit pixel in the scene (80k grass blades included).
  const beamMaterial = useMemo(
    () => new THREE.MeshBasicMaterial({ map: glowMap(), color: '#FFE2A6', transparent: true, opacity: 0.28, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }),
    [],
  );

  useFrame(({ clock }, rawDt) => {
    const dt = Math.min(rawDt, 1 / 30);
    // Brake lights flare on brake and reverse.
    const braking = carState.brake || carState.throttle < 0;
    mats.tail.emissiveIntensity = THREE.MathUtils.lerp(mats.tail.emissiveIntensity, braking ? 5 : 0.8, 1 - Math.exp(-14 * dt));

    // Visual suspension: a stiff damped spring kicked by sudden vertical velocity changes (landings,
    // bumps) plus a little road buzz while driving on the ground.
    const s = spring.current;
    const accel = (carState.vy - s.lastVy) / Math.max(dt, 1e-3);
    s.lastVy = carState.vy;
    let force = -140 * s.y - 11 * s.v - THREE.MathUtils.clamp(accel, -80, 80) * 0.35;
    if (carState.grounded) force += Math.sin(clock.elapsedTime * 31) * Math.min(Math.abs(carState.speed), 15) * 0.25;
    s.v += force * dt;
    s.y = THREE.MathUtils.clamp(s.y + s.v * dt, -0.12, 0.08);
    if (suspension.current) suspension.current.position.y = s.y;
    if (beam.current) beam.current.visible = carState.grounded;
  });

  return (
    <>
      <group ref={chassis}>
        <group ref={suspension}>
          {/* lower body and bonnet */}
          <RoundedBox args={[1.12, 0.36, 1.96]} radius={0.1} smoothness={3} position={[0, 0.03, 0]} material={mats.paint} castShadow />
          <RoundedBox args={[1.0, 0.06, 0.62]} radius={0.03} smoothness={2} position={[0, 0.22, 0.6]} material={mats.paint} castShadow />
          {/* racing stripe over bonnet and roof */}
          <mesh material={mats.teal} position={[0, 0.254, 0.6]}><boxGeometry args={[0.26, 0.005, 0.6]} /></mesh>
          {/* cabin: glass box with a cream roof and pillars, seats visible inside */}
          <RoundedBox args={[0.9, 0.32, 0.96]} radius={0.07} smoothness={2} position={[0, 0.37, -0.16]} material={mats.glass} />
          <RoundedBox args={[0.94, 0.07, 0.82]} radius={0.03} smoothness={2} position={[0, 0.55, -0.2]} material={mats.cream} castShadow />
          <mesh material={mats.teal} position={[0, 0.587, -0.2]}><boxGeometry args={[0.26, 0.005, 0.8]} /></mesh>
          {[-0.43, 0.43].flatMap((x) => [0.3, -0.62].map((z) => (
            <mesh key={`${x}${z}`} material={mats.cream} position={[x, 0.37, z]} rotation={[z > 0 ? -0.35 : 0.3, 0, 0]} castShadow>
              <boxGeometry args={[0.05, 0.34, 0.06]} />
            </mesh>
          )))}
          {[-0.2, 0.2].map((x) => (
            <group key={x} position={[x, 0, 0]}>
              <mesh material={mats.seat} position={[0, 0.24, -0.26]}><boxGeometry args={[0.28, 0.07, 0.3]} /></mesh>
              <mesh material={mats.seat} position={[0, 0.38, -0.42]} rotation={[-0.2, 0, 0]}><boxGeometry args={[0.28, 0.28, 0.07]} /></mesh>
            </group>
          ))}
          <mesh material={mats.trim} position={[0, 0.3, 0.18]}><boxGeometry args={[0.84, 0.1, 0.14]} /></mesh>
          <mesh material={mats.trim} position={[0.2, 0.36, 0.08]} rotation={[-1.1, 0, 0]}><torusGeometry args={[0.08, 0.014, 6, 16]} /></mesh>
          {/* bumpers, grille, exhaust */}
          <RoundedBox args={[1.16, 0.13, 0.16]} radius={0.05} smoothness={2} position={[0, -0.1, 0.96]} material={mats.trim} castShadow />
          <RoundedBox args={[1.16, 0.13, 0.16]} radius={0.05} smoothness={2} position={[0, -0.1, -0.96]} material={mats.trim} castShadow />
          <mesh material={mats.chrome} position={[0, 0.05, 0.99]}><boxGeometry args={[0.46, 0.12, 0.02]} /></mesh>
          {[-0.03, 0.01, 0.05].map((y) => (
            <mesh key={y} material={mats.trim} position={[0, 0.02 + y, 1.0]}><boxGeometry args={[0.42, 0.015, 0.012]} /></mesh>
          ))}
          <mesh material={mats.chrome} position={[0.32, -0.15, -1.03]} rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[0.035, 0.035, 0.12, 10]} /></mesh>
          {/* lights */}
          {[-0.38, 0.38].map((x) => (
            <group key={x} position={[x, 0.08, 0.99]}>
              <mesh material={mats.head} rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[0.075, 0.075, 0.03, 16]} /></mesh>
              <mesh material={mats.chrome}><torusGeometry args={[0.078, 0.012, 6, 18]} /></mesh>
            </group>
          ))}
          {[-0.38, 0.38].map((x) => (
            <mesh key={x} material={mats.tail} position={[x, 0.1, -0.99]}><boxGeometry args={[0.22, 0.08, 0.03]} /></mesh>
          ))}
          {/* mirrors and door handles */}
          {[-1, 1].map((side) => (
            <group key={side}>
              <mesh material={mats.trim} position={[side * 0.5, 0.3, 0.26]}><boxGeometry args={[0.08, 0.02, 0.03]} /></mesh>
              <mesh material={mats.paint} position={[side * 0.56, 0.33, 0.25]} castShadow><boxGeometry args={[0.05, 0.07, 0.11]} /></mesh>
              <mesh material={mats.chrome} position={[side * 0.563, 0.13, -0.06]}><boxGeometry args={[0.012, 0.025, 0.09]} /></mesh>
            </group>
          ))}
          <Plate z={1.045} />
          <Plate z={-1.045} flip />
          {/* antenna with the signature coral flag */}
          <group position={[-0.36, 0.59, -0.5]}>
            <mesh material={mats.trim} position={[0, 0.2, 0]}><cylinderGeometry args={[0.012, 0.015, 0.4, 6]} /></mesh>
            <Flag material={mats.flag} />
          </group>
        </group>
      </group>
      {/* on the car body, not the chassis, so it stays flat on the ground while the body leans */}
      <mesh ref={beam} material={beamMaterial} position={[0, -0.385, 2.6]} rotation={[-Math.PI / 2, 0, 0]} renderOrder={2}>
        <planeGeometry args={[2.6, 3.6]} />
      </mesh>
      {WHEELS.map(([x, y, z, front], i) => (
        <group key={i} position={[x, y, z]} ref={(el) => void (front ? (frontPivots.current[i] = el) : null)}>
          <group ref={(el) => void (wheels.current[i] = el)}>
            <Wheel x={x} mats={mats} tyre={tyre} />
          </group>
        </group>
      ))}
    </>
  );
}
