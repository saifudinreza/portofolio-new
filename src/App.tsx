import { Suspense, lazy, useEffect, useMemo, useState } from 'react';
import { input, resetInput, useStore } from './store';
import { Toast } from './ui/Toast';
import { CircuitHud } from './ui/CircuitHud';
import { Classic } from './ui/Classic';
import { ErrorBoundary, SceneError } from './ui/ErrorBoundary';
import { InputDebug, KeyHints, Loader, TopBar, TouchControls } from './ui/Hud';
import { DriveHud } from './ui/DriveHud';
import { BigMap } from './ui/BigMap';
import { Menu } from './ui/Menu';
import { SpotCard } from './ui/SpotCard';
import { openPrimaryLink } from './ui/primaryLink';

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
  const sceneError = useStore((s) => s.sceneError);
  const setClassic = useStore((s) => s.setClassic);
  const webgl = useMemo(() => hasWebGL(), []);
  const debug = useMemo(() => new URLSearchParams(location.search).has('debug'), []);
  const loadScene = useLoadIntent();

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      const st = useStore.getState();
      if (st.classicOpen) {
        if (e.code === 'Escape') setClassic(false);
        return;
      }
      // Menu or map open: keys belong to the panel (Tab, arrows on the volume slider, Space on a button).
      if (st.menuOpen || st.mapOpen) {
        if (e.code === 'Escape') {
          st.setMenu(null);
          st.setMap(false);
        } else if (e.code === 'KeyM' && st.mapOpen && !e.repeat) st.setMap(false);
        return;
      }
      if (DRIVE_KEYS.includes(e.code)) e.preventDefault();
      // Cmd/Ctrl/Alt combos are browser or OS shortcuts, not driving. On macOS the letter
      // in a Cmd combo never fires keyup, so adding it would leave the car driving itself.
      // Left Ctrl is the brake: let its own keydown through, it is the one key that arrives with ctrlKey set.
      if (e.code === 'ControlLeft') {
        input.keys.add(e.code);
        return;
      }
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.code === 'KeyR') input.respawnNearestRequested = true;
      if (e.code === 'KeyL' && !e.repeat) useStore.getState().setMuted(!useStore.getState().muted);
      if (e.code === 'KeyM' && !e.repeat && st.started) st.setMap(true);
      // E and Enter do the same; when a link opens, also keep Enter from pressing whichever button still has focus (like the ☰ Menu button)
      if ((e.code === 'Enter' || e.code === 'KeyE') && !e.repeat && st.started && openPrimaryLink()) e.preventDefault();
      input.keys.add(e.code);
    };
    const up = (e: KeyboardEvent) => {
      // Stop Space from "clicking" a focused HTML button (e.g. a teleport button) while braking.
      const open = useStore.getState();
      if (DRIVE_KEYS.includes(e.code) && !open.classicOpen && !open.menuOpen && !open.mapOpen) e.preventDefault();
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
        <ErrorBoundary>
          <Suspense fallback={null}>
            <Scene debug={debug} />
          </Suspense>
        </ErrorBoundary>
      )}
      <TopBar />
      <DriveHud />
      <SpotCard />
      <KeyHints />
      <TouchControls />
      <Menu />
      <BigMap />
      <Toast />
      <CircuitHud />
      {debug && <InputDebug />}
      {sceneError ? <SceneError /> : <Loader />}
      {classicOpen && <Classic />}
    </>
  );
}
