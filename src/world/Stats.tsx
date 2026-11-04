import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';

type Part = { name: string; meshes: number; triangles: number };
export type FrameStats = { fps: number; calls: number; triangles: number; programs: number; geometries: number; textures: number; parts: Part[] };

/** Triangles a mesh draws, instances included (InstancedMesh.count or an instanced geometry's instanceCount). */
function trianglesOf(m: THREE.Mesh) {
  const g = m.geometry as THREE.BufferGeometry & { instanceCount?: number; isInstancedBufferGeometry?: boolean };
  const verts = g.index ? g.index.count : (g.attributes.position?.count ?? 0);
  const drawn = Math.min(verts, g.drawRange.count);
  const instances = (m as THREE.InstancedMesh).isInstancedMesh ? (m as THREE.InstancedMesh).count : g.isInstancedBufferGeometry ? (g.instanceCount ?? 1) : 1;
  return (drawn / 3) * (Number.isFinite(instances) ? instances : 1);
}

/** Meshes and triangles per named world part (the groups Experience tags with userData.statsPart). */
function breakdown(scene: THREE.Scene): Part[] {
  const parts: Part[] = [];
  scene.traverse((o) => {
    const name = o.userData.statsPart as string | undefined;
    if (!name) return;
    const part = { name, meshes: 0, triangles: 0 };
    o.traverseVisible((c) => {
      if ((c as THREE.Mesh).isMesh) {
        part.meshes++;
        part.triangles += trianglesOf(c as THREE.Mesh);
      }
    });
    parts.push(part);
  });
  return parts.sort((a, b) => b.triangles - a.triangles);
}

const k = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(n >= 100_000 ? 0 : 1)}k` : String(Math.round(n)));

/**
 * `?stats` overlay: FPS, draw calls and triangles for the whole frame (every pass, shadows and post-processing
 * included), then meshes and triangles per world part. Also on `window.__stats` for scripts. Debug only.
 */
export function Stats() {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const el = useMemo(() => {
    const pre = document.createElement('pre');
    pre.className = 'input-debug stats-overlay';
    return pre;
  }, []);
  const acc = useRef({ time: 0, frames: 0, calls: 0, triangles: 0 });

  useEffect(() => {
    document.body.appendChild(el);
    // count every render pass of a frame, not just the last one
    gl.info.autoReset = false;
    return () => {
      el.remove();
      gl.info.autoReset = true;
    };
  }, [el, gl]);

  useFrame((_, dt) => {
    const a = acc.current;
    // useFrame runs before this frame's render, so info still holds the whole previous frame
    a.calls = gl.info.render.calls;
    a.triangles = gl.info.render.triangles;
    gl.info.reset();
    a.time += dt;
    a.frames++;
    if (a.time < 1) return;
    const stats: FrameStats = { fps: a.frames / a.time, calls: a.calls, triangles: a.triangles, programs: gl.info.programs?.length ?? 0, geometries: gl.info.memory.geometries, textures: gl.info.memory.textures, parts: breakdown(scene) };
    (window as unknown as { __stats: FrameStats }).__stats = stats;
    el.textContent =
      `${stats.fps.toFixed(0)} fps · ${stats.calls} draw calls · ${k(stats.triangles)} tris · ${stats.programs} shaders\n` +
      `${stats.geometries} geometries · ${stats.textures} textures in GPU memory\n` +
      stats.parts.map((p) => `${p.name.padEnd(22)} ${String(p.meshes).padStart(4)} meshes  ${k(p.triangles).padStart(6)} tris`).join('\n');
    a.time = 0;
    a.frames = 0;
  });

  return null;
}
