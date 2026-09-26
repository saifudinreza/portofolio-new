import { useMemo } from 'react';
import { useLoader } from '@react-three/fiber';
import { RigidBody, CuboidCollider } from '@react-three/rapier';
import * as THREE from 'three';
import { FontLoader, type Font } from 'three/examples/jsm/loaders/FontLoader.js';
import { TextGeometry } from 'three/examples/jsm/geometries/TextGeometry.js';

const FONT_URL = '/fonts/archivo-black.typeface.json';

type Props = {
  text: string;
  size: number;
  depth: number;
  position: [number, number, number];
  colors: string[];
  gap?: number;
};

/** Big extruded letters standing on the ground. Each one is a physics body you can knock over. */
export function Letters({ text, size, depth, position, colors, gap = 0.12 }: Props) {
  const font = useLoader(FontLoader, FONT_URL) as Font;

  const glyphs = useMemo(() => {
    const out: { geo: THREE.BufferGeometry; w: number; h: number }[] = [];
    for (const ch of text) {
      if (ch === ' ') {
        out.push({ geo: new THREE.BufferGeometry(), w: size * 0.4, h: 0 });
        continue;
      }
      const geo = new TextGeometry(ch, { font, size, depth, curveSegments: 6, bevelEnabled: true, bevelThickness: 0.03, bevelSize: 0.02, bevelSegments: 2 });
      geo.computeBoundingBox();
      const bb = geo.boundingBox!;
      // Centre each glyph on its own origin so the collider matches.
      geo.translate(-(bb.min.x + bb.max.x) / 2, -bb.min.y, -(bb.min.z + bb.max.z) / 2);
      out.push({ geo, w: bb.max.x - bb.min.x, h: bb.max.y - bb.min.y });
    }
    return out;
  }, [font, text, size, depth]);

  const total = glyphs.reduce((sum, g) => sum + g.w, 0) + gap * (glyphs.length - 1);
  let cursor = -total / 2;

  return (
    <group position={position}>
      {glyphs.map((g, i) => {
        const x = cursor + g.w / 2;
        cursor += g.w + gap;
        if (g.h === 0) return null;
        return (
          <RigidBody key={i} position={[x, 0.01, 0]} colliders={false} linearDamping={0.3} angularDamping={0.4}>
            <CuboidCollider args={[g.w / 2, g.h / 2, depth / 2 + 0.03]} position={[0, g.h / 2, 0]} mass={0.5} friction={0.9} />
            <mesh geometry={g.geo} castShadow receiveShadow>
              <meshStandardMaterial color={colors[i % colors.length]} roughness={0.5} />
            </mesh>
          </RigidBody>
        );
      })}
    </group>
  );
}
