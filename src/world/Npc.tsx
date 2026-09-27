import { useEffect, useMemo, useRef, type RefObject } from 'react';
import { useFrame } from '@react-three/fiber';
import { CapsuleCollider, RigidBody, useRapier, type RapierCollider, type RapierRigidBody } from '@react-three/rapier';
import * as THREE from 'three';
import { npcRoutes, palette, pondDistance, type NpcRoute, type Waypoint } from './layout';
import { carState } from './carState';
import { actors, type Actor } from './actors';
import { boing } from '../ui/sound';

const WALK_SPEED = 1.3;
const RUN_SPEED = 4.2;
const WALK_STRIDE = 0.55; // metres per half gait cycle, so feet don't slide
const RUN_STRIDE = 0.8;
const TURN_RATE = 6;
const HIP = 0.47;
const SIT_DROP = 0.4;
const ACTOR_RADIUS = 0.6;
// Car collision box half extents (chassis plus a person's width).
const HIT_HALF_WIDTH = 0.8;
const HIT_HALF_LENGTH = 1.2;
const HIT_SPEED = 1.5;
const DODGE_SPEED = 5;
const DODGE_DISTANCE = 2.2;
const DODGE_TIME = DODGE_DISTANCE / RUN_SPEED;

const skins = ['#F1C6A0', '#D9A27A', '#A8714F', '#7A4B32'];
const shirts = [palette.teal, palette.coral, palette.yellow, palette.navy, '#8E6CC8', palette.cream, '#5FA052'];
const pants = ['#2F3A56', palette.dark, palette.woodDark, '#4A5A3A'];
const hairs = ['#2A1F1A', '#5A3A22', '#1A1A1E', '#C99A4B', '#8A3B22'];

type State = 'patrol' | 'idle' | 'avoid' | 'sit' | 'knocked' | 'getup';

const up = new THREE.Vector3(0, 1, 0);
const yawQuat = (yaw: number, q = new THREE.Quaternion()) => q.setFromAxisAngle(up, yaw);
const turnToward = (from: number, to: number, max: number) => from + THREE.MathUtils.clamp(Math.atan2(Math.sin(to - from), Math.cos(to - from)), -max, max);

/** Shift route points `side` metres to the walker's left, using the averaged direction at each corner. */
function offsetRoute({ points, side }: NpcRoute): Waypoint[] {
  if (!side || points.length < 2) return points;
  return points.map((p, i) => {
    const a = points[Math.max(0, i - 1)];
    const b = points[Math.min(points.length - 1, i + 1)];
    const dx = b.x - a.x;
    const dz = b.z - a.z;
    const len = Math.hypot(dx, dz) || 1;
    return { ...p, x: p.x - (dz / len) * side, z: p.z + (dx / len) * side };
  });
}

function nearestOnRoute(points: Waypoint[], x: number, z: number) {
  let best = { x: points[0].x, z: points[0].z, index: 0, d: Infinity };
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i];
    const b = points[i + 1];
    const dx = b.x - a.x;
    const dz = b.z - a.z;
    const t = THREE.MathUtils.clamp(((x - a.x) * dx + (z - a.z) * dz) / (dx * dx + dz * dz || 1), 0, 1);
    const px = a.x + dx * t;
    const pz = a.z + dz * t;
    const d = Math.hypot(x - px, z - pz);
    if (d < best.d) best = { x: px, z: pz, index: i + 1, d };
  }
  return best;
}

