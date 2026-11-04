import { useEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useStore } from '../store';
import { reducedMotion } from '../ui/device';
import { carState } from './carState';
import { day } from './dayCycle';
import { windUniforms } from './wind';

// Rain streaks in a 40 x 25 x 40 m box that follows the car. Each drop is one instance of a thin plane;
// the vertex shader makes it fall, wraps it round the box and leans it with the wind, so the CPU only
// updates a handful of uniforms per frame. Not drawn on Low (Experience leaves it out), half as many with
// reduced motion. No lightning: flashes need the owner's sign-off (photosensitivity).

const BOX = 40;
const HEIGHT = 25;
const FALL_SPEED = 18; // m/s
const MAX_DROPS = 1500;
const DROPS = { low: 0, medium: 800, high: 1500 } as const;
const OPACITY = 0.6;

const vertexHead = /* glsl */ `
uniform float uTime;
uniform vec2 uCenter;
uniform vec2 uWindDir;
uniform float uWindStrength;
attribute vec3 aDrop; // x, start height, z inside the box
`;

const vertexBody = /* glsl */ `
float y = mod(aDrop.y - uTime * ${FALL_SPEED.toFixed(1)}, ${HEIGHT.toFixed(1)});
// wrap each drop into the box around the car, so the box can follow without the drops jumping
vec2 xz = mod(aDrop.xz - uCenter + ${(BOX / 2).toFixed(1)}, ${BOX.toFixed(1)}) - ${(BOX / 2).toFixed(1)} + uCenter;
vec2 lean = uWindDir * uWindStrength * 0.3;
vec3 transformed = vec3(position.x, position.y, position.z);
transformed.xz += lean * position.y;
transformed += vec3(xz.x, y, xz.y);
`;

export function Rain() {
  const tier = useStore((s) => s.tier);
  const { mesh, material, uniforms, geometry } = useMemo(() => {
    // 5 cm wide: anything thinner falls under a pixel from the follow camera, 20 m away
    const base = new THREE.PlaneGeometry(0.05, 0.9).translate(0, 0.45, 0);
    const geometry = new THREE.InstancedBufferGeometry();
    geometry.index = base.index;
    geometry.setAttribute('position', base.getAttribute('position'));
    geometry.setAttribute('uv', base.getAttribute('uv'));
    const drops = new Float32Array(MAX_DROPS * 3);
    for (let i = 0; i < MAX_DROPS; i++) {
      drops[i * 3] = Math.random() * BOX;
      drops[i * 3 + 1] = Math.random() * HEIGHT;
      drops[i * 3 + 2] = Math.random() * BOX;
    }
    geometry.setAttribute('aDrop', new THREE.InstancedBufferAttribute(drops, 3));
    geometry.instanceCount = 0;

    const uniforms = { uTime: { value: 0 }, uCenter: { value: new THREE.Vector2() }, ...windUniforms };
    const material = new THREE.MeshBasicMaterial({ color: '#E8F2FC', transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide });
    material.onBeforeCompile = (shader) => {
      Object.assign(shader.uniforms, uniforms);
      shader.vertexShader = vertexHead + shader.vertexShader.replace('#include <begin_vertex>', vertexBody);
    };
    const mesh = new THREE.Mesh(geometry, material);
    // the drops are placed in the shader, so the mesh's own bounds mean nothing
    mesh.frustumCulled = false;
    mesh.visible = false;
    return { mesh, material, uniforms, geometry };
  }, []);

  const count = Math.round(DROPS[tier] * (reducedMotion() ? 0.5 : 1));
  useEffect(() => {
    geometry.instanceCount = count;
  }, [geometry, count]);
  useEffect(() => () => {
    geometry.dispose();
    material.dispose();
  }, [geometry, material]);

  useFrame(({ clock }) => {
    const rain = day.rain;
    mesh.visible = rain > 0.01 && count > 0;
    if (!mesh.visible) return;
    material.opacity = OPACITY * rain;
    uniforms.uTime.value = clock.elapsedTime;
    uniforms.uCenter.value.set(carState.x, carState.z);
  });

  return <primitive object={mesh} />;
}
