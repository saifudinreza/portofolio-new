import type { Spot } from '../store';
import { profile, projects } from '../data/profile';

/** The link opened when the visitor presses Enter while parked on a spot. */
export function primaryLink(spot: Spot | null): string | null {
  if (!spot) return null;
  if (spot.kind === 'project') return projects.find((p) => p.id === spot.id)?.links[0]?.href ?? null;
  if (spot.kind === 'contact') return profile.links[spot.id];
  return null;
}
