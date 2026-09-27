import { useLayoutEffect, useMemo, useRef, type MutableRefObject } from 'react';
import { useFrame } from '@react-three/fiber';
import { RoundedBox, Text } from '@react-three/drei';
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
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
const TYRE_R = 0.3;
const TYRE_W = 0.26;

function useCarMaterials() {
  return useMemo(() => {
    // metalness kept low: more of it darkens the navy toward black from the top-down camera
    const paint = new THREE.MeshPhysicalMaterial({ color: palette.navy, metalness: 0.2, roughness: 0.34, clearcoat: 1, clearcoatRoughness: 0.08 });
    const cream = new THREE.MeshPhysicalMaterial({ color: palette.cream, roughness: 0.4, clearcoat: 0.8, clearcoatRoughness: 0.15 });
    const teal = new THREE.MeshPhysicalMaterial({ color: palette.teal, roughness: 0.35, clearcoat: 1, clearcoatRoughness: 0.1 });
    const glass = new THREE.MeshPhysicalMaterial({ color: '#2E4250', metalness: 0.2, roughness: 0.05, transparent: true, opacity: 0.55, clearcoat: 1, envMapIntensity: 1.8, depthWrite: false });
    const chrome = new THREE.MeshStandardMaterial({ color: '#E8ECEF', metalness: 1, roughness: 0.18 });
    // matte black plastic for fenders, bumpers, steps and the grille surround
    const plastic = new THREE.MeshStandardMaterial({ color: '#25272C', roughness: 0.85 });
    const steel = new THREE.MeshStandardMaterial({ color: '#3B3F47', metalness: 0.7, roughness: 0.4 });
    const trim = new THREE.MeshStandardMaterial({ color: '#2A2D34', roughness: 0.6 });
    const seat = new THREE.MeshStandardMaterial({ color: palette.coral, roughness: 0.8 });
    const head = new THREE.MeshStandardMaterial({ color: '#FFF6D8', emissive: '#FFE3A0', emissiveIntensity: 3 });
    const led = new THREE.MeshStandardMaterial({ color: '#F4FAFF', emissive: '#DDEBFF', emissiveIntensity: 2.4 });
    const tail = new THREE.MeshStandardMaterial({ color: '#E0462E', emissive: '#FF4A2A', emissiveIntensity: 0.8 });
    const tread = treadMap();
    const rubber = new THREE.MeshStandardMaterial({ color: '#1F2126', roughness: 0.92, bumpMap: tread, bumpScale: 3 });
    const rim = new THREE.MeshStandardMaterial({ color: '#4A4F58', metalness: 0.6, roughness: 0.35 });
    const flag = new THREE.MeshStandardMaterial({ color: palette.coral, side: THREE.DoubleSide, roughness: 0.7 });
    return { paint, cream, teal, glass, chrome, plastic, steel, trim, seat, head, led, tail, rubber, rim, flag };
  }, []);
}

/**
 * Chunky off-road tyre around the x axle: a bulging lathe carcass plus two staggered rows of tread lugs and
 * shoulder blocks, so the silhouette reads as knobbly even from the top-down camera.
 */
function tyreGeometry() {
  const hw = TYRE_W / 2;
  const pts = [
    [0.18, -hw], [0.26, -hw], [TYRE_R - 0.02, -hw + 0.02], [TYRE_R - 0.005, -hw * 0.45], [TYRE_R - 0.005, hw * 0.45], [TYRE_R - 0.02, hw - 0.02], [0.26, hw], [0.18, hw],
  ].map(([r, y]) => new THREE.Vector2(r, y));
  const carcass = new THREE.LatheGeometry(pts, 32).rotateZ(Math.PI / 2).toNonIndexed();
  carcass.deleteAttribute('uv');
  const lugs: THREE.BufferGeometry[] = [];
  const n = 16;
  for (let i = 0; i < n; i++) {
    for (const row of [-1, 1]) {
      const a = ((i + (row > 0 ? 0.5 : 0)) / n) * Math.PI * 2;
      const lug = new THREE.BoxGeometry(TYRE_W * 0.42, 0.035, 0.07)
        .translate(row * TYRE_W * 0.24, TYRE_R, 0)
        .rotateX(a);
      lug.deleteAttribute('uv');
      lugs.push(lug.toNonIndexed());
    }
  }
  return mergeGeometries([carcass, ...lugs])!;
}

