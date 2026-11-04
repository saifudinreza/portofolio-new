import { Suspense, lazy, useMemo, useState } from 'react';
import { Stats } from './Stats';
import { DayCycle, FOG_FAR, FOG_NEAR } from './dayCycle';
import { Rain } from './Rain';
import { Physics } from '@react-three/rapier';
import { PerformanceMonitor } from '@react-three/drei';
import { useStore } from '../store';
import { Lights } from './Environment';
import { Clouds, EnvLighting, Sea, Sky } from './Atmosphere';
import { palette } from './layout';
import { StagedWorld } from './StagedWorld';
import { P } from './StatsPart';

// Post-processing only runs on high quality, so its library loads in its own chunk and only when needed.
const PostFx = lazy(() => import('./PostFx').then((m) => ({ default: m.PostFx })));

/**
 * Auto quality: drei's PerformanceMonitor averages the frame rate and steps the tier down when it sits
 * under 48 FPS, up when it holds above 58. After a few back-and-forths it settles on the lower tier.
 */
function AutoQuality() {
  const auto = useStore((s) => s.quality === 'auto');
  const started = useStore((s) => s.started);
  const stepTier = useStore((s) => s.stepTier);
  const [settled, setSettled] = useState(false);
  if (!auto || !started || settled) return null;
  return (
    <PerformanceMonitor
      bounds={() => [48, 58]}
      flipflops={4}
      onDecline={() => stepTier(-1)}
      onIncline={() => stepTier(1)}
      onFallback={() => {
        setSettled(true);
        stepTier(-1);
      }}
    />
  );
}

export function Experience({ debug = false }: { debug?: boolean }) {
  const tier = useStore((s) => s.tier);
  const stats = useMemo(() => new URLSearchParams(window.location.search).has('stats'), []);
  return (
    <>
      <color attach="background" args={[palette.sky]} />
      <fog attach="fog" args={[palette.sky, FOG_NEAR, FOG_FAR]} />
      <AutoQuality />
      {/* first, so every other part reads this frame's time of day */}
      <DayCycle />
      {stats && <Stats />}
      {/* image-based reflections cost a lookup on every lit pixel (grass included), so not on low */}
      {tier !== 'low' && <EnvLighting />}
      <P n="Sky + clouds + sea">
        <Sky />
        <Clouds />
        <Sea />
      </P>
      {tier !== 'low' && (
        <P n="Rain">
          <Rain />
        </P>
      )}
      <Lights />
      <Suspense fallback={null}>
        <Physics gravity={[0, -25, 0]} debug={debug} timeStep={1 / 60}>
          <StagedWorld />
        </Physics>
      </Suspense>
      {tier === 'high' && (
        <Suspense fallback={null}>
          <PostFx />
        </Suspense>
      )}
    </>
  );
}
