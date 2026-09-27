import { Suspense, useEffect } from 'react';
import { Canvas } from '@react-three/fiber';
import { useProgress } from '@react-three/drei';
import { useStore, type Tier } from '../store';
import { Experience } from './Experience';

/** Highest device-pixel ratio each quality tier renders at. */
const MAX_DPR: Record<Tier, number> = { low: 1, medium: 1.25, high: 1.75 };

/** Mirrors three's loading progress into the store, so the loader (in the main chunk) never imports three. */
function LoadReporter() {
  const { progress, active } = useProgress();
  const setLoad = useStore((s) => s.setLoad);
  useEffect(() => setLoad(progress, !active && progress >= 100), [progress, active, setLoad]);
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
      >
        <Suspense fallback={null}>
          <Experience debug={debug} />
        </Suspense>
      </Canvas>
    </>
  );
}
