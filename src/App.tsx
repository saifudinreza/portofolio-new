import { Suspense, lazy, useEffect, useMemo, useState } from 'react';
import { input, resetInput, useStore } from './store';
import { Classic } from './ui/Classic';
import { InputDebug, KeyHints, Loader, TopBar, TouchControls } from './ui/Hud';
import { DriveHud } from './ui/DriveHud';
import { SpotCard } from './ui/SpotCard';
import { primaryLink } from './ui/primaryLink';

// The 3D side (three.js, R3F, drei, Rapier WASM) is the heavy part, so the canvas and world load in their
// own chunk; this main chunk is just React + the HTML UI, which paints the loader and classic view at once.
const Scene = lazy(() => import('./world/Scene'));

const DRIVE_KEYS = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'];
const INTENT_EVENTS = ['pointermove', 'pointerdown', 'keydown', 'touchstart', 'wheel'] as const;
/** Fallback for visitors who don't touch anything: start this long after the page has finished loading. */
const IDLE_START_MS = 4000;

/**
 * Start fetching and building the 3D world on the first sign of a real visitor (mouse move, touch, key,
 * wheel), or a few seconds after the page has loaded if nothing happens. The landing page (loader, top bar,
 * classic view) paints and responds straight away instead of competing with megabytes of 3D setup, and
 * nobody downloads the 1.2 MB 3D chunk just by opening the link.
 */
function useLoadIntent() {
  const [go, setGo] = useState(false);
  useEffect(() => {
    if (go) return;
    const fire = () => setGo(true);
    for (const e of INTENT_EVENTS) window.addEventListener(e, fire, { once: true, passive: true });
    let timer = 0;
    const arm = () => (timer = window.setTimeout(fire, IDLE_START_MS));
    if (document.readyState === 'complete') arm();
    else window.addEventListener('load', arm, { once: true });
    return () => {
      for (const e of INTENT_EVENTS) window.removeEventListener(e, fire);
      window.removeEventListener('load', arm);
      window.clearTimeout(timer);
    };
  }, [go]);
  return go;
}

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
  const loadScene = useLoadIntent();

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
      if (e.code === 'KeyM' && !e.repeat) useStore.getState().setMuted(!useStore.getState().muted);
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
      {loadScene && (
        <Suspense fallback={null}>
          <Scene debug={debug} />
        </Suspense>
      )}
      <TopBar />
      <DriveHud />
      <SpotCard />
      <KeyHints />
      <TouchControls />
      {debug && <InputDebug />}
      <Loader />
      {classicOpen && <Classic />}
    </>
  );
}
