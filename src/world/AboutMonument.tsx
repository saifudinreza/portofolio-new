import { useEffect, useMemo } from 'react';
import { CuboidCollider, RigidBody } from '@react-three/rapier';
import { Text } from '@react-three/drei';
import * as THREE from 'three';
import { aboutBuilding, palette } from './layout';
import { certifications, education } from '../data/profile';
import { M, Parts, shapes } from './geo';
import { mossyStoneMaterial } from './stone';
import { trackLamp } from './dayCycle';
import { BODY_FONT, DISPLAY_FONT } from './common';
import { useStore } from '../store';

const { box, cyl, ball, torus } = shapes;

/** Shapes are laid out in the building's own frame: x across the front, z out of the front door, y up. */
const PODIUM = { hx: 8.7, hz: 5.1, h: 0.9 };
const HALL = { w: 9, d: 7, h: 4.5 };
const WING = { w: 3.8, d: 5.4, h: 3.4, x: 6.4, z: -0.6 };
const COLUMN_Z = 4.4;
const STEP_COUNT = 4;
const STEP_DEPTH = 0.45;
/** Front of the portico (where the pediment's face is) and of each wing. */
const FRONT_Z = COLUMN_Z + 0.95;
const WING_FRONT_Z = WING.z + WING.d / 2;

type Mat = 'stone' | 'wall' | 'teal' | 'coral' | 'gold' | 'wood' | 'dark' | 'navy' | 'leaf' | 'bronze' | 'cream' | 'window' | 'glow';
const MATS: Mat[] = ['stone', 'wall', 'teal', 'coral', 'gold', 'wood', 'dark', 'navy', 'leaf', 'bronze', 'cream', 'window', 'glow'];

function pediment() {
  const s = new THREE.Shape();
  s.moveTo(-4.7, 0);
  s.lineTo(4.7, 0);
  s.lineTo(0, 1.6);
  s.closePath();
  return new THREE.ExtrudeGeometry(s, { depth: 1.9, bevelEnabled: false }).translate(0, 0, -0.95);
}

