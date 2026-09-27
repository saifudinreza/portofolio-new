/** Live car state, read by the sun light, the car visuals/effects and the mini-map without React re-renders. */
export const carState = {
  x: 0,
  y: 0,
  z: 0,
  yaw: 0,
  speed: 0,
  /** sideways slide speed, for skid marks */
  latSpeed: 0,
  /** vertical speed, for the visual suspension */
  vy: 0,
  throttle: 0,
  brake: false,
  boost: false,
  grounded: false,
  parked: false,
  mass: 0,
  fps: 0,
};
if (typeof window !== 'undefined') (window as unknown as { __car: typeof carState }).__car = carState;
