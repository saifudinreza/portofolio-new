import { Suspense, useEffect, useState, type ReactNode } from 'react';
import { useThree } from '@react-three/fiber';
import { P } from './StatsPart';
import { loading } from './loading';
import { Car } from './Car';
import { CarFx } from './CarFx';
import { Letters } from './Letters';
import { Circuit } from './Circuit';
import { AboutArea, ContactArea, ProjectsArea, Warehouse } from './Zones';
import { ProjectMonuments } from './Monuments';
import { ExperienceArea } from './ExperienceArea';
import { Scenery } from './Scenery';
import { Collectibles } from './Collectibles';
import { Ground, HomeText, Paths, Playground } from './Environment';
import { Cliffs } from './Atmosphere';
import { Details } from './Details';
import { Decor } from './Decor';
import { Trees } from './Trees';
import { Grass } from './Grass';
import { Pond } from './Pond';
import { River } from './River';
import { RiverProps } from './RiverProps';
import { Waterfall } from './Waterfall';
import { Bridge } from './Bridge';
import { Npcs } from './Npc';
import { ImpactParticles } from './Impacts';
import { letterColors } from './layout';

/**
 * The world, in groups that are mounted one after another. Building everything in one go froze the page for a
 * second or two (every group scatters thousands of objects when it mounts); one group per step lets the loading
 * screen keep moving in between, and each step reports its progress. The last step is the car, so the world is
 * playable only once everything else is in place. Each group has its own Suspense boundary, so one that is still
 * waiting for a font does not hide the groups that are done.
 */
const STAGES: (() => ReactNode)[] = [
  // 0: the island itself
  () => (
  <>
    <P n="Ground, cliffs, roads">
      <Ground />
      <Cliffs />
      <Paths />
      <HomeText />
    </P>
    <P n="Playground + circuit">
      <Playground />
      <Circuit />
    </P>
  </>
  ),
  // 1: the heaviest scatter
  () => (
  <>
    <P n="Trees"><Trees /></P>
    <P n="Grass"><Grass /></P>
  </>
  ),
  // 2
  () => (
  <>
    <P n="Details"><Details /></P>
    <P n="Decor"><Decor /></P>
    <P n="Scenery"><Scenery /></P>
    <P n="Collectibles"><Collectibles /></P>
  </>
  ),
  // 3: water
  () => (
  <>
    <P n="Pond"><Pond /></P>
    <P n="River + bridge">
      <River />
      <RiverProps />
      <Bridge />
    </P>
    <P n="Waterfall"><Waterfall /></P>
  </>
  ),
  // 4: the areas you drive to, and the letters
  () => (
  <>
    <P n="Zones">
      <ImpactParticles />
      <ProjectsArea />
      <Warehouse />
      <AboutArea />
      <ExperienceArea />
      <ContactArea />
    </P>
    <P n="Letters">
      <Letters text="REZA" size={2.6} depth={0.9} position={[0, 0, -3]} colors={letterColors} gap={0.25} />
    </P>
    <P n="Project monuments"><ProjectMonuments /></P>
  </>
  ),
  // 5: people
  () => <P n="People"><Npcs /></P>,
  // 6: the car
  () => (
    <P n="Car">
      <Car />
      <CarFx />
    </P>
  ),
];

/** Wait until the browser has painted (so the loader got a frame) and then one more tick. */
const nextTurn = (fn: () => void) => {
  let timer = 0;
  const raf = requestAnimationFrame(() => {
    timer = window.setTimeout(fn, 16);
  });
  return () => {
    cancelAnimationFrame(raf);
    window.clearTimeout(timer);
  };
};

export function StagedWorld() {
  const [built, setBuilt] = useState(1);
  const { gl, scene, camera } = useThree();

  // report each step, then mount the next one after a painted frame
  useEffect(() => {
    loading.stage(built);
    if (built >= STAGES.length) return;
    return nextTurn(() => setBuilt((n) => n + 1));
  }, [built]);

  // once everything is mounted, compile every shader before showing the world (in the background, without a hitch)
  useEffect(() => {
    if (built < STAGES.length) return;
    let alive = true;
    const finish = () => alive && loading.warmed();
    // let the last group commit first
    const cancel = nextTurn(() => {
      const compile = (gl as unknown as { compileAsync?: (s: unknown, c: unknown) => Promise<unknown> }).compileAsync;
      if (!compile) {
        gl.compile(scene, camera);
        finish();
        return;
      }
      compile.call(gl, scene, camera).then(finish, finish);
    });
    return () => {
      alive = false;
      cancel();
    };
  }, [built, gl, scene, camera]);

  return (
    <>
      {STAGES.slice(0, built).map((Stage, i) => (
        <Suspense key={i} fallback={null}>
          <Stage />
        </Suspense>
      ))}
    </>
  );
}
