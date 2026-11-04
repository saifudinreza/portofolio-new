import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { CylinderCollider, RigidBody } from '@react-three/rapier';
import { Text } from '@react-three/drei';
import * as THREE from 'three';
import { bannerPoles, grandStatue, monumentLanterns, palette, projectMonuments, roadSegments, distanceToSegment, riverDistance } from './layout';
import { projects, profile } from '../data/profile';
import { M, Parts, shapes } from './geo';
import { mossyStoneMaterial } from './stone';
import { trackLamp } from './dayCycle';
import { windUniforms } from './wind';
import { DISPLAY_FONT } from './common';
import { useStore, type Tier } from '../store';

const { box, cyl, ball, torus } = shapes;

/** Top of the standard two-tier plinth every project monument stands on. */
const TOP = 0.95;
const COINS = 6;
const COIN_RING = { r: 1.65, y: 2.7 };

type Mat = 'stone' | 'gold' | 'bronze' | 'cream' | 'dark' | 'navy' | 'leaf' | 'wood' | 'glow' | 'goldGlow' | 'cyan' | 'p0' | 'p1' | 'p2' | 'p3' | 'p4' | 'p5';
type Add = (mat: Mat, geometry: THREE.BufferGeometry, local: THREE.Matrix4) => void;

/** The plinth: two stacked stone drums and a cream plate for the name. */
function plinth(add: Add, big = false) {
  if (big) {
    add('stone', cyl(2.6, 2.7, 0.5, 32), M());
    add('stone', cyl(2.1, 2.2, 0.5, 32), M(0, 0.5, 0));
    add('stone', cyl(1.7, 1.8, 0.6, 32), M(0, 1.0, 0));
    add('cream', box(2.1, 0.55, 0.08), M(0, 0.52, 2.17));
    return;
  }
  add('stone', cyl(1.35, 1.4, 0.45, 28), M());
  add('stone', cyl(1.1, 1.15, 0.5, 28), M(0, 0.45, 0));
  add('cream', box(1.5, 0.46, 0.07), M(0, 0.47, 1.13));
}

const shieldGeometry = (scale = 1, depth = 0.32) => {
  const s = new THREE.Shape();
  s.moveTo(-0.9, 0.9);
  s.lineTo(0.9, 0.9);
  s.bezierCurveTo(0.9, 0.2, 0.6, -0.5, 0, -0.95);
  s.bezierCurveTo(-0.6, -0.5, -0.9, 0.2, -0.9, 0.9);
  return new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: false, curveSegments: 10 }).translate(0, 0, -depth / 2).scale(scale, scale, 1);
};

