import { useStore, type Spot } from '../store';
import { profile, projects } from '../data/profile';
import { unlock } from '../game/achievements';

/** The link opened when the visitor presses Enter while parked on a spot. */
export function primaryLink(spot: Spot | null): string | null {
  if (!spot) return null;
  if (spot.kind === 'project') return projects.find((p) => p.id === spot.id)?.links[0]?.href ?? null;
  if (spot.kind === 'contact') return profile.links[spot.id];
  return null;
}

/**
 * Opens the link of the spot the car is parked on (Enter, or Y on a gamepad). Returns false when there is nothing
 * to open. Browsers may block the new tab when it comes from a gamepad, since a pad press is not a user gesture.
 */
export function openPrimaryLink(): boolean {
  const spot = useStore.getState().spot;
  const href = primaryLink(spot);
  if (!href) return false;
  if (spot?.kind === 'project') unlock('open-live');
  window.open(href, '_blank', 'noopener');
  return true;
}
