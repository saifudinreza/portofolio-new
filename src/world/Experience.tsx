import { Suspense, lazy, useState } from 'react';
import { Physics } from '@react-three/rapier';
import { PerformanceMonitor } from '@react-three/drei';
import { useStore } from '../store';
import { Car } from './Car';
import { CarFx } from './CarFx';
import { Letters } from './Letters';
import { AboutArea, ContactArea, ProjectsArea, Warehouse } from './Zones';
import { Ground, HomeText, Lights, Paths, Playground } from './Environment';
import { Cliffs, Clouds, EnvLighting, Sea, Sky } from './Atmosphere';
import { Details } from './Details';
import { Decor } from './Decor';
import { Trees } from './Trees';
import { Grass } from './Grass';
import { Pond } from './Pond';
import { River } from './River';
import { Bridge } from './Bridge';
import { Npcs } from './Npc';
import { ImpactParticles } from './Impacts';
import { letterColors, palette } from './layout';

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
  return (
    <>
      <color attach="background" args={[palette.sky]} />
      <fog attach="fog" args={[palette.sky, 50, 115]} />
      <AutoQuality />
      {/* image-based reflections cost a lookup on every lit pixel (grass included), so not on low */}
      {tier !== 'low' && <EnvLighting />}
      <Sky />
      <Clouds />
      <Sea />
      <Lights />
      <Suspense fallback={null}>
        <Physics gravity={[0, -25, 0]} debug={debug} timeStep={1 / 60}>
          <Ground />
          <Cliffs />
          <Paths />
          <HomeText />
          <Letters text="REZA" size={2.6} depth={0.9} position={[0, 0, -3]} colors={letterColors} gap={0.25} />
          <Playground />
          <Trees />
          <Grass />
          <Details />
          <Decor />
          <Pond />
          <River />
          <Bridge />
          <Npcs />
          <ImpactParticles />
          <ProjectsArea />
          <Warehouse />
          <AboutArea />
          <ContactArea />
          <Car />
          <CarFx />
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
