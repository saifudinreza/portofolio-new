import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { CuboidCollider, RigidBody } from '@react-three/rapier';
import * as THREE from 'three';
import { RIVER_HALF_WIDTH, WORLD_SIZE, palette, riverDistance, roadSegments } from './layout';
import { carState } from './carState';
import { daySample } from './dayCycle';
import { Text } from '@react-three/drei';
import { BODY_FONT, DISPLAY_FONT, GroundText, Signboard } from './common';
import { useStore } from '../store';
import { groundColorMap, groundNormalMap, meadowMask, roadMap } from './textures';

const HALF = WORLD_SIZE / 2;

/** Soft sun that follows the car so shadows stay crisp without a huge shadow map. */
export function Lights() {
  const sun = useRef<THREE.DirectionalLight>(null);
  const hemi = useRef<THREE.HemisphereLight>(null);
  const target = useMemo(() => new THREE.Object3D(), []);
  const tier = useStore((s) => s.tier);
  // above low the environment map adds soft fill too, so the hemisphere light steps down
  const hemiBase = tier === 'low' ? 1.3 : 0.8;
  useFrame(() => {
    if (!sun.current) return;
    // colours and strength follow the time of day; the sun sinks towards the horizon at dawn and dusk
    const d = daySample;
    sun.current.position.set(carState.x + 12, d.sunHeight, carState.z + 8);
    sun.current.color.copy(d.sun);
    sun.current.intensity = d.sunIntensity;
    target.position.set(carState.x, 0, carState.z);
    target.updateMatrixWorld();
    if (hemi.current) {
      hemi.current.color.copy(d.hemiSky);
      hemi.current.groundColor.copy(d.hemiGround);
      hemi.current.intensity = hemiBase * d.hemiIntensity;
    }
  });
  return (
    <>
      <hemisphereLight ref={hemi} args={['#FFF4E0', '#C9A77A', hemiBase]} />
      <directionalLight
        ref={sun}
        target={target}
        // warm late-afternoon sun; the split-tone grade on High cools the shadows toward the sea's teal
        intensity={2.3}
        color="#FFE2B6"
        // the shadow pass re-renders every caster, the first thing to go on low
        castShadow={tier !== 'low'}
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

/** Olive tint on the sand wherever the meadow mask says grass grows (see meadowMask in textures.ts). */
function meadowShader(shader: THREE.WebGLProgramParametersWithUniforms) {
  shader.uniforms.uMeadow = { value: meadowMask() };
  shader.vertexShader = shader.vertexShader
    .replace('#include <common>', `#include <common>
varying vec2 vMeadowUv;`)
    .replace('#include <begin_vertex>', `#include <begin_vertex>
vMeadowUv = (modelMatrix * vec4(position, 1.0)).xz / ${WORLD_SIZE.toFixed(1)} + 0.5;`);
  shader.fragmentShader = shader.fragmentShader
    .replace('#include <common>', `#include <common>
varying vec2 vMeadowUv;
uniform sampler2D uMeadow;`)
    .replace('#include <map_fragment>', `#include <map_fragment>
float meadow = texture2D(uMeadow, vMeadowUv).r;
// olive soil, keeping the sand texture's light and dark variation
float shade = dot(diffuseColor.rgb, vec3(0.33));
diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.17, 0.25, 0.07) * (0.6 + 0.8 * shade), meadow * 0.95);`);
}

export function Ground() {
  return (
    <>
      <RigidBody type="fixed" colliders={false} friction={1} userData={{ material: 'ground' }}>
        <CuboidCollider args={[HALF, 1, HALF]} position={[0, -1, 0]} />
        {/* invisible walls around the island */}
        <CuboidCollider args={[HALF, 3, 0.5]} position={[0, 2, -HALF]} />
        <CuboidCollider args={[HALF, 3, 0.5]} position={[0, 2, HALF]} />
        <CuboidCollider args={[0.5, 3, HALF]} position={[-HALF, 2, 0]} />
        <CuboidCollider args={[0.5, 3, HALF]} position={[HALF, 2, 0]} />
      </RigidBody>
      {/* sandy top with a subtle normal map; the rocky cliffs (Atmosphere) hide the sides */}
      <mesh position={[0, 0, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[WORLD_SIZE, WORLD_SIZE]} />
        <meshStandardMaterial
          color={palette.ground}
          roughness={1}
          map={groundColorMap(24)}
          normalMap={groundNormalMap(24)}
          normalScale={new THREE.Vector2(0.35, 0.35)}
          onBeforeCompile={meadowShader}
        />
      </mesh>
      <mesh position={[0, -1.6, 0]}>
        <boxGeometry args={[WORLD_SIZE - 0.1, 3.18, WORLD_SIZE - 0.1]} />
        <meshStandardMaterial color={palette.groundEdge} roughness={1} />
      </mesh>
    </>
  );
}

/** One road strip's texture: shared canvas, own repeat so the pattern keeps its scale on every length. */
function roadTexture(length: number) {
  const t = roadMap().clone();
  t.repeat.set(1, length / 7);
  t.needsUpdate = true;
  return t;
}

/** Split a road into the stretches that stay on dry land; the bridge carries it over the river. */
function dryStretches([x1, z1, x2, z2]: [number, number, number, number]) {
  const steps = 80;
  const out: [number, number, number, number][] = [];
  let start = -1;
  for (let k = 0; k <= steps; k++) {
    const t = k / steps;
    const dry = riverDistance(x1 + (x2 - x1) * t, z1 + (z2 - z1) * t) > RIVER_HALF_WIDTH + 0.5;
    if (dry && start < 0) start = t;
    if ((!dry || k === steps) && start >= 0) {
      const end = dry ? t : (k - 1) / steps;
      if (end - start > 0.01) out.push([x1 + (x2 - x1) * start, z1 + (z2 - z1) * start, x1 + (x2 - x1) * end, z1 + (z2 - z1) * end]);
      start = -1;
    }
  }
  return out;
}

const SIGN_YAW = 0.25;
const SIGNS = [
  { label: 'PROJECTS', x: 8.5, z: 5.4 },
  { label: 'SKILLS', x: -9, z: 3.4 },
  { label: 'ABOUT', x: -9.5, z: 12 },
  { label: 'CONTACT', x: 7.5, z: 12 },
];

/** Light dirt roads from the centre to each area. */
export function Paths() {
  const segments = useMemo(() => roadSegments.filter((_, i) => i !== 5).flatMap(dryStretches), []);
  return (
    <group>
      {segments.map(([x1, z1, x2, z2], i) => {
        const dx = x2 - x1;
        const dz = z2 - z1;
        const len = Math.hypot(dx, dz);
        return (
          <mesh key={i} position={[(x1 + x2) / 2, 0.006, (z1 + z2) / 2]} rotation={[-Math.PI / 2, 0, Math.atan2(dx, dz)]} receiveShadow>
            {/* a little wider than the drivable 3 m so the ragged edges fade into the sand */}
            <planeGeometry args={[3.8, len + 1.5]} />
            <meshStandardMaterial color={palette.path} roughness={1} map={roadTexture(len + 1.5)} transparent depthWrite={false} polygonOffset polygonOffsetFactor={-1} />
          </mesh>
        );
      })}
      {/* Where the roads fork: a signboard beside each one instead of text painted on the ground. They sit clear of
          the 3 m drivable strip and turn a little towards the camera; the posts are solid, so they can be bumped. */}
      {SIGNS.map(({ label, x, z }) => (
        <Signboard key={label} position={[x, 0, z]} rotation={SIGN_YAW} width={3} height={0.7}>
          <Text fontSize={0.34} color={palette.navy} font={DISPLAY_FONT} anchorX="center" anchorY="middle">{label}</Text>
        </Signboard>
      ))}
    </group>
  );
}

/** A jump ramp and a slalom of traffic cones, purely for fun. */
export function Playground() {
  const cones = useMemo(() => Array.from({ length: 7 }, (_, i) => [6 + i * 1.6, 14 + (i % 2) * 1.4] as [number, number]), []);
  return (
    <group>
      <RigidBody type="fixed" colliders="cuboid" position={[-8, 0.55, 10]} rotation={[0.2, 0, 0]} friction={0.4} userData={{ material: 'heavy' }}>
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
        <RigidBody key={i} position={[x, 0.4, z]} colliders="hull" mass={0.08} friction={0.8} userData={{ material: 'plastic' }}>
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
    </group>
  );
}