/** The six monuments, in the order of `projects` (and of the pads): each is built from primitives into material piles. */
const monuments: ((add: Add) => void)[] = [
  // KasirAI: an obelisk crowned with a glowing coin, with a stack of coins at its foot
  (add) => {
    add('p0', new THREE.CylinderGeometry(0.3, 0.52, 2.4, 4).rotateY(Math.PI / 4).translate(0, 1.2, 0), M(0, TOP, 0));
    add('gold', new THREE.ConeGeometry(0.3, 0.55, 4).rotateY(Math.PI / 4).translate(0, 0.275, 0), M(0, TOP + 2.4, 0));
    add('goldGlow', new THREE.CylinderGeometry(0.65, 0.65, 0.14, 28).rotateX(Math.PI / 2), M(0, TOP + 3.55, 0));
    add('gold', torus(0.65, 0.05, Math.PI * 2, 6, 28), M(0, TOP + 3.55, 0));
    for (let i = 0; i < 4; i++) add('gold', cyl(0.42, 0.42, 0.1, 18), M(0.8 + (i % 2) * 0.03, TOP + i * 0.1, 0.4, 0, i * 0.7, 0));
    add('gold', cyl(0.4, 0.4, 0.1, 18), M(-0.8, TOP, 0.5, Math.PI / 2 - 0.2, 0.3, 0.5));
  },
  // KostKu: a little house with a coral roof, and a golden key
  (add) => {
    add('cream', box(1.7, 1.2, 1.4), M(-0.25, TOP, -0.1));
    add('p1', new THREE.ConeGeometry(1.4, 0.95, 4).rotateY(Math.PI / 4).translate(0, 0.475, 0), M(-0.25, TOP + 1.2, -0.1, 0, 0, 0, 1, 1, 0.82));
    add('wood', box(0.4, 0.7, 0.06), M(-0.25, TOP, 0.62));
    add('navy', box(0.32, 0.32, 0.06), M(-0.75, TOP + 0.55, 0.62));
    add('navy', box(0.32, 0.32, 0.06), M(0.25, TOP + 0.55, 0.62));
    add('stone', box(0.28, 0.6, 0.28), M(0.2, TOP + 1.7, -0.3));
    add('gold', torus(0.2, 0.05, Math.PI * 2, 6, 20), M(0.9, TOP + 1.1, 0.4));
    add('gold', box(0.09, 0.9, 0.07), M(0.9, TOP, 0.4));
    add('gold', box(0.24, 0.1, 0.07), M(1.0, TOP + 0.1, 0.4));
    add('gold', box(0.18, 0.1, 0.07), M(1.0, TOP + 0.3, 0.4));
  },
  // TrustPay: a shield with a padlock, standing on a pedestal (the coins that circle it are animated, see below)
  (add) => {
    add('stone', box(0.5, 0.7, 0.5), M(0, TOP, 0));
    add('navy', shieldGeometry(1.12, 0.32), M(0, TOP + 0.7 + 1.07, -0.03));
    add('p2', shieldGeometry(1, 0.32), M(0, TOP + 0.7 + 1.07, 0.03));
    add('navy', box(0.5, 0.42, 0.14), M(0, TOP + 0.7 + 0.85, 0.2));
    add('navy', torus(0.16, 0.05, Math.PI, 6, 14), M(0, TOP + 0.7 + 1.27, 0.2));
    add('gold', ball(0.05, 8, 6), M(0, TOP + 0.7 + 1.0, 0.28));
  },
  // Loka Living: a tree of life (bronze trunk, leafy crown, golden fruit) with a bench
  (add) => {
    add('wood', cyl(0.2, 0.34, 1.9, 10), M(0, TOP, 0));
    for (let i = 0; i < 4; i++) add('wood', cyl(0.05, 0.11, 1.0, 6), M(0, TOP + 1.6, 0, 0, (i / 4) * Math.PI * 2 + 0.4, 0.75));
    const crown: [number, number, number, number, number][] = [[0, 3.35, 0, 0.95, 0.8], [0.8, 3.05, 0.2, 0.65, 1], [-0.75, 3.1, -0.15, 0.7, 1], [0.1, 3.05, 0.75, 0.6, 1], [0, 3.85, 0, 0.55, 1]];
    for (const [x, y, z, r, sy] of crown) add('leaf', ball(r, 12, 8), M(x, y, z, 0, 0, 0, 1, sy, 1));
    for (const [x, y, z] of [[0.7, 3.4, 0.7], [-0.9, 3.2, 0.3], [0.2, 3.9, 0.5], [-0.3, 3.0, 0.95], [1.2, 3.1, 0], [0, 2.9, -0.9]] as const) add('gold', ball(0.1, 8, 6), M(x, y, z));
    add('wood', box(1.5, 0.1, 0.45), M(0, 0.42, 2.05));
    add('wood', box(0.1, 0.42, 0.4), M(-0.6, 0, 2.05));
    add('wood', box(0.1, 0.42, 0.4), M(0.6, 0, 2.05));
    add('wood', box(1.5, 0.38, 0.08), M(0, 0.52, 2.25));
  },
  // RentWheels: a bronze jeep on its plinth under a blue arch, with a road sign
  (add) => {
    add('bronze', box(1.1, 0.5, 2.0), M(0, TOP + 0.32, 0.45));
    add('bronze', box(1.0, 0.45, 0.95), M(0, TOP + 0.82, 0.1));
    add('dark', box(0.9, 0.3, 0.05), M(0, TOP + 0.92, 0.6));
    for (const [x, z] of [[-0.62, -0.2], [0.62, -0.2], [-0.62, 1.1], [0.62, 1.1]]) add('dark', new THREE.CylinderGeometry(0.34, 0.34, 0.22, 16).rotateZ(Math.PI / 2), M(x, TOP + 0.34, z));
    add('glow', ball(0.1, 8, 6), M(-0.35, TOP + 0.55, 1.45));
    add('glow', ball(0.1, 8, 6), M(0.35, TOP + 0.55, 1.45));
    add('p4', torus(1.0, 0.11, Math.PI, 8, 28), M(0, 0.45, -0.75));
    add('bronze', cyl(0.07, 0.07, 2.6, 8), M(-0.9, TOP, -0.45));
    add('p4', box(0.85, 0.45, 0.07), M(-0.5, TOP + 2.2, -0.45));
    add('cream', box(0.4, 0.07, 0.08), M(-0.5, TOP + 2.38, -0.4));
  },
  // AgentMon: a robot guardian holding up a glowing phone
  (add) => {
    for (const x of [-0.25, 0.25]) add('stone', box(0.28, 0.8, 0.28), M(x, TOP, 0));
    add('p5', box(0.95, 0.9, 0.55), M(0, TOP + 0.8, 0));
    add('cream', box(0.7, 0.55, 0.55), M(0, TOP + 1.75, 0));
    for (const x of [-0.17, 0.17]) add('cyan', ball(0.09, 8, 6), M(x, TOP + 2.05, 0.28));
    add('dark', cyl(0.03, 0.03, 0.4, 6), M(0, TOP + 2.3, 0));
    add('cyan', ball(0.1, 8, 6), M(0, TOP + 2.75, 0));
    add('p5', box(0.22, 0.8, 0.22), M(-0.62, TOP + 0.85, 0, 0, 0, 0.12));
    add('p5', box(0.22, 0.8, 0.22), M(0.62, TOP + 1.2, 0.15, -0.5, 0, -0.5));
    add('dark', box(0.45, 0.8, 0.07), M(0.98, TOP + 1.85, 0.5, -0.1, 0, -0.05));
    add('cyan', box(0.38, 0.68, 0.02), M(0.98, TOP + 1.9, 0.54, -0.1, 0, -0.05));
  },
];

