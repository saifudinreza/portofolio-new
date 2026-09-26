/** Live car position, read by the sun light and the mini-map without React re-renders. */
export const carState = { x: 0, y: 0, z: 0, yaw: 0, speed: 0, grounded: false, parked: false, mass: 0, fps: 0 };
if (typeof window !== 'undefined') (window as unknown as { __car: typeof carState }).__car = carState;
