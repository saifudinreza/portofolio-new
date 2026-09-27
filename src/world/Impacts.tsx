import { useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { SurfaceMaterial } from '../ui/sound';
import { pendingImpacts as pending } from './impactQueue';
import { palette } from './layout';

const MAX_DUST = 60;
const MAX_CHIPS = 80;

/** Colours of the little bits knocked off each material; empty = dust only. */
const chipColors: Record<SurfaceMaterial, string[]> = {
  wood: ['#B07A4A', palette.woodDark, '#D6A774'],
  plastic: [palette.coral, palette.cream],
  metal: ['#9AA3AD', '#C8CED4'],
  heavy: [palette.groundEdge, palette.rock],
  ground: [palette.groundEdge],
  stone: [palette.rock, '#8F8574'],
  foliage: [], // trees already drop their own leaves
  npc: [],
};

type Puff = { x: number; y: number; z: number; vx: number; vy: number; vz: number; age: number; life: number; size: number };
type Chip = Puff & { rx: number; ry: number; spin: number };

/** Dust puffs and flying chips where the car hits something. */
export function ImpactParticles() {
  const fx = useMemo(() => {
    const hidden = new THREE.Matrix4().makeScale(0, 0, 0);
    const dustMesh = new THREE.InstancedMesh(
      new THREE.IcosahedronGeometry(1, 0),
      new THREE.MeshStandardMaterial({ color: '#EADBB8', roughness: 1, transparent: true, opacity: 0.75, flatShading: true }),
      MAX_DUST,
    );
    const chipMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 0.6, 1), new THREE.MeshStandardMaterial({ roughness: 0.7, flatShading: true }), MAX_CHIPS);
    for (const mesh of [dustMesh, chipMesh]) {
      mesh.frustumCulled = false;
      for (let i = 0; i < mesh.count; i++) mesh.setMatrixAt(i, hidden);
    }
    chipMesh.castShadow = true;
    for (let i = 0; i < MAX_CHIPS; i++) chipMesh.setColorAt(i, new THREE.Color());
    return {
      dustMesh,
      chipMesh,
      dust: Array<Puff | null>(MAX_DUST).fill(null),
      chips: Array<Chip | null>(MAX_CHIPS).fill(null),
      m: new THREE.Matrix4(),
      q: new THREE.Quaternion(),
      e: new THREE.Euler(),
      p: new THREE.Vector3(),
      s: new THREE.Vector3(),
      c: new THREE.Color(),
    };
  }, []);

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 1 / 30);
    const { dust, chips, dustMesh, chipMesh, m, q, e, p, s, c } = fx;

    // Spawn queued bursts into free slots.
    while (pending.length) {
      const { at, material, strength } = pending.shift()!;
      let puffs = 2 + Math.round(strength * 4);
      for (let i = 0; i < MAX_DUST && puffs > 0; i++) {
        if (dust[i]) continue;
        puffs--;
        const a = Math.random() * Math.PI * 2;
        dust[i] = { x: at.x, y: Math.max(at.y, 0.15), z: at.z, vx: Math.cos(a) * (0.6 + strength), vy: 0.4 + Math.random() * 0.6, vz: Math.sin(a) * (0.6 + strength), age: 0, life: 0.7 + Math.random() * 0.5, size: 0.18 + strength * 0.25 };
      }
      const colors = chipColors[material];
      let bits = colors.length ? 2 + Math.round(strength * 8) : 0;
      for (let i = 0; i < MAX_CHIPS && bits > 0; i++) {
        if (chips[i]) continue;
        bits--;
        const a = Math.random() * Math.PI * 2;
        const out = 1 + Math.random() * 2.5 * (0.4 + strength);
        chips[i] = {
          x: at.x, y: Math.max(at.y, 0.2), z: at.z,
          vx: Math.cos(a) * out, vy: 2 + Math.random() * 3 * (0.4 + strength), vz: Math.sin(a) * out,
          age: 0, life: 1.2 + Math.random() * 0.6, size: 0.04 + Math.random() * 0.05,
          rx: Math.random() * 6, ry: Math.random() * 6, spin: (Math.random() - 0.5) * 20,
        };
        chipMesh.setColorAt(i, c.set(colors[Math.floor(Math.random() * colors.length)]));
        chipMesh.instanceColor!.needsUpdate = true;
      }
    }

    let anyDust = false;
    dust.forEach((d, i) => {
      if (!d) return;
      anyDust = true;
      d.age += dt;
      if (d.age >= d.life) {
        dust[i] = null;
        dustMesh.setMatrixAt(i, m.makeScale(0, 0, 0));
        return;
      }
      const drag = 1 - 2.5 * dt;
      d.vx *= drag;
      d.vz *= drag;
      d.x += d.vx * dt;
      d.y += d.vy * dt;
      d.z += d.vz * dt;
      const t = d.age / d.life;
      // puff grows quickly, then shrinks away
      const size = d.size * Math.sin(Math.min(1, t * 1.6) * Math.PI * 0.5) * (1 - t * t);
      dustMesh.setMatrixAt(i, m.compose(p.set(d.x, d.y, d.z), q.identity(), s.setScalar(size)));
    });
    if (anyDust) dustMesh.instanceMatrix.needsUpdate = true;

    let anyChip = false;
    chips.forEach((ch, i) => {
      if (!ch) return;
      anyChip = true;
      ch.age += dt;
      if (ch.age >= ch.life) {
        chips[i] = null;
        chipMesh.setMatrixAt(i, m.makeScale(0, 0, 0));
        return;
      }
      ch.vy -= 20 * dt;
      ch.x += ch.vx * dt;
      ch.y += ch.vy * dt;
      ch.z += ch.vz * dt;
      if (ch.y < ch.size) {
        // land and skid to a stop
        ch.y = ch.size;
        ch.vy = Math.abs(ch.vy) * 0.25;
        ch.vx *= 0.6;
        ch.vz *= 0.6;
        ch.spin *= 0.5;
      }
      ch.rx += ch.spin * dt;
      ch.ry += ch.spin * 0.7 * dt;
      const fade = Math.min(1, (ch.life - ch.age) / 0.3);
      chipMesh.setMatrixAt(i, m.compose(p.set(ch.x, ch.y, ch.z), q.setFromEuler(e.set(ch.rx, ch.ry, 0)), s.setScalar(ch.size * 2 * fade)));
    });
    if (anyChip) chipMesh.instanceMatrix.needsUpdate = true;
  });

  return (
    <>
      <primitive object={fx.dustMesh} />
      <primitive object={fx.chipMesh} />
    </>
  );
}
