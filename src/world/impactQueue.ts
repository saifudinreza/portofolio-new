import type { SurfaceMaterial, Vec3 } from '../ui/sound';

/** Collision bursts waiting to be spawned by <ImpactParticles />. Filled by the car's collision handler. */
export const pendingImpacts: { at: Vec3; material: SurfaceMaterial; strength: number }[] = [];

/** Queue a burst of dust and debris at a contact point. */
export function emitImpact(at: Vec3, material: SurfaceMaterial, strength: number) {
  if (pendingImpacts.length < 16) pendingImpacts.push({ at: { x: at.x, y: at.y, z: at.z }, material, strength });
}