function buildParts() {
  const piles = Object.fromEntries(MATS.map((m) => [m, new Parts()])) as Record<Mat, Parts>;
  const add = (mat: Mat, g: THREE.BufferGeometry, m: THREE.Matrix4) => piles[mat].add(g, m);

  // podium and the steps up to it
  add('stone', box(PODIUM.hx * 2, PODIUM.h, PODIUM.hz * 2), M());
  for (let j = 0; j < STEP_COUNT; j++) add('stone', box(6.4, PODIUM.h * (1 - (j + 1) / (STEP_COUNT + 1)), STEP_DEPTH), M(0, 0, PODIUM.hz + STEP_DEPTH * (j + 0.5)));

  // main hall with a flat roof, a drum and a teal dome with a lantern on top
  const top = PODIUM.h + HALL.h;
  add('wall', box(HALL.w, HALL.h, HALL.d), M(0, PODIUM.h, 0));
  add('stone', box(HALL.w + 0.4, 0.25, HALL.d + 0.4), M(0, top, 0));
  add('stone', cyl(2.35, 2.35, 0.5, 28), M(0, top + 0.25, 0));
  add('teal', new THREE.SphereGeometry(2.3, 28, 12, 0, Math.PI * 2, 0, Math.PI / 2), M(0, top + 0.75, 0));
  add('glow', cyl(0.4, 0.4, 0.9, 12), M(0, top + 0.75 + 2.3, 0));
  add('gold', shapes.cone(0.55, 0.6, 12), M(0, top + 0.75 + 3.2, 0));
  add('gold', ball(0.12, 8, 6), M(0, top + 0.75 + 3.85, 0));
  for (let i = 0; i < 4; i++) add('gold', torus(2.3, 0.04, Math.PI, 4, 20), M(0, top + 0.75, 0, 0, (i * Math.PI) / 4, 0));

  // portico: six columns, the entablature and the pediment
  for (let i = 0; i < 6; i++) {
    const x = -3.9 + i * 1.56;
    add('wall', cyl(0.3, 0.34, HALL.h, 14), M(x, PODIUM.h, COLUMN_Z));
    add('stone', cyl(0.42, 0.45, 0.25, 14), M(x, PODIUM.h, COLUMN_Z));
    add('stone', box(0.9, 0.2, 0.9), M(x, top - 0.2, COLUMN_Z));
  }
  add('stone', box(9.6, 0.5, 1.9), M(0, top, COLUMN_Z));
  add('wall', pediment(), M(0, top + 0.5, COLUMN_Z));
  add('teal', box(4.1, 0.22, 0.05), M(0, top + 0.5 + 1.15, FRONT_Z + 0.02));

  // door and windows (the windows glow at night)
  add('wood', box(1.5, 2.4, 0.1), M(0, PODIUM.h, HALL.d / 2 + 0.02));
  add('gold', ball(0.07, 8, 6), M(-0.45, PODIUM.h + 1.2, HALL.d / 2 + 0.1));
  add('gold', ball(0.07, 8, 6), M(0.45, PODIUM.h + 1.2, HALL.d / 2 + 0.1));
  for (const x of [-2.9, 2.9]) add('window', box(0.9, 1.9, 0.08), M(x, PODIUM.h + 1.2, HALL.d / 2 + 0.02));
  for (const side of [-1, 1]) {
    for (const dz of [-1.4, 1.0]) add('window', box(0.08, 1.4, 0.9), M(side * (WING.x + WING.w / 2 + 0.02), PODIUM.h + 1.3, WING.z + dz));
    add('window', box(0.08, 1.8, 0.9), M(side * (HALL.w / 2 + 0.02), PODIUM.h + 1.6, 0));
  }

  // wings: the left one for education, the right one for certificates, each with a hipped coral roof
  for (const side of [-1, 1]) {
    add('wall', box(WING.w, WING.h, WING.d), M(side * WING.x, PODIUM.h, WING.z));
    add('stone', box(WING.w + 0.3, 0.2, WING.d + 0.3), M(side * WING.x, PODIUM.h + WING.h, WING.z));
    add('coral', new THREE.ConeGeometry(2.76, 1.3, 4).rotateY(Math.PI / 4).translate(0, 0.65, 0), M(side * WING.x, PODIUM.h + WING.h + 0.2, WING.z, 0, 0, 0, 1, 1, 1.41));
  }
  // frames for the three certificates on the right wing
  for (const dx of [-1.2, 0, 1.2]) {
    add('gold', box(1.08, 0.82, 0.05), M(WING.x + dx, PODIUM.h + 1.75, WING_FRONT_Z + 0.01));
    add('cream', box(0.96, 0.7, 0.05), M(WING.x + dx, PODIUM.h + 1.81, WING_FRONT_Z + 0.03));
  }
  add('navy', box(2.6, 0.7, 0.06), M(-WING.x, PODIUM.h + 2.1, WING_FRONT_Z + 0.02));

  // statues on each side of the steps: a graduate and an open book
  for (const side of [-1, 1]) add('stone', box(0.9, 0.9, 0.9), M(side * 4.7, 0, 6.5));
  add('navy', cyl(0.3, 0.4, 1.2, 12), M(-4.7, 0.9, 6.5));
  add('bronze', ball(0.23, 12, 8), M(-4.7, 2.3, 6.5));
  add('dark', box(0.6, 0.05, 0.6), M(-4.7, 2.5, 6.5, 0, 0.4, 0));
  add('gold', box(0.05, 0.35, 0.05), M(-4.4, 2.15, 6.65));
  add('cream', cyl(0.06, 0.06, 0.5, 8), M(-4.4, 1.6, 6.75, 0, 0, Math.PI / 2 - 0.2));
  add('teal', box(1.2, 0.08, 0.8), M(4.7, 0.9, 6.5));
  add('cream', box(0.56, 0.05, 0.7), M(4.4, 1.02, 6.5, 0, 0, 0.3));
  add('cream', box(0.56, 0.05, 0.7), M(5.0, 1.02, 6.5, 0, 0, -0.3));
  add('gold', box(0.04, 0.02, 0.6), M(4.7, 1.0, 6.5));

  // lanterns and hedges at the foot of the steps, and a flag pole
  for (const x of [-3.6, 3.6]) {
    add('wood', cyl(0.06, 0.08, 1.9, 8), M(x, 0, 7.4));
    add('glow', box(0.26, 0.32, 0.26), M(x, 1.9, 7.4));
    add('coral', new THREE.ConeGeometry(0.24, 0.18, 4).rotateY(Math.PI / 4).translate(0, 0.09, 0), M(x, 2.22, 7.4));
  }
  for (const [x, z, ry] of [[-7.2, 6.1, 0], [7.2, 6.1, 0], [-6.2, 7.4, 0.3], [6.2, 7.4, -0.3]] as const) add('leaf', box(2.2, 0.7, 0.7), M(x, 0, z, 0, ry, 0));
  add('bronze', cyl(0.06, 0.08, 5.2, 8), M(8.0, 0, 7.0));
  add('gold', ball(0.12, 8, 6), M(8.0, 5.2, 7.0));
  add('teal', box(1.3, 0.8, 0.03), M(8.0 + 0.7, 4.3, 7.0));

  return piles;
}

/**
 * The About Me monument: a small domed academy on a podium with a six-column portico, two wings (education and
 * certificates), a statue of a graduate and an open book beside the steps, lanterns, hedges and a flag. It faces the
 * About road; the About pad is the courtyard in front of the steps. Built from primitives and merged into one mesh per
 * material; the text plates and the windows' night glow are the only extras.
 */
