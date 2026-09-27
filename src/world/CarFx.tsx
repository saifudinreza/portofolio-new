import { useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useStore } from '../store';
import { carState } from './carState';
import { pondDistance } from './layout';

const MAX_PUFFS = 120;
const MAX_SKIDS = 400;
// Car-local points (forward = +z, right = +x).
const REAR_WHEELS: [number, number][] = [[-0.6, -0.62], [0.6, -0.62]];
const EXHAUST: [number, number, number] = [0.32, -0.15, -1.1];

type Puff = { x: number; y: number; z: number; vx: number; vy: number; vz: number; age: number; life: number; size: number; grow: number };

/** Car-local (x, z) → world, using the live car position and heading. */
function toWorld(lx: number, lz: number) {
  const c = Math.cos(carState.yaw);
  const s = Math.sin(carState.yaw);
  return [carState.x + lx * c + lz * s, carState.z - lx * s + lz * c] as const;
}

/** Wheel dust, skid marks, exhaust smoke and the boost flame. */
export function CarFx() {
  const tier = useStore((s) => s.tier);
  const rich = tier !== 'low';

  const fx = useMemo(() => {
    const hidden = new THREE.Matrix4().makeScale(0, 0, 0);
    const puffMesh = new THREE.InstancedMesh(
      new THREE.IcosahedronGeometry(1, 1),
      new THREE.MeshStandardMaterial({ roughness: 1, transparent: true, opacity: 0.55, depthWrite: false }),
      MAX_PUFFS,
    );
    puffMesh.frustumCulled = false;
    for (let i = 0; i < MAX_PUFFS; i++) {
      puffMesh.setMatrixAt(i, hidden);
      puffMesh.setColorAt(i, new THREE.Color());
    }

    const skidMesh = new THREE.InstancedMesh(
      new THREE.PlaneGeometry(0.17, 1).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ color: '#5E4A34', transparent: true, opacity: 0.32, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }),
      MAX_SKIDS,
    );
    skidMesh.frustumCulled = false;
    for (let i = 0; i < MAX_SKIDS; i++) skidMesh.setMatrixAt(i, hidden);

    const flame = new THREE.Mesh(
      new THREE.ConeGeometry(0.07, 0.45, 10, 1, true).translate(0, -0.22, 0).rotateX(Math.PI / 2),
      new THREE.MeshStandardMaterial({ color: '#FFB347', emissive: '#FF7A1A', emissiveIntensity: 4, transparent: true, opacity: 0.85, depthWrite: false }),
    );
    flame.visible = false;

    return {
      puffMesh,
      skidMesh,
      flame,
      puffs: Array<Puff | null>(MAX_PUFFS).fill(null),
      skidIndex: 0,
      lastSkid: [null, null] as ({ x: number; z: number } | null)[],
      dustDebt: 0,
      smokeDebt: 0,
      m: new THREE.Matrix4(),
      q: new THREE.Quaternion(),
      p: new THREE.Vector3(),
      s: new THREE.Vector3(),
      c: new THREE.Color(),
      up: new THREE.Vector3(0, 1, 0),
    };
  }, []);

  const spawn = (x: number, y: number, z: number, color: string, size: number, vx: number, vy: number, vz: number, life: number) => {
    const i = fx.puffs.indexOf(null);
    if (i < 0) return;
    fx.puffs[i] = { x, y, z, vx, vy, vz, age: 0, life, size, grow: 1.8 };
    fx.puffMesh.setColorAt(i, fx.c.set(color));
    fx.puffMesh.instanceColor!.needsUpdate = true;
  };

  useFrame(({ clock }, rawDt) => {
    const dt = Math.min(rawDt, 1 / 30);
    const now = clock.elapsedTime;
    const { m, q, p, s } = fx;
    const speed = Math.abs(carState.speed);
    const wet = pondDistance(carState.x, carState.z) < 1;
    const onGround = carState.grounded && !wet;
    const back = -Math.sign(carState.speed || 1);
    const [fwdX, fwdZ] = [Math.sin(carState.yaw), Math.cos(carState.yaw)];

    // Dust kicked up behind the rear wheels.
    if (onGround && speed > 4) {
      fx.dustDebt += dt * speed * (rich ? 2.2 : 1);
      while (fx.dustDebt >= 1) {
        fx.dustDebt -= 1;
        const [lx, lz] = REAR_WHEELS[Math.random() < 0.5 ? 0 : 1];
        const [wx, wz] = toWorld(lx, lz);
        spawn(wx, 0.12, wz, '#E6D3AA', 0.12 + speed * 0.012, fwdX * back * 1.2 + (Math.random() - 0.5), 0.5 + Math.random() * 0.6, fwdZ * back * 1.2 + (Math.random() - 0.5), 0.6 + Math.random() * 0.5);
      }
    }

    // Thin exhaust smoke, thicker under throttle.
    fx.smokeDebt += dt * (1.5 + Math.max(0, carState.throttle) * (carState.boost ? 14 : 7)) * (rich ? 1 : 0.5);
    while (fx.smokeDebt >= 1) {
      fx.smokeDebt -= 1;
      const [ex, ez] = toWorld(EXHAUST[0], EXHAUST[2]);
      spawn(ex, carState.y + EXHAUST[1], ez, carState.boost ? '#8B8B8F' : '#B8B8BC', 0.05, -fwdX * 0.8 + (Math.random() - 0.5) * 0.3, 0.35, -fwdZ * 0.8 + (Math.random() - 0.5) * 0.3, 0.9 + Math.random() * 0.5);
    }

    let anyPuff = false;
    fx.puffs.forEach((pf, i) => {
      if (!pf) return;
      anyPuff = true;
      pf.age += dt;
      if (pf.age >= pf.life) {
        fx.puffs[i] = null;
        fx.puffMesh.setMatrixAt(i, m.makeScale(0, 0, 0));
        return;
      }
      const drag = 1 - 2 * dt;
      pf.vx *= drag;
      pf.vz *= drag;
      pf.x += pf.vx * dt;
      pf.y += pf.vy * dt;
      pf.z += pf.vz * dt;
      const t = pf.age / pf.life;
      const size = pf.size * (1 + t * pf.grow) * (1 - t * t);
      fx.puffMesh.setMatrixAt(i, m.compose(p.set(pf.x, pf.y, pf.z), q.identity(), s.setScalar(size)));
    });
    if (anyPuff) fx.puffMesh.instanceMatrix.needsUpdate = true;

    // Skid marks: dark strips laid between successive rear-wheel positions while braking hard or sliding.
    const skidding = onGround && ((carState.brake && speed > 3) || Math.abs(carState.latSpeed) > 2.2);
    REAR_WHEELS.forEach(([lx, lz], w) => {
      if (!skidding) {
        fx.lastSkid[w] = null;
        return;
      }
      const [x, z] = toWorld(lx, lz);
      const last = fx.lastSkid[w];
      if (!last) {
        fx.lastSkid[w] = { x, z };
        return;
      }
      const dx = x - last.x;
      const dz = z - last.z;
      const len = Math.hypot(dx, dz);
      if (len < 0.25) return;
      q.setFromAxisAngle(fx.up, Math.atan2(dx, dz));
      fx.skidMesh.setMatrixAt(fx.skidIndex, m.compose(p.set((x + last.x) / 2, 0.014, (z + last.z) / 2), q, s.set(1, 1, len)));
      fx.skidIndex = (fx.skidIndex + 1) % MAX_SKIDS;
      fx.skidMesh.instanceMatrix.needsUpdate = true;
      fx.lastSkid[w] = { x, z };
    });

    // Boost flame out of the exhaust.
    fx.flame.visible = carState.boost;
    if (carState.boost) {
      const [ex, ez] = toWorld(EXHAUST[0], EXHAUST[2]);
      fx.flame.position.set(ex, carState.y + EXHAUST[1], ez);
      fx.flame.rotation.set(0, carState.yaw, 0);
      const flicker = 0.8 + Math.sin(now * 60) * 0.12 + Math.random() * 0.15;
      fx.flame.scale.set(flicker, flicker, 0.8 + flicker * 0.6);
    }
  });

  return (
    <>
      <primitive object={fx.skidMesh} />
      <primitive object={fx.puffMesh} />
      <primitive object={fx.flame} />
    </>
  );
}