/** The grand statue: a builder in a hard hat holding up a trophy. */
function grandStatueParts(add: Add) {
  plinth(add, true);
  const Y = 1.6;
  for (const x of [-0.28, 0.28]) add('navy', box(0.4, 1.5, 0.45), M(x, Y, 0));
  add('bronze', box(1.15, 1.45, 0.6), M(0, Y + 1.5, 0));
  add('bronze', box(0.3, 1.3, 0.3), M(-0.78, Y + 1.7, 0, 0, 0, 0.12));
  add('bronze', box(0.3, 1.5, 0.3), M(0.75, Y + 2.75, 0, 0, 0, -0.35));
  add('bronze', ball(0.42, 14, 10), M(0, Y + 3.3, 0));
  add('p2', new THREE.SphereGeometry(0.46, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), M(0, Y + 3.38, 0));
  add('p2', cyl(0.55, 0.55, 0.06, 18), M(0, Y + 3.36, 0.05));
  // trophy held up in the raised hand, with a glow above it
  add('gold', new THREE.CylinderGeometry(0.32, 0.12, 0.5, 14, 1, true).translate(0, 0.25, 0), M(1.28, Y + 4.2, 0));
  add('gold', cyl(0.06, 0.06, 0.25, 8), M(1.28, Y + 4.05, 0));
  add('goldGlow', ball(0.24, 12, 8), M(1.28, Y + 4.95, 0));
}

type Piles = Record<Mat, Parts>;
const MATS: Mat[] = ['stone', 'gold', 'bronze', 'cream', 'dark', 'navy', 'leaf', 'wood', 'glow', 'goldGlow', 'cyan', 'p0', 'p1', 'p2', 'p3', 'p4', 'p5'];

/** Flags on the banner poles: a few strips of cloth that ripple, fixed at the pole side. */
const FLAG_COLORS = [projects[0].color, projects[2].color, projects[4].color, projects[5].color];

const SHADOWS: Record<Tier, boolean> = { low: false, medium: true, high: true };

/**
 * A stone monument or statue beside each project pad, a grand statue at the north end of the field, lanterns, low
 * hedges and banner poles. Everything static is merged into one mesh per material, so the whole area costs a couple
 * of dozen draw calls; the coins around the TrustPay shield and the flags are animated.
 */