function Person({ route, seed }: { route: NpcRoute; seed: number }) {
  const body = useRef<RapierRigidBody>(null);
  const collider = useRef<RapierCollider>(null);
  const root = useRef<THREE.Group>(null);
  const head = useRef<THREE.Group>(null);
  const armL = useRef<THREE.Group>(null);
  const armR = useRef<THREE.Group>(null);
  const legL = useRef<THREE.Group>(null);
  const legR = useRef<THREE.Group>(null);
  const stars = useRef<THREE.Group>(null);
  const { rapier } = useRapier();

  const points = useMemo(() => offsetRoute(route), [route]);
  const look = {
    skin: skins[seed % skins.length],
    shirt: shirts[(seed * 3 + 1) % shirts.length],
    pants: pants[(seed * 5 + 2) % pants.length],
    hair: hairs[(seed * 7 + 3) % hairs.length],
  };

  const brain = useRef({
    state: (route.sit && points.length === 1 ? 'sit' : 'patrol') as State,
    x: points[0].x,
    z: points[0].z,
    y: 0,
    yaw: route.sit && points[0].look ? Math.atan2(points[0].look[0] - points[0].x, points[0].look[1] - points[0].z) : 0,
    index: Math.min(1, points.length - 1),
    dir: 1,
    timer: 0,
    look: null as [number, number] | null,
    phase: 0,
    gait: 0,
    wave: 0,
    dizzy: 0,
    dodge: { fromX: 0, fromZ: 0, toX: 0, toZ: 0, t: 0 },
    returnTo: null as { x: number; z: number } | null,
    knockedAt: 0,
    solidAt: 0,
    stillFor: 0,
    getup: { from: new THREE.Quaternion(), y: 0, t: 0 },
  });
  const actor = useRef<Actor>({ x: points[0].x, z: points[0].z, radius: ACTOR_RADIUS });
  const tmp = useMemo(() => ({ q: new THREE.Quaternion(), q2: new THREE.Quaternion(), v: new THREE.Vector3() }), []);

  useEffect(() => {
    const a = actor.current;
    actors.add(a);
    return () => void actors.delete(a);
  }, []);

  const startPatrol = (s: typeof brain.current) => {
    if (route.sit && points.length === 1 && Math.hypot(s.x - points[0].x, s.z - points[0].z) < 0.1) {
      s.state = 'sit';
      return;
    }
    s.state = 'patrol';
  };

  const knock = (s: typeof brain.current, rb: RapierRigidBody, vx: number, vz: number, now: number) => {
    const speed = Math.hypot(vx, vz);
    const awayX = s.x - carState.x;
    const awayZ = s.z - carState.z;
    const al = Math.hypot(awayX, awayZ) || 1;
    s.state = 'knocked';
    s.knockedAt = now;
    s.solidAt = now + 0.15; // stay a sensor for a moment so it doesn't spawn inside the car
    s.stillFor = 0;
    rb.setBodyType(rapier.RigidBodyType.Dynamic, true);
    rb.setLinvel({ x: vx * 0.7 + (awayX / al) * 2, y: 3.5 + speed * 0.25, z: vz * 0.7 + (awayZ / al) * 2 }, true);
    rb.setAngvel({ x: (Math.random() - 0.5) * 8, y: (Math.random() - 0.5) * 6, z: (Math.random() - 0.5) * 8 }, true);
    boing();
  };

  useFrame(({ clock }, rawDt) => {
    const rb = body.current;
    if (!rb) return;
    const dt = Math.min(rawDt, 1 / 30);
    const now = clock.elapsedTime;
    const s = brain.current;
    const prevX = s.x;
    const prevZ = s.z;
    const carVx = Math.sin(carState.yaw) * carState.speed;
    const carVz = Math.cos(carState.yaw) * carState.speed;
    const carSpeed = Math.abs(carState.speed);
    const dx = s.x - carState.x;
    const dz = s.z - carState.z;
    const carDist = Math.hypot(dx, dz);

    if (s.state !== 'knocked' && s.state !== 'getup') {
      // Hit test in the car's frame (right = (cos, -sin), forward = (sin, cos)).
      const lx = dx * Math.cos(carState.yaw) - dz * Math.sin(carState.yaw);
      const lz = dx * Math.sin(carState.yaw) + dz * Math.cos(carState.yaw);
      const touching = Math.abs(lx) < HIT_HALF_WIDTH && Math.abs(lz) < HIT_HALF_LENGTH && carState.y < 1.4;
      if (touching && carSpeed > HIT_SPEED) {
        knock(s, rb, carVx, carVz, now);
      } else if (touching) {
        // a gentle nudge just shuffles them out of the way
        s.x += (dx / (carDist || 1)) * dt * 2.5;
        s.z += (dz / (carDist || 1)) * dt * 2.5;
      } else if (s.state !== 'avoid' && carSpeed > DODGE_SPEED) {
        // Will the car pass within a metre or two in the next ~1.3 s? Then hop aside.
        const v2 = carVx * carVx + carVz * carVz;
        const t = (dx * carVx + dz * carVz) / v2;
        const cx = dx - carVx * t;
        const cz = dz - carVz * t;
        if (t > 0 && t < 1.3 && Math.hypot(cx, cz) < 1.8) {
          const len = Math.sqrt(v2);
          let px = -carVz / len;
          let pz = carVx / len;
          if (px * dx + pz * dz < 0) {
            px = -px;
            pz = -pz;
          }
          if (pondDistance(s.x + px * DODGE_DISTANCE, s.z + pz * DODGE_DISTANCE) < 1.15) {
            px = -px;
            pz = -pz;
          }
          s.dodge = { fromX: s.x, fromZ: s.z, toX: s.x + px * DODGE_DISTANCE, toZ: s.z + pz * DODGE_DISTANCE, t: 0 };
          s.state = 'avoid';
        }
      }
    }

    let targetYaw = s.yaw;
    let run = false;
    let headYaw = 0;
    let waving = false;
    const carNearAndSlow = carDist < 9 && carSpeed < 4;

    switch (s.state) {
      case 'patrol': {
        const wp = s.returnTo ?? points[s.index];
        const tx = wp.x - s.x;
        const tz = wp.z - s.z;
        const d = Math.hypot(tx, tz);
        if (d < 0.1) {
          if (s.returnTo) {
            s.returnTo = null;
            break;
          }
          const point = points[s.index];
          if (points.length > 1) {
            if (s.index + s.dir < 0 || s.index + s.dir >= points.length) s.dir = -s.dir;
            s.index += s.dir;
          }
          if (route.sit && points.length === 1) {
            s.state = 'sit';
          } else if (point.idle) {
            s.state = 'idle';
            s.timer = point.idle;
            s.look = point.look ?? null;
          }
          break;
        }
        const step = Math.min(d, WALK_SPEED * dt);
        s.x += (tx / d) * step;
        s.z += (tz / d) * step;
        targetYaw = Math.atan2(tx, tz);
        break;
      }
      case 'idle': {
        s.timer -= dt;
        if (s.look) targetYaw = Math.atan2(s.look[0] - s.x, s.look[1] - s.z);
        headYaw = s.dizzy > 0 ? Math.sin(now * 14) * 0.35 : Math.sin(now * 0.8 + seed) * 0.6;
        if (carNearAndSlow && s.dizzy <= 0) {
          targetYaw = Math.atan2(-dx, -dz);
          waving = true;
          headYaw = 0;
        }
        if (s.timer <= 0) startPatrol(s);
        break;
      }
      case 'sit': {
        const p = points[0];
        if (Math.hypot(s.x - p.x, s.z - p.z) > 0.4) {
          // shoved off their spot: stand up and walk back to it
          s.returnTo = { x: p.x, z: p.z };
          s.state = 'patrol';
          break;
        }
        if (p.look) targetYaw = Math.atan2(p.look[0] - s.x, p.look[1] - s.z);
        headYaw = Math.sin(now * 0.5 + seed) * 0.4;
        if (carNearAndSlow) {
          headYaw = THREE.MathUtils.clamp(Math.atan2(Math.sin(Math.atan2(-dx, -dz) - s.yaw), Math.cos(Math.atan2(-dx, -dz) - s.yaw)), -1.2, 1.2);
          waving = true;
        }
        break;
      }
      case 'avoid': {
        const d = s.dodge;
        d.t = Math.min(1, d.t + dt / DODGE_TIME);
        const e = 1 - (1 - d.t) * (1 - d.t);
        s.x = THREE.MathUtils.lerp(d.fromX, d.toX, e);
        s.z = THREE.MathUtils.lerp(d.fromZ, d.toZ, e);
        s.y = Math.sin(d.t * Math.PI) * 0.45;
        targetYaw = Math.atan2(d.toX - d.fromX, d.toZ - d.fromZ);
        run = true;
        if (d.t >= 1) {
          s.y = 0;
          s.state = 'idle';
          s.timer = 0.8;
          s.look = [carState.x, carState.z];
          const back = nearestOnRoute(points, s.x, s.z);
          if (points.length > 1) s.returnTo = back;
          else s.returnTo = { x: points[0].x, z: points[0].z };
        }
        break;
      }
      case 'knocked': {
        const c = collider.current;
        if (c && now > s.solidAt && c.isSensor()) c.setSensor(false);
        const t = rb.translation();
        s.x = t.x;
        s.z = t.z;
        const lin = rb.linvel();
        const still = Math.hypot(lin.x, lin.y, lin.z) < 0.25 && now - s.knockedAt > 0.8;
        s.stillFor = still ? s.stillFor + dt : 0;
        if (t.y < -5) {
          // flew off the island: quietly come back to the start of the route
          rb.setBodyType(rapier.RigidBodyType.KinematicPositionBased, true);
          collider.current?.setSensor(true);
          s.x = points[0].x;
          s.z = points[0].z;
          s.y = 0;
          s.index = Math.min(1, points.length - 1);
          s.returnTo = null;
          rb.setTranslation({ x: s.x, y: 0, z: s.z }, true);
          startPatrol(s);
        } else if (s.stillFor > 2 || now - s.knockedAt > 6) {
          const r = rb.rotation();
          s.getup = { from: new THREE.Quaternion(r.x, r.y, r.z, r.w), y: t.y, t: 0 };
          s.yaw = new THREE.Euler().setFromQuaternion(s.getup.from, 'YXZ').y;
          rb.setBodyType(rapier.RigidBodyType.KinematicPositionBased, true);
          collider.current?.setSensor(true);
          s.state = 'getup';
        }
        break;
      }
      case 'getup': {
        const g = s.getup;
        g.t = Math.min(1, g.t + dt / 0.7);
        const e = g.t * g.t * (3 - 2 * g.t);
        s.y = THREE.MathUtils.lerp(g.y, 0, e);
        if (g.t >= 1) {
          s.y = 0;
          s.state = 'idle';
          s.timer = 1.4;
          s.look = null;
          s.dizzy = 1.4;
          s.returnTo = points.length > 1 ? nearestOnRoute(points, s.x, s.z) : { x: points[0].x, z: points[0].z };
        }
        break;
      }
    }
    s.dizzy = Math.max(0, s.dizzy - dt);

    // Drive the kinematic body.
    if (s.state !== 'knocked') {
      if (s.state === 'getup') {
        const e = s.getup.t * s.getup.t * (3 - 2 * s.getup.t);
        tmp.q.copy(s.getup.from).slerp(yawQuat(s.yaw, tmp.q2), e);
      } else {
        s.yaw = turnToward(s.yaw, targetYaw, TURN_RATE * (run ? 2 : 1) * dt);
        yawQuat(s.yaw, tmp.q);
      }
      rb.setNextKinematicTranslation({ x: s.x, y: s.y, z: s.z });
      rb.setNextKinematicRotation(tmp.q);
    }

    // Share position with grass, trees and the pond.
    const a = actor.current;
    a.x = s.x;
    a.z = s.z;
    a.radius = s.state === 'knocked' ? (s.stillFor > 0 ? 0.5 : 0) : ACTOR_RADIUS;

    // ---- animation ----
    const moved = s.state === 'knocked' || s.state === 'getup' ? 0 : Math.hypot(s.x - prevX, s.z - prevZ);
    const speed = moved / Math.max(dt, 1e-3);
    // Phase advances with distance walked, so the feet stay planted whatever the speed.
    s.phase += (moved * Math.PI) / (run ? RUN_STRIDE : WALK_STRIDE);
    s.gait = THREE.MathUtils.lerp(s.gait, THREE.MathUtils.clamp(speed / WALK_SPEED, 0, 1) * (run ? 1 : 0.6), 1 - Math.exp(-10 * dt));
    s.wave = THREE.MathUtils.lerp(s.wave, waving ? 1 : 0, 1 - Math.exp(-6 * dt));
    const swing = Math.sin(s.phase) * s.gait;

    let legX = swing;
    let armX = -swing * 0.8;
    let legSpread = 0;
    let armSpread = 0.08;
    let drop = 0;
    let bob = Math.abs(Math.sin(s.phase)) * 0.06 * s.gait;
    if (s.state === 'sit') {
      legX = -Math.PI / 2 + Math.sin(now * 1.3 + seed) * 0.08;
      armX = -0.5;
      drop = SIT_DROP;
      bob = 0;
    } else if (s.state === 'knocked') {
      const flying = s.stillFor === 0;
      legX = flying ? Math.sin(now * 20) * 0.8 : 0;
      armX = 0;
      legSpread = flying ? 0.3 : 0.25;
      armSpread = flying ? 1.4 + Math.sin(now * 25) * 0.5 : 1.2;
      bob = 0;
    } else if (s.state === 'getup') {
      armSpread = 0.4;
    }

    const k = 1 - Math.exp(-18 * dt);
    const lerpRot = (g: THREE.Group | null, x: number, z: number) => {
      if (!g) return;
      g.rotation.x = THREE.MathUtils.lerp(g.rotation.x, x, k);
      g.rotation.z = THREE.MathUtils.lerp(g.rotation.z, z, k);
    };
    lerpRot(legL.current, legX, legSpread);
    lerpRot(legR.current, s.state === 'sit' ? legX : -legX, -legSpread);
    lerpRot(armR.current, -armX, -armSpread);
    // left arm doubles as the waving arm
    const waveZ = 2.6 + Math.sin(now * 10) * 0.35;
    lerpRot(armL.current, armX * (1 - s.wave), THREE.MathUtils.lerp(armSpread, waveZ, s.wave));
    if (head.current) head.current.rotation.y = THREE.MathUtils.lerp(head.current.rotation.y, headYaw, 1 - Math.exp(-5 * dt));
    if (root.current) root.current.position.y = THREE.MathUtils.lerp(root.current.position.y, bob - drop, k);

    // Dizzy stars circle the head while lying down and right after getting up.
    const showStars = (s.state === 'knocked' && s.stillFor > 0.2) || s.state === 'getup' || s.dizzy > 0;
    if (stars.current && head.current) {
      stars.current.visible = showStars;
      if (showStars) {
        head.current.getWorldPosition(tmp.v);
        stars.current.position.set(tmp.v.x, tmp.v.y + 0.35, tmp.v.z);
        stars.current.rotation.y = now * 4;
      }
    }
  });

  const start = points[0];
  return (
    <>
      <RigidBody
        ref={body}
        type="kinematicPosition"
        colliders={false}
        position={[start.x, 0, start.z]}
        linearDamping={0.6}
        angularDamping={1.5}
        canSleep={false}
      >
        <CapsuleCollider ref={collider} args={[0.3, 0.25]} position={[0, 0.6, 0]} sensor density={1} friction={0.8} restitution={0.3} />
        <group ref={root}>
          {/* legs pivot at the hip */}
          {[
            [legL, 0.09],
            [legR, -0.09],
          ].map(([ref, x], i) => (
            <group key={i} ref={ref as RefObject<THREE.Group>} position={[x as number, HIP, 0]}>
              <mesh position={[0, -0.21, 0]} castShadow>
                <boxGeometry args={[0.13, 0.42, 0.15]} />
                <meshStandardMaterial color={look.pants} />
              </mesh>
              <mesh position={[0, -0.44, 0.03]} castShadow>
                <boxGeometry args={[0.14, 0.06, 0.2]} />
                <meshStandardMaterial color={palette.dark} />
              </mesh>
            </group>
          ))}
          <mesh position={[0, 0.68, 0]} castShadow>
            <boxGeometry args={[0.36, 0.44, 0.22]} />
            <meshStandardMaterial color={look.shirt} />
          </mesh>
          {/* arms pivot at the shoulder */}
          {[
            [armL, 0.24],
            [armR, -0.24],
          ].map(([ref, x], i) => (
            <group key={i} ref={ref as RefObject<THREE.Group>} position={[x as number, 0.86, 0]}>
              <mesh position={[0, -0.16, 0]} castShadow>
                <boxGeometry args={[0.1, 0.32, 0.11]} />
                <meshStandardMaterial color={look.shirt} />
              </mesh>
              <mesh position={[0, -0.36, 0]}>
                <boxGeometry args={[0.09, 0.09, 0.09]} />
                <meshStandardMaterial color={look.skin} />
              </mesh>
            </group>
          ))}
          <group ref={head} position={[0, 0.9, 0]}>
            <mesh position={[0, 0.17, 0]} castShadow>
              <boxGeometry args={[0.3, 0.3, 0.28]} />
              <meshStandardMaterial color={look.skin} />
            </mesh>
            {route.hat ? (
              <mesh position={[0, 0.35, 0]} castShadow>
                <cylinderGeometry args={[0.17, 0.2, 0.12, 10]} />
                <meshStandardMaterial color={palette.yellow} />
              </mesh>
            ) : (
              <mesh position={[0, 0.3, -0.03]} castShadow>
                <boxGeometry args={[0.32, 0.09, 0.32]} />
                <meshStandardMaterial color={look.hair} />
              </mesh>
            )}
            {[0.07, -0.07].map((x) => (
              <mesh key={x} position={[x, 0.2, 0.145]}>
                <boxGeometry args={[0.04, 0.05, 0.01]} />
                <meshStandardMaterial color={palette.dark} />
              </mesh>
            ))}
          </group>
        </group>
      </RigidBody>
      <group ref={stars} visible={false}>
        {[0, 1, 2].map((i) => (
          <mesh key={i} position={[Math.cos((i * Math.PI * 2) / 3) * 0.22, 0, Math.sin((i * Math.PI * 2) / 3) * 0.22]}>
            <octahedronGeometry args={[0.05, 0]} />
            <meshStandardMaterial color={palette.yellow} emissive={palette.yellow} emissiveIntensity={0.5} />
          </mesh>
        ))}
      </group>
    </>
  );
}

/** Pedestrians walking the roads and footpaths, plus a guard and someone sitting by the pond. */
export function Npcs() {
  return (
    <>
      {npcRoutes.map((route, i) => (
        <Person key={i} route={route} seed={i} />
      ))}
    </>
  );
}
