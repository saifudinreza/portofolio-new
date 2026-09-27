import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Environment, Lightformer } from '@react-three/drei';
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { WORLD_SIZE, palette, rng } from './layout';

const HALF = WORLD_SIZE / 2;
export const SEA_LEVEL = -1.4;

/**
 * Image-based lighting without an HDRI file: a few soft light panels baked once into an env map, used
 * for reflections on the car paint, chrome and glass (and a little fill everywhere else).
 */
export function EnvLighting() {
  return (
    <Environment frames={1} resolution={128} environmentIntensity={0.35}>
      <color attach="background" args={['#E9D2AA']} />
      <Lightformer form="rect" intensity={2.2} color="#FFF4E0" position={[0, 10, 0]} scale={[20, 20, 1]} />
      <Lightformer form="rect" intensity={1.2} color="#FFE2B5" position={[12, 4, 8]} scale={[10, 4, 1]} />
      <Lightformer form="rect" intensity={0.8} color="#9FD6D0" position={[-12, 3, -6]} scale={[10, 3, 1]} />
      <Lightformer form="ring" intensity={0.6} color={palette.coral} position={[0, 2, -14]} scale={4} />
    </Environment>
  );
}

// ---------- sky ----------

const skyVertex = /* glsl */ `
varying vec3 vDir;
void main() {
  vDir = normalize(position);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const skyFragment = /* glsl */ `
uniform vec3 uHorizon;
uniform vec3 uZenith;
uniform vec3 uSunDir;
varying vec3 vDir;
void main() {
  float h = clamp(vDir.y, 0.0, 1.0);
  vec3 col = mix(uHorizon, uZenith, pow(h, 0.55));
  float sun = max(dot(vDir, uSunDir), 0.0);
  col += vec3(1.0, 0.86, 0.6) * (pow(sun, 12.0) * 0.35 + pow(sun, 400.0) * 1.2);
  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;

/** Warm gradient dome with a soft sun glow. Follows the camera so it is never clipped, and is drawn after the
 * other opaque objects so only the pixels the island leaves uncovered get shaded (same for the sea). */
export function Sky() {
  const ref = useRef<THREE.Mesh>(null);
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: skyVertex,
        fragmentShader: skyFragment,
        side: THREE.BackSide,
        depthWrite: false,
        fog: false,
        uniforms: {
          uHorizon: { value: new THREE.Color(palette.sky) },
          uZenith: { value: new THREE.Color('#A9D8DA') },
          uSunDir: { value: new THREE.Vector3(12, 22, 8).normalize() },
        },
      }),
    [],
  );
  useFrame(({ camera }) => ref.current?.position.copy(camera.position));
  return (
    <mesh ref={ref} material={material} renderOrder={1000} frustumCulled={false}>
      <sphereGeometry args={[150, 32, 16]} />
    </mesh>
  );
}

/** Puffy low-poly clouds drifting slowly across the island and wrapping around. */
export function Clouds() {
  const { mesh, clouds } = useMemo(() => {
    const r = rng(77);
    const puffs: THREE.BufferGeometry[] = [];
    for (let i = 0; i < 6; i++) {
      const s = 1.4 + r() * 1.6;
      puffs.push(new THREE.IcosahedronGeometry(s, 1).translate((i - 2.5) * 1.6, (r() - 0.3) * 1.2, (r() - 0.5) * 2));
    }
    const geometry = mergeGeometries(puffs)!;
    geometry.scale(1, 0.55, 1);
    const count = 12;
    const mesh = new THREE.InstancedMesh(geometry, new THREE.MeshStandardMaterial({ color: '#FFF8EC', roughness: 1, flatShading: true, emissive: '#FFF1DC', emissiveIntensity: 0.25 }), count);
    mesh.frustumCulled = false;
    const clouds = Array.from({ length: count }, () => ({ x: (r() * 2 - 1) * 110, z: (r() * 2 - 1) * 110, y: 26 + r() * 14, s: 0.8 + r() * 1.1, yaw: r() * Math.PI }));
    return { mesh, clouds };
  }, []);
  const tmp = useMemo(() => ({ m: new THREE.Matrix4(), q: new THREE.Quaternion(), p: new THREE.Vector3(), s: new THREE.Vector3(), up: new THREE.Vector3(0, 1, 0) }), []);
  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 1 / 30);
    clouds.forEach((c, i) => {
      c.x += dt * 1.2;
      if (c.x > 120) c.x -= 240;
      mesh.setMatrixAt(i, tmp.m.compose(tmp.p.set(c.x, c.y, c.z), tmp.q.setFromAxisAngle(tmp.up, c.yaw), tmp.s.setScalar(c.s)));
    });
    mesh.instanceMatrix.needsUpdate = true;
  });
  return <primitive object={mesh} />;
}

