import { Suspense, lazy } from 'react';
import { Physics } from '@react-three/rapier';
import { useStore } from '../store';
import { Car } from './Car';
import { CarFx } from './CarFx';
import { Letters } from './Letters';
import { AboutArea, ContactArea, ProjectsArea, Warehouse } from './Zones';
import { Ground, HomeText, Lights, Paths, Playground } from './Environment';
import { Cliffs, Clouds, EnvLighting, Sea, Sky } from './Atmosphere';
import { Details } from './Details';
import { Trees } from './Trees';
import { Grass } from './Grass';
import { Pond } from './Pond';
import { Npcs } from './Npc';
import { ImpactParticles } from './Impacts';
import { letterColors, palette } from './layout';

// Post-processing only runs on high quality, so its library loads in its own chunk and only when needed.
const PostFx = lazy(() => import('./PostFx').then((m) => ({ default: m.PostFx })));

export function Experience({ debug = false }: { debug?: boolean }) {
  const high = useStore((s) => s.quality === 'high');
  return (
    <>
      <color attach="background" args={[palette.sky]} />
      <fog attach="fog" args={[palette.sky, 50, 115]} />
      {/* image-based reflections cost a lookup on every lit pixel (grass included), so high quality only */}
      {high && <EnvLighting />}
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
          <Pond />
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
      {high && (
        <Suspense fallback={null}>
          <PostFx />
        </Suspense>
      )}
    </>
  );
}
