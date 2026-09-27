/** Touch UI on coarse pointers, or anywhere with ?touch in the URL (handy for testing on a laptop). */
export const touchUi = () =>
  typeof window !== 'undefined' && (window.matchMedia('(pointer: coarse)').matches || new URLSearchParams(location.search).has('touch'));

/** The player asked the OS for less motion: no camera shake, no orbiting intro, no sliding UI. */
export const reducedMotion = () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Short buzz on phones that support it (ignored everywhere else). */
export function vibrate(ms: number) {
  try {
    if (touchUi()) navigator.vibrate?.(ms);
  } catch {
    // some browsers throw when vibration is blocked; it's only a nicety
  }
}
