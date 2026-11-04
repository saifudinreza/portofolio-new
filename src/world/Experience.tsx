import { Suspense, lazy, useMemo, useState, type ReactNode } from 'react';
import { Stats } from './Stats';
import { DayCycle, FOG_FAR, FOG_NEAR } from './dayCycle';
import { Rain } from './Rain';
import { Physics } from '@react-three/rapier';
import { PerformanceMonitor } from '@react-three/drei';
import { useStore } from '../store';
import { Car } from './Car';
import { CarFx } from './CarFx';
import { Letters } from './Letters';
import { Circuit } from './Circuit';
import { AboutArea, ContactArea, ProjectsArea, Warehouse } from './Zones';
import { ProjectMonuments } from './Monuments';
import { ExperienceArea } from './ExperienceArea';
import { Scenery } from './Scenery';
import { Ground, HomeText, Lights, Paths, Playground } from './Environment';
import { Cliffs, Clouds, EnvLighting, Sea, Sky } from './Atmosphere';
import { Details } from './Details';
import { Decor } from './Decor';
import { Trees } from './Trees';
import { Grass } from './Grass';
import { Pond } from './Pond';
import { River } from './River';
import { RiverProps } from './RiverProps';
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

/** Names a part of the world for the `?stats` breakdown. Otherwise just an empty group. */
function P({ n, children }: { n: string; children: ReactNode }) {
  return <group userData={{ statsPart: n }}>{children}</group>;
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
          <P n="Ground, cliffs, roads">
            <Ground />
            <Cliffs />
            <Paths />
            <HomeText />
          </P>
          <P n="Letters">
            <Letters text="REZA" size={2.6} depth={0.9} position={[0, 0, -3]} colors={letterColors} gap={0.25} />
          </P>
          <P n="Playground + circuit">
            <Playground />
            <Circuit />
          </P>
          <P n="Trees"><Trees /></P>
          <P n="Grass"><Grass /></P>
          <P n="Details"><Details /></P>
          <P n="Decor"><Decor /></P>
          <P n="Scenery"><Scenery /></P>
          <P n="Pond"><Pond /></P>
          <P n="River + bridge">
            <River />
            <RiverProps />
            <Bridge />
          </P>
          <P n="People"><Npcs /></P>
          <P n="Zones">
            <ImpactParticles />
            <ProjectsArea />
            <Warehouse />
            <AboutArea />
            <ExperienceArea />
            <ContactArea />
          </P>
          <P n="Project monuments"><ProjectMonuments /></P>
          <P n="Car">
            <Car />
            <CarFx />
          </P>
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