export function ProjectMonuments() {
  const tier = useStore((s) => s.tier);
  const coins = useRef<THREE.InstancedMesh>(null);
  const flags = useRef<THREE.InstancedMesh>(null);

  const scene = useMemo(() => {
    const piles = Object.fromEntries(MATS.map((m) => [m, new Parts()])) as Piles;
    const root = (x: number, z: number, yaw: number) => new THREE.Matrix4().compose(new THREE.Vector3(x, 0, z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw), new THREE.Vector3(1, 1, 1));
    const adder = (r: THREE.Matrix4): Add => (mat, g, local) => piles[mat].add(g, r.clone().multiply(local));

    projectMonuments.forEach((m, i) => {
      const add = adder(root(m.x, m.z, m.yaw));
      plinth(add);
      monuments[i](add);
    });
    grandStatueParts(adder(root(grandStatue.x, grandStatue.z, grandStatue.yaw)));

    // lanterns (a post, a glowing box and a coral cap) and banner poles, in world space
    const world = adder(new THREE.Matrix4());
    for (const [x, z] of monumentLanterns) {
      world('wood', cyl(0.06, 0.08, 1.9, 8), M(x, 0, z));
      world('glow', box(0.26, 0.32, 0.26), M(x, 1.9, z));
      world('p1', new THREE.ConeGeometry(0.24, 0.18, 4).rotateY(Math.PI / 4).translate(0, 0.09, 0), M(x, 2.22, z));
    }
    for (const [x, z] of bannerPoles) {
      world('bronze', cyl(0.07, 0.09, 4.4, 8), M(x, 0, z));
      world('gold', ball(0.13, 8, 6), M(x, 4.4, z));
    }
    // low hedges in an arc behind the grand statue, left out where they would touch a road or the river
    for (let i = 0; i < 9; i++) {
      const a = Math.PI * 0.55 + (i / 8) * Math.PI * 1.1;
      const x = grandStatue.x + Math.sin(a) * 4.6;
      const z = grandStatue.z + Math.cos(a) * 4.6;
      if (roadSegments.some((seg) => distanceToSegment(x, z, seg) < 3.2) || riverDistance(x, z) < 6.5) continue;
      world('leaf', box(2.2, 0.7, 0.8), M(x, 0, z, 0, a + Math.PI / 2, 0));
    }

    const materials: Record<Mat, THREE.Material> = {
      stone: Object.assign(mossyStoneMaterial(0.4), { color: new THREE.Color('#D8CFBC') }),
      gold: new THREE.MeshStandardMaterial({ color: '#E8B341', roughness: 0.35, metalness: 0.5 }),
      bronze: new THREE.MeshStandardMaterial({ color: '#C98F4A', roughness: 0.5, metalness: 0.35 }),
      cream: new THREE.MeshStandardMaterial({ color: palette.cream, roughness: 0.8 }),
      dark: new THREE.MeshStandardMaterial({ color: palette.dark, roughness: 0.7 }),
      navy: new THREE.MeshStandardMaterial({ color: palette.navy, roughness: 0.7 }),
      leaf: new THREE.MeshStandardMaterial({ color: palette.leaf, roughness: 0.9, flatShading: true }),
      wood: new THREE.MeshStandardMaterial({ color: palette.woodDark, roughness: 0.95 }),
      glow: trackLamp(new THREE.MeshStandardMaterial({ color: '#FFF1C9', emissive: '#FFC26B', emissiveIntensity: 2.2, roughness: 0.3 })),
      goldGlow: trackLamp(new THREE.MeshStandardMaterial({ color: '#F7B02A', emissive: '#F7B02A', emissiveIntensity: 0.9, roughness: 0.4, metalness: 0.3 })),
      cyan: trackLamp(new THREE.MeshStandardMaterial({ color: '#BFF3F0', emissive: '#4FE3D6', emissiveIntensity: 1.6, roughness: 0.3 })),
      p0: new THREE.MeshStandardMaterial({ color: projects[0].color, roughness: 0.7 }),
      p1: new THREE.MeshStandardMaterial({ color: projects[1].color, roughness: 0.7 }),
      p2: new THREE.MeshStandardMaterial({ color: projects[2].color, roughness: 0.7 }),
      p3: new THREE.MeshStandardMaterial({ color: projects[3].color, roughness: 0.7 }),
      p4: new THREE.MeshStandardMaterial({ color: projects[4].color, roughness: 0.7 }),
      p5: new THREE.MeshStandardMaterial({ color: projects[5].color, roughness: 0.7 }),
    };
    const meshes = MATS.filter((m) => !piles[m].empty).map((m) => ({ key: m, geometry: piles[m].merged(), material: materials[m] }));

    // animated bits: coins orbiting the TrustPay shield, and the flags
    const coinGeo = new THREE.CylinderGeometry(0.28, 0.28, 0.07, 18).rotateX(Math.PI / 2);
    const flagGeo = new THREE.PlaneGeometry(1.2, 0.75, 10, 1).translate(0.6, 0, 0);
    const flagMat = new THREE.MeshStandardMaterial({ roughness: 0.8, side: THREE.DoubleSide });
    const uniforms = { uTime: { value: 0 }, uWindStrength: windUniforms.uWindStrength };
    flagMat.onBeforeCompile = (shader) => {
      Object.assign(shader.uniforms, uniforms);
      shader.vertexShader = 'uniform float uTime;\nuniform float uWindStrength;\n' + shader.vertexShader.replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
float k = position.x / 1.2;
float w = sin(uTime * 3.2 + position.x * 5.0 + instanceMatrix[3].x) * 0.1 * k * (0.6 + 0.4 * uWindStrength);
transformed.z += w;
transformed.y += sin(uTime * 2.1 + position.x * 3.0 + instanceMatrix[3].z) * 0.035 * k;`,
      );
    };
    return { meshes, coinGeo, flagGeo, flagMat, uniforms, coinMat: materials.goldGlow };
  }, []);

  useEffect(
    () => () => {
      for (const m of scene.meshes) m.geometry.dispose();
      scene.coinGeo.dispose();
      scene.flagGeo.dispose();
    },
    [scene],
  );

  // flags: placed once, each one on a pole, with the colour of one project
  useEffect(() => {
    const f = flags.current;
    if (!f) return;
    const m = new THREE.Matrix4();
    const c = new THREE.Color();
    bannerPoles.forEach(([x, z], i) => {
      f.setMatrixAt(i, m.compose(new THREE.Vector3(x + 0.07, 3.85, z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), 0.5), new THREE.Vector3(1, 1, 1)));
      f.setColorAt(i, c.set(FLAG_COLORS[i % FLAG_COLORS.length]));
    });
    f.instanceMatrix.needsUpdate = true;
    if (f.instanceColor) f.instanceColor.needsUpdate = true;
  }, []);

  const tmp = useMemo(() => ({ m: new THREE.Matrix4(), q: new THREE.Quaternion(), p: new THREE.Vector3(), s: new THREE.Vector3(1, 1, 1), e: new THREE.Euler() }), []);
  useFrame(({ clock }) => {
    const now = clock.elapsedTime;
    scene.uniforms.uTime.value = now;
    const c = coins.current;
    if (!c) return;
    // the coins circle the shield in a ring that turns slowly, each one spinning on its own axis
    const m5 = projectMonuments[2];
    const cos = Math.cos(m5.yaw);
    const sin = Math.sin(m5.yaw);
    for (let i = 0; i < COINS; i++) {
      const a = now * 0.5 + (i / COINS) * Math.PI * 2;
      const lx = Math.cos(a) * COIN_RING.r;
      const lz = Math.sin(a) * COIN_RING.r;
      tmp.p.set(m5.x + lx * cos + lz * sin, COIN_RING.y + Math.sin(now * 1.6 + i) * 0.08, m5.z - lx * sin + lz * cos);
      tmp.q.setFromEuler(tmp.e.set(0, now * 1.5 + i, 0));
      c.setMatrixAt(i, tmp.m.compose(tmp.p, tmp.q, tmp.s));
    }
    c.instanceMatrix.needsUpdate = true;
  });

  const shadows = SHADOWS[tier];
  return (
    <group>
      <RigidBody type="fixed" colliders={false} userData={{ material: 'stone' }}>
        {projectMonuments.map((m, i) => (
          <CylinderCollider key={i} args={[0.9, 1.4]} position={[m.x, 0.9, m.z]} />
        ))}
        <CylinderCollider args={[0.8, 2.6]} position={[grandStatue.x, 0.8, grandStatue.z]} />
        {monumentLanterns.map(([x, z], i) => (
          <CylinderCollider key={`l${i}`} args={[1, 0.12]} position={[x, 1, z]} />
        ))}
      </RigidBody>
      {scene.meshes.map((m) => (
        <mesh key={m.key} geometry={m.geometry} material={m.material} castShadow={shadows} receiveShadow />
      ))}
      <instancedMesh ref={coins} args={[scene.coinGeo, scene.coinMat, COINS]} frustumCulled={false} />
      <instancedMesh ref={flags} args={[scene.flagGeo, scene.flagMat, bannerPoles.length]} frustumCulled={false} />
      {/* name plates: the project name on its monument, and the builder's name on the grand statue */}
      {projectMonuments.map((m, i) => (
        <group key={i} position={[m.x, 0, m.z]} rotation={[0, m.yaw, 0]}>
          <Text position={[0, 0.7, 1.18]} fontSize={0.19} color={palette.navy} font={DISPLAY_FONT} anchorX="center" anchorY="middle" maxWidth={1.4}>
            {projects[i].name.toUpperCase()}
          </Text>
        </group>
      ))}
      <group position={[grandStatue.x, 0, grandStatue.z]} rotation={[0, grandStatue.yaw, 0]}>
        <Text position={[0, 0.9, 2.22]} fontSize={0.22} color={palette.navy} font={DISPLAY_FONT} anchorX="center" anchorY="middle">THE BUILDER</Text>
        <Text position={[0, 0.66, 2.22]} fontSize={0.13} color={palette.navy} font={DISPLAY_FONT} anchorX="center" anchorY="middle" maxWidth={1.9}>
          {profile.name.toUpperCase()}
        </Text>
      </group>
    </group>
  );
}
