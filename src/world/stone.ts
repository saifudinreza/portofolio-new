// Organic stones: a lumpy icosphere and a material that grows moss on whatever faces up.
import * as THREE from 'three';

/** Lumpy smooth stone: an icosphere pushed in and out by a few sines, so no two sides look alike. */
export function rockGeometry(seed: number, detail = 2) {
  const g = new THREE.IcosahedronGeometry(1, detail);
  const p = g.getAttribute('position');
  const v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const k = 1 + 0.14 * Math.sin(v.x * 3.1 + seed) * Math.sin(v.y * 2.7 + seed * 2) + 0.08 * Math.sin(v.z * 5.3 + seed * 3);
    v.multiplyScalar(k);
    // flatter underneath so stones sit on the ground instead of balancing on a point
    if (v.y < 0) v.y *= 0.55;
    p.setXYZ(i, v.x, v.y, v.z);
  }
  g.computeVertexNormals();
  return g;
}

/** Stone material with a mossy green tint on upward faces; for instanced meshes. */
export function mossyStoneMaterial(moss = 0.6) {
  const material = new THREE.MeshStandardMaterial({ roughness: 0.9 });
  material.onBeforeCompile = (shader) => {
    shader.vertexShader = 'varying float vUp;\n' + shader.vertexShader.replace(
      '#include <beginnormal_vertex>',
      '#include <beginnormal_vertex>\n#ifdef USE_INSTANCING\nvUp = normalize(mat3(modelMatrix) * mat3(instanceMatrix) * objectNormal).y;\n#else\nvUp = normalize(mat3(modelMatrix) * objectNormal).y;\n#endif',
    );
    shader.fragmentShader = 'varying float vUp;\n' + shader.fragmentShader.replace(
      '#include <color_fragment>',
      `#include <color_fragment>\ndiffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.36, 0.52, 0.27), smoothstep(0.55, 0.95, vUp) * ${moss.toFixed(2)});`,
    );
  };
  return material;
}
