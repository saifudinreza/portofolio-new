import { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { CoefficientCombineRule, RigidBody, RoundCuboidCollider, useBeforePhysicsStep, useRapier, type CollisionEnterPayload, type RapierRigidBody } from '@react-three/rapier';
import * as THREE from 'three';
import { input, readDriveInput, useStore } from '../store';
import { zones, palette, pondDistance } from './layout';
import { impact, updateCarAudio, updateListener, type SurfaceMaterial } from '../ui/sound';
import { emitImpact } from './impactQueue';
import { carState } from './carState';
import { actors, type Actor } from './actors';

// Arcade driving tuning. Units: metres, seconds.
const MAX_SPEED = 13;
const BOOST_SPEED = 19;
const REVERSE_SPEED = 6;
const ACCEL = 24;
const TURN_RATE = 2.5;
const GRIP = 10;
const RIDE_HEIGHT = 0.4; // distance from body centre to the bottom of the wheels
const ROLLING_RESISTANCE = 2; // constant deceleration when coasting, m/s²
const PARK_SPEED = 0.3; // below this with no throttle the parking brake holds the car
const CAR_GRASS_RADIUS = 1.8;
const WATER_SPEED = 0.45; // top speed multiplier while wading through the pond
const WATER_DRAG = 1.5;
// Collisions: closing speed along the contact normal (m/s) below which nothing is heard, the speed that
// counts as a full-strength crash, and how long the same collider stays quiet after making a sound.
const IMPACT_MIN = 1.2;
const IMPACT_FULL = 12;
const IMPACT_COOLDOWN = 0.35;
const VEL_HISTORY = 6; // physics steps (~0.1 s at 60 Hz)

const CAMERA_OFFSET = new THREE.Vector3(4, 14, 14);
let zoom = 1;

const tmpQuat = new THREE.Quaternion();
const tmpForward = new THREE.Vector3();
const tmpUp = new THREE.Vector3();

const yawFromQuat = (q: { y: number; w: number }) => 2 * Math.atan2(q.y, q.w);

export function Car() {
  const body = useRef<RapierRigidBody>(null);
  const chassis = useRef<THREE.Group>(null);
  const wheels = useRef<(THREE.Group | null)[]>([]);
  const frontPivots = useRef<(THREE.Group | null)[]>([]);
  const lookAt = useRef(new THREE.Vector3());
  const tilt = useRef({ pitch: 0, roll: 0 });
  const parked = useRef(false);
  const actor = useRef<Actor>({ x: 0, z: 0, radius: 0 });
  const { rapier, world } = useRapier();
  const camera = useThree((s) => s.camera);
  const viewport = useThree((s) => s.size);
  // Portrait phones see less of the world sideways, so pull the camera back.
  const aspectZoom = viewport.width / viewport.height < 0.8 ? 1.6 : 1;
  const teleport = useStore((s) => s.teleport);
  const started = useStore((s) => s.started);
  // Velocity before each of the last few physics steps. Collision events are only handed over once per
  // render frame, which can hold several steps on a slow device, so the impact is judged against the
  // fastest recent approach rather than just the latest (already stopped) velocity.
  const velHistory = useRef<{ x: number; y: number; z: number }[]>([]);
  useBeforePhysicsStep(() => {
    const rb = body.current;
    if (!rb) return;
    const v = rb.linvel();
    const h = velHistory.current;
    h.push({ x: v.x, y: v.y, z: v.z });
    if (h.length > VEL_HISTORY) h.shift();
  });
  const lastImpact = useRef(new Map<number, number>());
  const shake = useRef(0);

  const onCollision = (e: CollisionEnterPayload) => {
    const material = ((e.other.rigidBody?.userData as { material?: SurfaceMaterial } | undefined)?.material) ?? 'heavy';
    // Only the part of the velocity going into the surface counts, so driving up the ramp or
    // scraping along a wall is silent while hitting it head-on is loud.
    const n = e.manifold.normal();
    let closing = 0;
    for (const v of velHistory.current) closing = Math.max(closing, Math.abs(v.x * n.x + v.y * n.y + v.z * n.z));
    if (closing < IMPACT_MIN) return;
    const now = performance.now() / 1000;
    const key = e.other.collider.handle;
    if (now - (lastImpact.current.get(key) ?? -Infinity) < IMPACT_COOLDOWN) return;
    lastImpact.current.set(key, now);

    const strength = THREE.MathUtils.clamp((closing - IMPACT_MIN) / (IMPACT_FULL - IMPACT_MIN), 0, 1);
    const p = e.manifold.numSolverContacts() > 0 ? e.manifold.solverContactPoint(0) : e.other.collider.translation();
    impact(material, strength, p);
    emitImpact(p, material, strength);
    // landings shouldn't rattle the camera, crashes into things should
    if (material !== 'ground' && strength > 0.35) shake.current = Math.max(shake.current, strength);
  };

  const place = (x: number, z: number, yaw: number) => {
    const rb = body.current;
    if (!rb) return;
    tmpQuat.setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
    rb.setTranslation({ x, y: 1.5, z }, true);
    rb.setRotation(tmpQuat, true);
    rb.setLinvel({ x: 0, y: 0, z: 0 }, true);
    rb.setAngvel({ x: 0, y: 0, z: 0 }, true);
  };

  useEffect(() => {
    if (!teleport) return;
    const z = zones[teleport.zone];
    place(z.spawn[0], z.spawn[1], z.yaw);
  }, [teleport]);

  useEffect(() => {
    const a = actor.current;
    actors.add(a);
    return () => void actors.delete(a);
  }, []);

  // Scroll to zoom the camera in and out.
  useEffect(() => {
    const onWheel = (e: WheelEvent) => {
      zoom = THREE.MathUtils.clamp(zoom + e.deltaY * 0.0008, 0.55, 1.6);
    };
    window.addEventListener('wheel', onWheel, { passive: true });
    return () => window.removeEventListener('wheel', onWheel);
  }, []);

  useFrame((_, rawDt) => {
    const rb = body.current;
    if (!rb) return;
    const dt = Math.min(rawDt, 1 / 30);
    const pos = rb.translation();
    const vel = rb.linvel();
    const yaw = yawFromQuat(rb.rotation());
    carState.x = pos.x;
    carState.z = pos.z;
    carState.yaw = yaw;
    carState.fps = THREE.MathUtils.lerp(carState.fps, 1 / Math.max(rawDt, 1e-3), 0.05);
    const fwd = { x: Math.sin(yaw), z: Math.cos(yaw) };
    const right = { x: Math.cos(yaw), z: -Math.sin(yaw) };
    const fwdSpeed = vel.x * fwd.x + vel.z * fwd.z;
    const latSpeed = vel.x * right.x + vel.z * right.z;
    const mass = rb.mass();

    // Ground check with a short ray straight down.
    const ray = new rapier.Ray({ x: pos.x, y: pos.y, z: pos.z }, { x: 0, y: -1, z: 0 });
    const hit = world.castRay(ray, RIDE_HEIGHT + 0.35, true, undefined, undefined, undefined, rb);
    const grounded = !!hit;
    carState.grounded = grounded;
    carState.speed = fwdSpeed;
    carState.mass = mass;
    carState.y = pos.y;
    actor.current.x = pos.x;
    actor.current.z = pos.z;
    actor.current.radius = grounded ? CAR_GRASS_RADIUS : 0;

    if (pos.y < -10 || input.resetRequested) {
      input.resetRequested = false;
      place(zones.home.spawn[0], zones.home.spawn[1], zones.home.yaw);
      return;
    }

    const drive = started ? readDriveInput() : { throttle: 0, steer: 0, brake: false, boost: false, horn: false };

    // Parking brake: with no throttle and almost no speed on the ground, pin the car in x/z so it
    // cannot creep down the ramp or keep sliding after a bump. Any throttle or leaving the ground frees it.
    const shouldPark = grounded && drive.throttle === 0 && Math.hypot(vel.x, vel.z) < PARK_SPEED;
    if (shouldPark !== parked.current) {
      parked.current = carState.parked = shouldPark;
      rb.setEnabledTranslations(!shouldPark, true, !shouldPark, true);
      if (shouldPark) rb.setLinvel({ x: 0, y: vel.y, z: 0 }, true);
    }

    if (grounded) {
      const wet = pondDistance(pos.x, pos.z) < 1;
      const top = (drive.boost ? BOOST_SPEED : MAX_SPEED) * (wet ? WATER_SPEED : 1);
      let push = 0;
      if (drive.throttle > 0 && fwdSpeed < top) push = drive.throttle * ACCEL * (drive.boost ? 1.35 : 1);
      if (drive.throttle < 0 && fwdSpeed > -REVERSE_SPEED) push = drive.throttle * ACCEL * (fwdSpeed > 0.5 ? 1.6 : 0.8);
      // Rolling resistance when coasting (proportional + a constant part so the car actually
      // comes to rest instead of decaying forever), strong damping when braking.
      let drag = 0;
      if (drive.throttle === 0) drag = fwdSpeed * 2.2 + Math.sign(fwdSpeed) * ROLLING_RESISTANCE;
      if (drive.brake) drag = fwdSpeed * 6 + Math.sign(fwdSpeed) * ROLLING_RESISTANCE;
      if (wet) drag += fwdSpeed * WATER_DRAG;
      const along = (push - drag) * mass * dt;
      // Kill sideways sliding so the car carves instead of drifting on ice.
      const grip = -latSpeed * Math.min(1, GRIP * dt) * mass;
      if (!parked.current) rb.applyImpulse({ x: fwd.x * along + right.x * grip, y: 0, z: fwd.z * along + right.z * grip }, true);

      // Also settles any leftover spin from a bump while parked (turnFactor is 0 at rest).
      const turnFactor = THREE.MathUtils.clamp(fwdSpeed / 3, -1, 1);
      const angY = rb.angvel().y;
      const targetAng = drive.steer * TURN_RATE * turnFactor;
      rb.setAngvel({ x: 0, y: THREE.MathUtils.lerp(angY, targetAng, Math.min(1, 12 * dt)), z: 0 }, true);
    }

    // Visuals: wheel spin, steering, body lean.
    const spin = (fwdSpeed * dt) / 0.28;
    wheels.current.forEach((w) => w && (w.rotation.x += spin));
    frontPivots.current.forEach((p) => p && (p.rotation.y = THREE.MathUtils.lerp(p.rotation.y, drive.steer * 0.45, 0.2)));
    const t = tilt.current;
    t.pitch = THREE.MathUtils.lerp(t.pitch, grounded ? -drive.throttle * 0.05 + (drive.brake ? 0.06 : 0) : 0, 0.1);
    t.roll = THREE.MathUtils.lerp(t.roll, grounded ? drive.steer * THREE.MathUtils.clamp(fwdSpeed / MAX_SPEED, -1, 1) * 0.1 : 0, 0.1);
    if (chassis.current) {
      chassis.current.rotation.x = t.pitch;
      chassis.current.rotation.z = t.roll;
    }

    // Camera: fixed isometric-ish angle that trails the car smoothly.
    const target = new THREE.Vector3(pos.x, 0, pos.z);
    const desired = target.clone().add(CAMERA_OFFSET.clone().multiplyScalar(zoom * aspectZoom));
    const k = 1 - Math.exp(-4 * dt);
    camera.position.lerp(desired, k);
    lookAt.current.lerp(target, k);
    camera.lookAt(lookAt.current);
    // Short decaying jolt after a hard crash; the follow lerp above pulls the camera back next frame.
    if (shake.current > 0.01) {
      const a = shake.current * 0.3;
      camera.position.x += (Math.random() - 0.5) * a;
      camera.position.y += (Math.random() - 0.5) * a;
      camera.position.z += (Math.random() - 0.5) * a;
      shake.current *= Math.exp(-9 * dt);
    }

    // Sound: the listener rides on the camera, the engine/horn/tyres sit on the car.
    camera.getWorldDirection(tmpForward);
    tmpUp.set(0, 1, 0).applyQuaternion(camera.quaternion);
    updateListener(camera.position, tmpForward, tmpUp);
    updateCarAudio({
      x: pos.x,
      y: pos.y,
      z: pos.z,
      speed: fwdSpeed,
      throttle: drive.throttle,
      boost: drive.boost,
      brake: drive.brake,
      grounded,
      horn: drive.horn,
      dt,
    });
  });

  const wheelPositions: [number, number, number, boolean][] = [
    [-0.6, -0.12, 0.6, true],
    [0.6, -0.12, 0.6, true],
    [-0.6, -0.12, -0.62, false],
    [0.6, -0.12, -0.62, false],
  ];

  return (
    <RigidBody
      ref={body}
      colliders={false}
      position={[zones.home.spawn[0], 1.5, zones.home.spawn[1]]}
      rotation={[0, zones.home.yaw, 0]}
      enabledRotations={[false, true, false]}
      linearDamping={0.15}
      angularDamping={2}
      canSleep={false}
      ccd
      userData={{ isCar: true }}
      onCollisionEnter={onCollision}
    >
      <RoundCuboidCollider args={[0.45, 0.2, 0.85, 0.1]} position={[0, -0.1, 0]} friction={0} frictionCombineRule={CoefficientCombineRule.Min} restitution={0.05} density={2} />
      <group ref={chassis}>
        {/* body */}
        <mesh castShadow position={[0, 0.02, 0]}>
          <boxGeometry args={[1.1, 0.34, 1.9]} />
          <meshStandardMaterial color={palette.navy} roughness={0.55} />
        </mesh>
        {/* cabin */}
        <mesh castShadow position={[0, 0.34, -0.15]}>
          <boxGeometry args={[0.9, 0.34, 0.95]} />
          <meshStandardMaterial color={palette.cream} roughness={0.6} />
        </mesh>
        {/* windscreen */}
        <mesh position={[0, 0.36, 0.34]} rotation={[-0.35, 0, 0]}>
          <boxGeometry args={[0.8, 0.26, 0.04]} />
          <meshStandardMaterial color="#7FB6C9" roughness={0.2} metalness={0.2} />
        </mesh>
        {/* teal stripe */}
        <mesh position={[0, 0.2, 0.2]}>
          <boxGeometry args={[0.3, 0.01, 1.52]} />
          <meshStandardMaterial color={palette.teal} />
        </mesh>
        {/* headlights */}
        {[-0.38, 0.38].map((x) => (
          <mesh key={x} position={[x, 0.06, 0.96]}>
            <boxGeometry args={[0.2, 0.1, 0.04]} />
            <meshStandardMaterial color="#FFF3C4" emissive="#FFE08A" emissiveIntensity={1.2} />
          </mesh>
        ))}
        {/* tail lights */}
        {[-0.38, 0.38].map((x) => (
          <mesh key={x} position={[x, 0.08, -0.96]}>
            <boxGeometry args={[0.2, 0.08, 0.04]} />
            <meshStandardMaterial color={palette.coral} emissive={palette.coral} emissiveIntensity={0.6} />
          </mesh>
        ))}
        {/* antenna with a little flag */}
        <mesh position={[-0.36, 0.72, -0.45]}>
          <cylinderGeometry args={[0.015, 0.015, 0.5]} />
          <meshStandardMaterial color={palette.dark} />
        </mesh>
        <mesh position={[-0.26, 0.9, -0.45]}>
          <boxGeometry args={[0.2, 0.12, 0.01]} />
          <meshStandardMaterial color={palette.coral} />
        </mesh>
      </group>
      {wheelPositions.map(([x, y, z, front], i) => (
        <group key={i} position={[x, y, z]} ref={(el) => void (front ? (frontPivots.current[i] = el) : null)}>
          <group ref={(el) => void (wheels.current[i] = el)}>
            <mesh castShadow rotation={[0, 0, Math.PI / 2]}>
              <cylinderGeometry args={[0.28, 0.28, 0.22, 18]} />
              <meshStandardMaterial color={palette.dark} roughness={0.9} />
            </mesh>
            <mesh rotation={[0, 0, Math.PI / 2]} position={[x > 0 ? 0.115 : -0.115, 0, 0]}>
              <cylinderGeometry args={[0.13, 0.13, 0.01, 12]} />
              <meshStandardMaterial color={palette.cream} />
            </mesh>
          </group>
        </group>
      ))}
    </RigidBody>
  );
}
