import { Suspense, lazy, useEffect, useMemo } from 'react';
import { Canvas } from '@react-three/fiber';
import { input, resetInput, useStore } from './store';
import { Classic } from './ui/Classic';
import { InputDebug, KeyHints, Loader, TopBar, TouchControls } from './ui/Hud';
import { SpotCard } from './ui/SpotCard';
import { primaryLink } from './ui/primaryLink';

// The 3D world (three.js + Rapier WASM) is the heavy part, so it loads in its own chunk
// while the loader and classic view are already usable.
const Experience = lazy(() => import('./world/Experience').then((m) => ({ default: m.Experience })));

const DRIVE_KEYS = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'];

function hasWebGL() {
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch {
    return false;
  }
}

export default function App() {
  const classicOpen = useStore((s) => s.classicOpen);
  const setClassic = useStore((s) => s.setClassic);
  const webgl = useMemo(() => hasWebGL(), []);
  const debug = useMemo(() => new URLSearchParams(location.search).has('debug'), []);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (useStore.getState().classicOpen) {
        if (e.code === 'Escape') setClassic(false);
        return;
      }
      if (DRIVE_KEYS.includes(e.code)) e.preventDefault();
      // Cmd/Ctrl/Alt combos are browser or OS shortcuts, not driving. On macOS the letter
      // in a Cmd combo never fires keyup, so adding it would leave the car driving itself.
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.code === 'KeyR') input.resetRequested = true;
      if (e.code === 'KeyH') input.honk = true;
      if (e.code === 'Enter' && useStore.getState().started) {
        const href = primaryLink(useStore.getState().spot);
        if (href) window.open(href, '_blank', 'noopener');
      }
      input.keys.add(e.code);
    };
    const up = (e: KeyboardEvent) => {
      // Stop Space from "clicking" a focused HTML button (e.g. a teleport button) while braking.
      if (DRIVE_KEYS.includes(e.code) && !useStore.getState().classicOpen) e.preventDefault();
      // Releasing Cmd can swallow the keyup of letters pressed with it, so drop everything.
      if (e.key === 'Meta') resetInput();
      input.keys.delete(e.code);
    };
    const onHidden = () => document.hidden && resetInput();
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    window.addEventListener('blur', resetInput);
    window.addEventListener('pagehide', resetInput);
    document.addEventListener('visibilitychange', onHidden);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      window.removeEventListener('blur', resetInput);
      window.removeEventListener('pagehide', resetInput);
      document.removeEventListener('visibilitychange', onHidden);
    };
  }, [setClassic]);

  if (!webgl) return <Classic webglMissing />;

  return (
    <>
      <Canvas
        shadows
        dpr={[1, 1.75]}
        camera={{ fov: 38, near: 0.5, far: 200, position: [9, 13, 19] }}
        gl={{ antialias: true, powerPreference: 'high-performance' }}
      >
        <Suspense fallback={null}>
          <Experience debug={debug} />
        </Suspense>
      </Canvas>
      <TopBar />
      <SpotCard />
      <KeyHints />
      <TouchControls />
      {debug && <InputDebug />}
      <Loader />
      {classicOpen && <Classic />}
    </>
  );
}
