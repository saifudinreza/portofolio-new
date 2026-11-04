import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { CylinderCollider, RigidBody } from '@react-three/rapier';
import * as THREE from 'three';
import { pond } from './layout';
import { mossyStoneMaterial } from './stone';
import { trackLamp } from './dayCycle';
import { useStore, type Tier } from '../store';

/** How far from the pond's centre the koi and lily pads keep away (0 centre, 1 water's edge), so nothing swims through the stone. */
export const FOUNTAIN_KEEP = 0.4;

const GRAVITY = 9.8;
const PER_STREAM = 8;
/** Share of the water particles drawn per tier. */
const WATER_SHARE: Record<Tier, number> = { low: 0.25, medium: 0.6, high: 1 };
/** Beyond this distance from the camera the fountain stops animating and is hidden. */
const FAR = 90;

/** One jet of water: a ballistic arc from `from` to `to` taking `time` seconds, drawn as a train of droplets. */
type Stream = { from: THREE.Vector3; vel: THREE.Vector3; time: number; offset: number; lands: boolean };

function makeStream(from: THREE.Vector3, to: THREE.Vector3, time: number, offset: number, lands = false): Stream {
  const vel = new THREE.Vector3((to.x - from.x) / time, (to.y - from.y + 0.5 * GRAVITY * time * time) / time, (to.z - from.z) / time);
  return { from, vel, time, offset, lands };
}

/** A lathe-turned bowl or ring from a list of (radius, height) points. */
const turned = (pts: [number, number][], segments = 28) => new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), segments);

/** The leaping koi statue: a tapered tube along an S-curve, plus fins and eyes, all merged into one geometry's worth of parts. */
function koiStatue() {
  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0.4, 0.05, 0),
    new THREE.Vector3(0.3, 0.36, 0),
    new THREE.Vector3(0.05, 0.72, 0),
    new THREE.Vector3(-0.1, 1.08, 0),
    new THREE.Vector3(-0.04, 1.42, 0),
    new THREE.Vector3(0.12, 1.7, 0),
  ]);
  const segs = 28;
  const radial = 10;
  const body = new THREE.TubeGeometry(curve, segs, 0.2, radial, false);
  const pos = body.getAttribute('position');
  const taper = (t: number) => (t < 0.7 ? 0.2 + 0.8 * Math.pow(t / 0.7, 0.8) : 1 - 0.45 * Math.pow((t - 0.7) / 0.3, 2));
  for (let i = 0; i < pos.count; i++) {
    const ring = Math.floor(i / (radial + 1));
    const t = ring / segs;
    const c = curve.getPointAt(t);
    const v = new THREE.Vector3().fromBufferAttribute(pos, i).sub(c).multiplyScalar(taper(t));
    pos.setXYZ(i, c.x + v.x, c.y + v.y, c.z + v.z);
  }
  body.computeVertexNormals();

  const up = new THREE.Vector3(0, 1, 0);
  // a flat triangular fin: base at its origin, tip along +y, thin in z
  const fin = (w: number, l: number) => new THREE.ConeGeometry(w, l, 3).translate(0, l / 2, 0).scale(1, 1, 0.16);
  const placed = (g: THREE.BufferGeometry, at: THREE.Vector3, dir: THREE.Vector3, roll = 0) => {
    const m = new THREE.Matrix4().compose(at, new THREE.Quaternion().setFromUnitVectors(up, dir.clone().normalize()).multiply(new THREE.Quaternion().setFromAxisAngle(up, roll)), new THREE.Vector3(1, 1, 1));
    return g.applyMatrix4(m);
  };
  const parts: THREE.BufferGeometry[] = [body];
  parts.push(placed(fin(0.3, 0.5), curve.getPointAt(0), new THREE.Vector3(0.1, -1, 0)));
  parts.push(placed(fin(0.16, 0.4), curve.getPointAt(0.56), new THREE.Vector3(-1, 0.25, 0)));
  parts.push(placed(fin(0.12, 0.3), curve.getPointAt(0.88), new THREE.Vector3(0.2, -0.3, 1), Math.PI / 2));
  parts.push(placed(fin(0.12, 0.3), curve.getPointAt(0.88), new THREE.Vector3(0.2, -0.3, -1), Math.PI / 2));
  parts.push(new THREE.SphereGeometry(0.1, 10, 8).translate(0.12, 1.72, 0));
  return { parts, mouth: new THREE.Vector3(0.14, 1.82, 0) };
}

