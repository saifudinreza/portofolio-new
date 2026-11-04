import { Suspense, useEffect } from 'react';
import { Canvas } from '@react-three/fiber';
import { useProgress } from '@react-three/drei';
import { useStore, type Tier } from '../store';
import { Experience } from './Experience';
import { loading } from './loading';

/** Highest device-pixel ratio each quality tier renders at. */
const MAX_DPR: Record<Tier, number> = { low: 1, medium: 1.25, high: 1.75 };

/**
 * Tells the loader (in the main chunk, which never imports three) how far the world is: the scene has arrived (the
 * bar jumps to where the build starts), and three's loading manager says whether textures or fonts are still coming.
 * The build steps and the shader compile report themselves (see StagedWorld).
 */
function LoadReporter() {
  const { active } = useProgress();
  useEffect(() => loading.stage(0), []);
  useEffect(() => loading.assets(active), [active]);
  return null;
}

/**
 * The whole 3D side: canvas, world and loading progress. Lives in its own lazily loaded chunk with three.js,
 * R3F, drei and Rapier, so the first paint (loader, top bar, classic view) doesn't wait for them.
 */
export default function Scene({ debug }: { debug: boolean }) {
  const tier = useStore((s) => s.tier);
  return (
    <>
      <LoadReporter />
      <Canvas
        shadows
        dpr={[1, MAX_DPR[tier]]}
        camera={{ fov: 38, near: 0.5, far: 200, position: [30, 26, 46] }}
        gl={{ antialias: true, powerPreference: 'high-performance' }}
        onCreated={({ gl }) => {
          // The browser can take the GPU away (driver reset, too many contexts). Without this the page just freezes.
          const { setSceneError } = useStore.getState();
          gl.domElement.addEventListener('webglcontextlost', (e) => {
            e.preventDefault();
            setSceneError('context-lost');
          });
          gl.domElement.addEventListener('webglcontextrestored', () => setSceneError(null));
        }}
      >
        <Suspense fallback={null}>
          <Experience debug={debug} />
        </Suspense>
      </Canvas>
    </>
  );
}