/** Six-spoke beadlock-style rim, wide and dark, with a bright bolt ring. */
function rimGeometry() {
  const parts: THREE.BufferGeometry[] = [
    new THREE.CylinderGeometry(0.19, 0.19, 0.06, 24).rotateZ(Math.PI / 2),
    new THREE.CylinderGeometry(0.06, 0.07, 0.05, 12).rotateZ(Math.PI / 2).translate(0.03, 0, 0),
  ];
  for (let i = 0; i < 6; i++) parts.push(new THREE.BoxGeometry(0.03, 0.26, 0.05).translate(0.035, 0, 0).rotateX((i / 6) * Math.PI * 2));
  return mergeGeometries(parts.map((g) => {
    const n = g.toNonIndexed();
    n.deleteAttribute('uv');
    return n;
  }))!;
}

function Wheel({ x, mats, tyre, rim }: { x: number; mats: ReturnType<typeof useCarMaterials>; tyre: THREE.BufferGeometry; rim: THREE.BufferGeometry }) {
  const out = x > 0 ? 1 : -1;
  return (
    <>
      <mesh geometry={tyre} material={mats.rubber} castShadow />
      <group position={[out * 0.08, 0, 0]} scale={[out, 1, 1]}>
        <mesh geometry={rim} material={mats.rim} />
        <mesh material={mats.chrome} position={[0.035, 0, 0]} rotation={[0, Math.PI / 2, 0]}>
          <torusGeometry args={[0.2, 0.012, 6, 28]} />
        </mesh>
      </group>
    </>
  );
}

function Plate({ z, flip }: { z: number; flip?: boolean }) {
  return (
    <group position={[0, -0.02, z]} rotation={[0, flip ? Math.PI : 0, 0]}>
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

/** Tube between two points, for the roll cage. */
function Tube({ from, to, r = 0.025, material }: { from: [number, number, number]; to: [number, number, number]; r?: number; material: THREE.Material }) {
  const { position, quaternion, length } = useMemo(() => {
    const a = new THREE.Vector3(...from);
    const b = new THREE.Vector3(...to);
    const dir = b.clone().sub(a);
    return {
      position: a.clone().add(b).multiplyScalar(0.5),
      quaternion: new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize()),
      length: dir.length(),
    };
  }, [from, to]);
  return (
    <mesh position={position} quaternion={quaternion} material={material} castShadow>
      <cylinderGeometry args={[r, r, length, 10]} />
    </mesh>
  );
}

/** Flared wheel-arch fender: a half ring of black plastic hugging the top of the tyre, with a flat lip. */
function fenderGeometry() {
  const arch = new THREE.TorusGeometry(0.36, 0.05, 8, 20, Math.PI).rotateY(Math.PI / 2).scale(1.9, 1, 1);
  const lip = new THREE.BoxGeometry(0.2, 0.03, 0.78).translate(0, 0.35, 0);
  return mergeGeometries([arch.toNonIndexed(), lip.toNonIndexed()].map((g) => {
    g.deleteAttribute('uv');
    return g;
  }))!;
}

/**
 * Bake every mesh under `root` into one merged mesh per material. The jeep is ~55 small static meshes (tubes,
 * grille slots, bevelled boxes); drawn one by one they cost a draw call each, twice with shadows, every frame.
 * Merged they cost one per material, and the shape is untouched.
 */
function useMergeStatic(root: MutableRefObject<THREE.Group | null>) {
  useLayoutEffect(() => {
    const group = root.current;
    if (!group) return;
    group.updateWorldMatrix(true, true);
    const toLocal = group.matrixWorld.clone().invert();
    const byMaterial = new Map<THREE.Material, THREE.BufferGeometry[]>();
    const originals: THREE.Mesh[] = [];
    group.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh || Array.isArray(mesh.material)) return;
      const g = (mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry.clone()).applyMatrix4(new THREE.Matrix4().multiplyMatrices(toLocal, mesh.matrixWorld));
      // keep only what every part has, so they merge: position, normal and a (possibly blank) uv
      for (const name of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(name)) g.deleteAttribute(name);
      if (!g.getAttribute('uv')) g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(g.getAttribute('position').count * 2), 2));
      const list = byMaterial.get(mesh.material) ?? [];
      list.push(g);
      byMaterial.set(mesh.material, list);
      originals.push(mesh);
    });
    for (const m of originals) m.visible = false;
    const merged: THREE.Mesh[] = [];
    for (const [material, parts] of byMaterial) {
      const mesh = new THREE.Mesh(mergeGeometries(parts)!, material);
      mesh.castShadow = !(material as THREE.MeshPhysicalMaterial).transparent;
      mesh.receiveShadow = true;
      group.add(mesh);
      merged.push(mesh);
    }
    return () => {
      for (const m of merged) {
        group.remove(m);
        m.geometry.dispose();
      }
      for (const m of originals) m.visible = true;
    };
  }, [root]);
}

