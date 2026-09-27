import { Suspense } from 'react';
import { Physics } from '@react-three/rapier';
import { Car } from './Car';
import { Letters } from './Letters';
import { AboutArea, ContactArea, ProjectsArea, Warehouse } from './Zones';
import { Ground, HomeText, Lights, Paths, Playground } from './Environment';
import { Trees } from './Trees';
import { Grass } from './Grass';
import { Pond } from './Pond';
import { letterColors, palette } from './layout';

export function Experience({ debug = false }: { debug?: boolean }) {
  return (
    <>
      <color attach="background" args={[palette.sky]} />
      <fog attach="fog" args={[palette.sky, 45, 95]} />
      <Lights />
      <Suspense fallback={null}>
        <Physics gravity={[0, -25, 0]} debug={debug} timeStep={1 / 60}>
          <Ground />
          <Paths />
          <HomeText />
          <Letters text="REZA" size={2.6} depth={0.9} position={[0, 0, -3]} colors={letterColors} gap={0.25} />
          <Playground />
          <Trees />
          <Grass />
          <Pond />
          <ProjectsArea />
          <Warehouse />
          <AboutArea />
          <ContactArea />
          <Car />
        </Physics>
      </Suspense>
    </>
  );
}