export function AboutMonument() {
  const tier = useStore((s) => s.tier);
  const scene = useMemo(() => {
    const piles = buildParts();
    const materials: Record<Mat, THREE.Material> = {
      stone: Object.assign(mossyStoneMaterial(0.35), { color: new THREE.Color('#D8CFBC') }),
      wall: new THREE.MeshStandardMaterial({ color: '#F3E6C8', roughness: 0.9 }),
      teal: new THREE.MeshStandardMaterial({ color: palette.teal, roughness: 0.6 }),
      coral: new THREE.MeshStandardMaterial({ color: palette.coral, roughness: 0.8 }),
      gold: new THREE.MeshStandardMaterial({ color: '#E8B341', roughness: 0.35, metalness: 0.5 }),
      wood: new THREE.MeshStandardMaterial({ color: palette.woodDark, roughness: 0.9 }),
      dark: new THREE.MeshStandardMaterial({ color: palette.dark, roughness: 0.7 }),
      navy: new THREE.MeshStandardMaterial({ color: palette.navy, roughness: 0.7 }),
      leaf: new THREE.MeshStandardMaterial({ color: palette.leaf, roughness: 0.9, flatShading: true }),
      bronze: new THREE.MeshStandardMaterial({ color: '#C98F4A', roughness: 0.5, metalness: 0.35 }),
      cream: new THREE.MeshStandardMaterial({ color: palette.cream, roughness: 0.8 }),
      window: trackLamp(new THREE.MeshStandardMaterial({ color: '#BFE6E8', emissive: '#FFC26B', emissiveIntensity: 0.35, roughness: 0.2 })),
      glow: trackLamp(new THREE.MeshStandardMaterial({ color: '#FFF1C9', emissive: '#FFC26B', emissiveIntensity: 2.2, roughness: 0.3 })),
    };
    return { meshes: MATS.filter((m) => !piles[m].empty).map((m) => ({ key: m, geometry: piles[m].merged(), material: materials[m] })) };
  }, []);

  useEffect(
    () => () => {
      for (const m of scene.meshes) m.geometry.dispose();
    },
    [scene],
  );

  const certs = [
    { title: 'BOOTCAMP · 97.26 (A+)', dx: -1.2, line: certifications[0]?.issuer ?? '' },
    { title: 'AWS CLOUD & GENAI', dx: 0, line: certifications[1]?.issuer ?? '' },
    { title: 'PYTHON FUNDAMENTALS', dx: 1.2, line: certifications[2]?.issuer ?? '' },
  ];
  return (
    <group position={[aboutBuilding.x, 0, aboutBuilding.z]} rotation={[0, aboutBuilding.yaw, 0]}>
      <RigidBody type="fixed" colliders={false} userData={{ material: 'stone' }}>
        <CuboidCollider args={[PODIUM.hx, PODIUM.h / 2, PODIUM.hz]} position={[0, PODIUM.h / 2, 0]} />
        <CuboidCollider args={[HALL.w / 2, 2.6, HALL.d / 2]} position={[0, PODIUM.h + 2.6, 0]} />
        {[-1, 1].map((side) => (
          <CuboidCollider key={side} args={[WING.w / 2, WING.h / 2, WING.d / 2]} position={[side * WING.x, PODIUM.h + WING.h / 2, WING.z]} />
        ))}
        <CuboidCollider args={[3.2, PODIUM.h / 2, (STEP_COUNT * STEP_DEPTH) / 2]} position={[0, PODIUM.h / 2, PODIUM.hz + (STEP_COUNT * STEP_DEPTH) / 2]} />
        {[-1, 1].map((side) => (
          <CuboidCollider key={`s${side}`} args={[0.45, 0.45, 0.45]} position={[side * 4.7, 0.45, 6.5]} />
        ))}
        {[-3.6, 3.6].map((x) => (
          <CuboidCollider key={x} args={[0.1, 1, 0.1]} position={[x, 1, 7.4]} />
        ))}
      </RigidBody>
      {scene.meshes.map((m) => (
        <mesh key={m.key} geometry={m.geometry} material={m.material} castShadow={tier !== 'low'} receiveShadow />
      ))}
      {/* the name on the pediment, the education sign and the three certificates */}
      <Text position={[0, PODIUM.h + HALL.h + 0.5 + 0.55, FRONT_Z + 0.06]} fontSize={0.55} color={palette.cream} font={DISPLAY_FONT} anchorX="center" anchorY="middle">ABOUT ME</Text>
      <Text position={[-WING.x, PODIUM.h + 2.25, WING_FRONT_Z + 0.07]} fontSize={0.26} color={palette.cream} font={DISPLAY_FONT} anchorX="center" anchorY="middle">EDUCATION</Text>
      <Text position={[-WING.x, PODIUM.h + 1.95, WING_FRONT_Z + 0.07]} fontSize={0.12} color={palette.cream} font={BODY_FONT} anchorX="center" anchorY="middle" maxWidth={2.4} textAlign="center">
        {(education[0]?.place ?? '').toUpperCase()}
      </Text>
      {certs.map((c) => (
        <group key={c.title} position={[WING.x + c.dx, PODIUM.h + 1.81, WING_FRONT_Z + 0.07]}>
          <Text fontSize={0.1} color={palette.navy} font={DISPLAY_FONT} anchorX="center" anchorY="middle" maxWidth={0.85} textAlign="center" position={[0, 0.08, 0]}>{c.title}</Text>
          <Text fontSize={0.07} color={palette.woodDark} font={BODY_FONT} anchorX="center" anchorY="middle" maxWidth={0.85} textAlign="center" position={[0, -0.2, 0]}>{c.line}</Text>
        </group>
      ))}
    </group>
  );
}