type Refs = {
  chassis: MutableRefObject<THREE.Group | null>;
  wheels: MutableRefObject<(THREE.Group | null)[]>;
  frontPivots: MutableRefObject<(THREE.Group | null)[]>;
};

// Roll cage points: hoop behind the seats, bars forward to the windscreen frame.
const CAGE_Y = 0.8;
const HOOP_Z = -0.42;
const SCREEN_TOP: [number, number] = [0.66, 0.26]; // y, z of the windscreen's top edge

/** The jeep's looks: body, open cabin with roll cage, lights, off-road wheels and visual suspension. Physics lives in Car. */
export function CarModel({ chassis, wheels, frontPivots }: Refs) {
  const mats = useCarMaterials();
  const tyre = useMemo(() => tyreGeometry(), []);
  const rim = useMemo(() => rimGeometry(), []);
  const fender = useMemo(() => fenderGeometry(), []);
  const suspension = useRef<THREE.Group>(null);
  const staticParts = useRef<THREE.Group>(null);
  useMergeStatic(staticParts);
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

  const [sy, sz] = SCREEN_TOP;
  return (
    <>
      <group ref={chassis}>
        <group ref={suspension}>
          <group ref={staticParts}>
          {/* tub and the raised bonnet section, boxy with bevelled edges */}
          <RoundedBox args={[1.14, 0.4, 1.46]} radius={0.06} smoothness={3} position={[0, 0.05, -0.2]} material={mats.paint} castShadow />
          <RoundedBox args={[1.06, 0.36, 0.72]} radius={0.06} smoothness={3} position={[0, 0.12, 0.64]} material={mats.paint} castShadow />
          {/* flat bonnet with a teal stripe and a pair of vents */}
          <mesh material={mats.teal} position={[0, 0.301, 0.64]}><boxGeometry args={[0.24, 0.004, 0.7]} /></mesh>
          {[-0.33, 0.33].map((x) => (
            <mesh key={x} material={mats.plastic} position={[x, 0.302, 0.66]}><boxGeometry args={[0.16, 0.006, 0.26]} /></mesh>
          ))}
          {/* seven-slot grille between round headlights, in a black surround */}
          <RoundedBox args={[0.98, 0.26, 0.04]} radius={0.02} smoothness={2} position={[0, 0.14, 1.0]} material={mats.plastic} />
          {[-3, -2, -1, 0, 1, 2, 3].map((i) => (
            <mesh key={i} material={mats.paint} position={[i * 0.055, 0.14, 1.022]}><boxGeometry args={[0.03, 0.18, 0.012]} /></mesh>
          ))}
          {[-0.36, 0.36].map((x) => (
            <group key={x} position={[x, 0.15, 1.02]}>
              <mesh material={mats.head} rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[0.075, 0.075, 0.03, 18]} /></mesh>
              <mesh material={mats.chrome}><torusGeometry args={[0.08, 0.013, 6, 18]} /></mesh>
            </group>
          ))}
          {/* windscreen: painted frame around dark glass, leaning back a little */}
          <group position={[0, 0.3, 0.27]} rotation={[-0.18, 0, 0]}>
            <mesh material={mats.glass} position={[0, 0.2, 0]}><boxGeometry args={[0.94, 0.32, 0.02]} /></mesh>
            <RoundedBox args={[1.04, 0.05, 0.05]} radius={0.02} smoothness={2} position={[0, 0.38, 0]} material={mats.paint} castShadow />
            {[-0.5, 0.5].map((x) => (
              <RoundedBox key={x} args={[0.05, 0.4, 0.05]} radius={0.02} smoothness={2} position={[x, 0.18, 0]} material={mats.paint} castShadow />
            ))}
          </group>
          {/* open cabin: seats, dash and steering wheel */}
          {[-0.22, 0.22].map((x) => (
            <group key={x} position={[x, 0, 0]}>
              <RoundedBox args={[0.3, 0.08, 0.32]} radius={0.03} smoothness={2} position={[0, 0.28, -0.24]} material={mats.seat} />
              <RoundedBox args={[0.3, 0.32, 0.08]} radius={0.03} smoothness={2} position={[0, 0.44, -0.42]} rotation={[-0.15, 0, 0]} material={mats.seat} />
            </group>
          ))}
          <RoundedBox args={[0.98, 0.1, 0.12]} radius={0.03} smoothness={2} position={[0, 0.3, 0.16]} material={mats.trim} />
          <mesh material={mats.trim} position={[0.22, 0.38, 0.06]} rotation={[-1.1, 0, 0]}><torusGeometry args={[0.08, 0.014, 6, 16]} /></mesh>
          {/* roll cage and the LED bar on top of it */}
          {[-0.5, 0.5].map((x) => (
            <group key={x}>
              <Tube from={[x, 0.24, HOOP_Z]} to={[x, CAGE_Y, HOOP_Z]} material={mats.plastic} />
              <Tube from={[x, CAGE_Y, HOOP_Z]} to={[x * 1.0, sy, sz]} material={mats.plastic} />
            </group>
          ))}
          <Tube from={[-0.5, CAGE_Y, HOOP_Z]} to={[0.5, CAGE_Y, HOOP_Z]} material={mats.plastic} />
          <Tube from={[-0.5, CAGE_Y - 0.2, HOOP_Z]} to={[0.5, CAGE_Y - 0.2, HOOP_Z]} r={0.018} material={mats.plastic} />
          <group position={[0, sy + 0.05, sz - 0.08]}>
            <RoundedBox args={[0.86, 0.07, 0.09]} radius={0.025} smoothness={2} material={mats.plastic} castShadow />
            <mesh material={mats.led} position={[0, 0, 0.047]}><boxGeometry args={[0.78, 0.035, 0.005]} /></mesh>
          </group>
          {/* chunky bumpers: steel front with a winch, plastic rear */}
          <RoundedBox args={[1.26, 0.15, 0.18]} radius={0.05} smoothness={2} position={[0, -0.1, 1.04]} material={mats.steel} castShadow />
          <mesh material={mats.plastic} position={[0, -0.1, 1.14]} rotation={[0, 0, Math.PI / 2]}><cylinderGeometry args={[0.05, 0.05, 0.3, 12]} /></mesh>
          {[-0.45, 0.45].map((x) => (
            <mesh key={x} material={mats.chrome} position={[x, -0.1, 1.14]} rotation={[0, Math.PI / 2, 0]}><torusGeometry args={[0.035, 0.01, 6, 12]} /></mesh>
          ))}
          <RoundedBox args={[1.2, 0.14, 0.16]} radius={0.05} smoothness={2} position={[0, -0.1, -0.97]} material={mats.plastic} castShadow />
          <mesh material={mats.chrome} position={[0.32, -0.15, -1.06]} rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[0.035, 0.035, 0.12, 10]} /></mesh>
          {/* tail lights: tall, in the rear corners */}
          {[-0.5, 0.5].map((x) => (
            <mesh key={x} material={mats.tail} position={[x, 0.1, -0.935]}><boxGeometry args={[0.08, 0.16, 0.02]} /></mesh>
          ))}
          {/* spare wheel on the tailgate */}
          <group position={[0, 0.22, -1.08]} rotation={[0, Math.PI / 2, 0]}>
            <mesh geometry={tyre} material={mats.rubber} castShadow />
            <group position={[0.08, 0, 0]}>
              <mesh geometry={rim} material={mats.rim} />
            </group>
          </group>
          {/* fenders over each wheel and running boards between them */}
          {WHEELS.map(([x, y, z], i) => (
            <mesh key={i} geometry={fender} material={mats.plastic} position={[x * 1.02, y, z]} castShadow />
          ))}
          {[-1, 1].map((side) => (
            <RoundedBox key={side} args={[0.14, 0.04, 0.5]} radius={0.015} smoothness={2} position={[side * 0.64, -0.17, 0]} material={mats.plastic} />
          ))}
          {/* mirrors on the windscreen frame */}
          {[-1, 1].map((side) => (
            <group key={side} position={[side * 0.6, 0.46, 0.25]}>
              <mesh material={mats.trim} position={[-side * 0.04, 0, 0]}><boxGeometry args={[0.08, 0.02, 0.02]} /></mesh>
              <RoundedBox args={[0.05, 0.08, 0.1]} radius={0.015} smoothness={2} material={mats.paint} castShadow />
            </group>
          ))}
          </group>
          {/* plates (text) and the flapping flag stay separate from the merged body */}
          <Plate z={1.135} />
          <Plate z={-1.06} flip />
          {/* antenna with the signature coral flag, on the rear corner */}
          <group position={[-0.5, 0.25, -0.86]}>
            <mesh material={mats.trim} position={[0, 0.32, 0]}><cylinderGeometry args={[0.012, 0.015, 0.64, 6]} /></mesh>
            <group position={[0, 0.44, 0]}>
              <Flag material={mats.flag} />
            </group>
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
            <Wheel x={x} mats={mats} tyre={tyre} rim={rim} />
          </group>
        </group>
      ))}
    </>
  );
}
