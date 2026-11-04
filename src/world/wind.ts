import * as THREE from 'three';

/**
 * One wind for the whole island: grass, tree sway and the drifting leaves all read these uniforms.
 * Mutate `.value`, never replace the objects, or the shaders that already hold them stop following.
 */
export const windUniforms = {
  uWindDir: { value: new THREE.Vector2(0.89, 0.45) },
  /** 1 is the usual breeze; turn it up to see everything sway harder at once */
  uWindStrength: { value: 1 },
};

// `?debug`: try `__wind.uWindStrength.value = 3` in the console.
if (typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('debug')) {
  (window as unknown as { __wind: typeof windUniforms }).__wind = windUniforms;
}