function merge(parts: THREE.BufferGeometry[]) {
  // every part is non-indexed after toNonIndexed, so a plain concatenation of attributes is enough
  const flat = parts.map((g) => (g.index ? g.toNonIndexed() : g));
  const total = flat.reduce((n, g) => n + g.getAttribute('position').count, 0);
  const position = new Float32Array(total * 3);
  const normal = new Float32Array(total * 3);
  let o = 0;
  for (const g of flat) {
    position.set(g.getAttribute('position').array as Float32Array, o * 3);
    normal.set(g.getAttribute('normal').array as Float32Array, o * 3);
    o += g.getAttribute('position').count;
    g.dispose();
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(position, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(normal, 3));
  return out;
}

/**
 * A tiered stone fountain in the middle of the koi pond, topped by a bronze koi leaping out of the water. Water jets
 * arc from the koi's mouth into the upper basin, from the upper basin into the lower one, and from the lower one into
 * the pond, where they make ripples (through `onRipple`, the pond's own ripple system). At night a ring of lights glows
 * under the water.
 */
export function Fountain({ onRipple }: { onRipple: (x: number, z: number, strength: number, now: number) => void }) {
  const tier = useStore((s) => s.tier);
  const ripple = useRef(onRipple);
  useEffect(() => {
    ripple.current = onRipple;
  });
  const group = useRef<THREE.Group>(null);
  const nextRipple = useRef(0);

  const scene = useMemo(() => {
    const stone = mossyStoneMaterial(0.35);
    stone.color = new THREE.Color('#D8CFBC');
    stone.side = THREE.DoubleSide;
    const bronze = new THREE.MeshStandardMaterial({ color: '#C98F4A', roughness: 0.5, metalness: 0.35 });

    // stone: outer ring wall, central column, lower and upper basins
    const ring = turned([[1.08, 0], [1.3, 0], [1.3, 0.64], [1.22, 0.72], [1.1, 0.64], [1.08, 0.5]]);
    const column = turned([[0.0, 0], [0.34, 0], [0.26, 0.4], [0.2, 0.9], [0.24, 1.4], [0.18, 1.9], [0.0, 1.9]], 16);
    const lower = turned([[0.2, 0.92], [0.5, 0.98], [0.92, 1.14], [1.02, 1.28], [0.94, 1.28], [0.86, 1.2], [0.5, 1.08], [0.2, 1.04]]);
    const upper = turned([[0.16, 1.72], [0.36, 1.78], [0.58, 1.9], [0.64, 2.0], [0.58, 2.0], [0.5, 1.94], [0.3, 1.86], [0.16, 1.82]]);
    const finial = new THREE.SphereGeometry(0.3, 14, 10).scale(1, 0.7, 1).translate(0.18, 2.0, 0);

    const koi = koiStatue();
    const koiGeo = merge(koi.parts);

    // water in the basins
    const waterMat = new THREE.MeshStandardMaterial({ color: '#7FD0C4', roughness: 0.15, transparent: true, opacity: 0.8 });
    const lowerWater = new THREE.CircleGeometry(0.9, 24).rotateX(-Math.PI / 2).translate(0, 1.2, 0);
    const upperWater = new THREE.CircleGeometry(0.54, 20).rotateX(-Math.PI / 2).translate(0, 1.94, 0);
    // soft foam ring where the lower jets land in the pond
    const foam = new THREE.RingGeometry(1.32, 1.9, 36).rotateX(-Math.PI / 2).translate(0, pond.water + 0.012, 0);
    const foamMat = new THREE.MeshBasicMaterial({ color: '#FFFFFF', transparent: true, opacity: 0.2, depthWrite: false });

    // jets, as ballistic arcs from the koi's mouth, the upper rim and the lower rim
    const streams: Stream[] = [];
    const top = new THREE.Vector3(koi.mouth.x, koi.mouth.y + 1.95, koi.mouth.z);
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2 + 0.4;
      streams.push(makeStream(top, new THREE.Vector3(Math.cos(a) * 0.3, 1.96, Math.sin(a) * 0.3), 0.85, i / 3));
    }
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      streams.push(makeStream(new THREE.Vector3(Math.cos(a) * 0.55, 2.0, Math.sin(a) * 0.55), new THREE.Vector3(Math.cos(a) * 0.86, 1.22, Math.sin(a) * 0.86), 0.5, (i % 4) / 4));
    }
    const landings: [number, number][] = [];
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2 + 0.15;
      streams.push(makeStream(new THREE.Vector3(Math.cos(a) * 0.98, 1.3, Math.sin(a) * 0.98), new THREE.Vector3(Math.cos(a) * 1.55, pond.water, Math.sin(a) * 1.55), 0.5, (i % 5) / 5, true));
      landings.push([Math.cos(a) * 1.55, Math.sin(a) * 1.55]);
    }
    const total = streams.length * PER_STREAM;
    const drops = new THREE.InstancedMesh(
      new THREE.IcosahedronGeometry(1, 0),
      new THREE.MeshStandardMaterial({ color: '#E8FAF7', emissive: '#9FE3DA', emissiveIntensity: 0.25, roughness: 0.2, transparent: true, opacity: 0.85 }),
      total,
    );
    drops.frustumCulled = false;

    // lights under the water ring (glow at night)
    const glowMat = trackLamp(new THREE.MeshStandardMaterial({ color: '#FFF1C9', emissive: '#FFC26B', emissiveIntensity: 2.2, roughness: 0.3 }));
    const glow = new THREE.InstancedMesh(new THREE.SphereGeometry(0.09, 8, 6), glowMat, 8);
    const m = new THREE.Matrix4();
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 + 0.2;
      glow.setMatrixAt(i, m.makeTranslation(Math.cos(a) * 1.05, 0.12, Math.sin(a) * 1.05));
    }

    return { stone, bronze, ring, column, lower, upper, finial, koiGeo, waterMat, lowerWater, upperWater, foam, foamMat, streams, landings, drops, glow };
  }, []);

  useEffect(
    () => () => {
      for (const g of [scene.ring, scene.column, scene.lower, scene.upper, scene.finial, scene.koiGeo, scene.lowerWater, scene.upperWater, scene.foam]) g.dispose();
      scene.drops.geometry.dispose();
      scene.glow.geometry.dispose();
    },
    [scene],
  );

  const tmp = useMemo(() => ({ m: new THREE.Matrix4(), q: new THREE.Quaternion(), p: new THREE.Vector3(), s: new THREE.Vector3(), c: new THREE.Vector3() }), []);

  useFrame(({ clock, camera }) => {
    const g = group.current;
    if (!g) return;
    const now = clock.elapsedTime;
    // Nothing to see from far away: hide the whole thing and skip the work.
    tmp.c.set(pond.x, 1.5, pond.z);
    const near = camera.position.distanceTo(tmp.c) < FAR;
    g.visible = near;
    if (!near) return;

    const { streams, drops } = scene;
    const draw = Math.min(streams.length * PER_STREAM, Math.round(streams.length * PER_STREAM * WATER_SHARE[tier]));
    drops.count = draw;
    // droplet j belongs to stream j % streams, so a prefix thins every jet evenly
    for (let j = 0; j < draw; j++) {
      const st = streams[j % streams.length];
      const slot = Math.floor(j / streams.length);
      const phase = (now / st.time + st.offset + slot / PER_STREAM) % 1;
      const t = phase * st.time;
      tmp.p.set(st.from.x + st.vel.x * t, st.from.y + st.vel.y * t - 0.5 * GRAVITY * t * t, st.from.z + st.vel.z * t);
      const size = 0.04 + 0.012 * Math.sin(phase * Math.PI);
      tmp.m.compose(tmp.p, tmp.q.identity(), tmp.s.set(size, size * 1.4, size));
      drops.setMatrixAt(j, tmp.m);
    }
    drops.instanceMatrix.needsUpdate = true;

    // rings in the pond where the lower jets land, a few times a second (skipped on the lowest tier)
    if (tier !== 'low' && now > nextRipple.current) {
      nextRipple.current = now + 0.14;
      const [lx, lz] = scene.landings[Math.floor(Math.random() * scene.landings.length)];
      ripple.current(pond.x + lx, pond.z + lz, 0.5, now);
    }
    scene.foamMat.opacity = 0.16 + 0.07 * Math.sin(now * 2.3);
  });

  return (
    <group ref={group} position={[pond.x, 0, pond.z]}>
      <RigidBody type="fixed" colliders={false} userData={{ material: 'stone' }}>
        <CylinderCollider args={[0.9, 1.3]} position={[0, 0.9, 0]} />
      </RigidBody>
      <mesh geometry={scene.ring} material={scene.stone} castShadow receiveShadow />
      <mesh geometry={scene.column} material={scene.stone} castShadow receiveShadow />
      <mesh geometry={scene.lower} material={scene.stone} castShadow receiveShadow />
      <mesh geometry={scene.upper} material={scene.stone} castShadow receiveShadow />
      <mesh geometry={scene.finial} material={scene.stone} castShadow />
      <mesh geometry={scene.koiGeo} material={scene.bronze} position={[0, 1.95, 0]} castShadow />
      <mesh geometry={scene.lowerWater} material={scene.waterMat} />
      <mesh geometry={scene.upperWater} material={scene.waterMat} />
      {tier !== 'low' && <mesh geometry={scene.foam} material={scene.foamMat} />}
      <primitive object={scene.drops} />
      <primitive object={scene.glow} />
    </group>
  );
}