// ---------- sea and cliffs ----------

const seaVertex = /* glsl */ `
#include <fog_pars_vertex>
uniform float uTime;
varying vec3 vWorld;
void main() {
  vec4 world = modelMatrix * vec4(position, 1.0);
  world.y += sin(world.x * 0.18 + uTime * 0.9) * 0.08 + sin(world.z * 0.23 - uTime * 0.7) * 0.06;
  vWorld = world.xyz;
  vec4 mvPosition = viewMatrix * world;
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}
`;

const seaFragment = /* glsl */ `
#include <fog_pars_fragment>
uniform float uTime;
uniform float uHalf;
uniform vec3 uShallow;
uniform vec3 uDeep;
varying vec3 vWorld;
void main() {
  // distance from the island's square shore
  vec2 q = abs(vWorld.xz) - vec2(uHalf);
  float shore = length(max(q, 0.0)) + min(max(q.x, q.y), 0.0);
  vec3 col = mix(uShallow, uDeep, smoothstep(0.0, 22.0, shore));
  float ripple = sin(vWorld.x * 1.3 + uTime * 1.6) * sin(vWorld.z * 1.1 - uTime * 1.3);
  col += vec3(0.06) * smoothstep(0.6, 1.0, ripple);
  float foam = (1.0 - smoothstep(0.0, 3.0, shore)) * (0.6 + 0.4 * sin(shore * 3.0 - uTime * 2.5));
  col = mix(col, vec3(1.0, 0.98, 0.94), clamp(foam, 0.0, 1.0) * 0.8);
  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
  #include <fog_fragment>
}
`;

/** Turquoise sea around the island with gentle swell and foam along the cliffs. */
export function Sea() {
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: seaVertex,
        fragmentShader: seaFragment,
        fog: true,
        uniforms: THREE.UniformsUtils.merge([
          THREE.UniformsLib.fog,
          { uTime: { value: 0 }, uHalf: { value: HALF + 1.5 }, uShallow: { value: new THREE.Color('#6CC7BA') }, uDeep: { value: new THREE.Color('#2C8C95') } },
        ]),
      }),
    [],
  );
  useFrame(({ clock }) => (material.uniforms.uTime.value = clock.elapsedTime));
  return (
    <mesh material={material} position={[0, SEA_LEVEL, 0]} rotation={[-Math.PI / 2, 0, 0]} renderOrder={999}>
      <planeGeometry args={[420, 420, 60, 60]} />
    </mesh>
  );
}

/** Ring of chunky rocks around the island's edge, replacing the flat box skirt. */
export function Cliffs() {
  const mesh = useMemo(() => {
    const r = rng(55);
    const rocks: { x: number; y: number; z: number; s: number; yaw: number; tilt: number }[] = [];
    for (const side of [0, 1, 2, 3]) {
      for (let t = -HALF - 1; t <= HALF + 1; t += 1.6 + r() * 1.2) {
        const out = HALF + 0.4 + r() * 1.2;
        const s = 1.1 + r() * 1.3;
        const [x, z] = side === 0 ? [t, -out] : side === 1 ? [t, out] : side === 2 ? [-out, t] : [out, t];
        rocks.push({ x, z, y: -1.6 + r() * 1.1, s, yaw: r() * Math.PI * 2, tilt: (r() - 0.5) * 0.5 });
      }
    }
    const inst = new THREE.InstancedMesh(new THREE.DodecahedronGeometry(1, 0), new THREE.MeshStandardMaterial({ flatShading: true, roughness: 0.95 }), rocks.length);
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const e = new THREE.Euler();
    const c = new THREE.Color();
    rocks.forEach((k, i) => {
      inst.setMatrixAt(i, m.compose(new THREE.Vector3(k.x, k.y, k.z), q.setFromEuler(e.set(k.tilt, k.yaw, k.tilt * 0.5)), new THREE.Vector3(k.s, k.s * 1.25, k.s)));
      inst.setColorAt(i, c.set(r() > 0.35 ? palette.rock : palette.groundEdge).offsetHSL(0, 0, (r() - 0.5) * 0.1));
    });
    inst.castShadow = false; // nothing out there receives it, and it would cost a shadow pass
    inst.receiveShadow = true;
    return inst;
  }, []);
  return <primitive object={mesh} />;
}
