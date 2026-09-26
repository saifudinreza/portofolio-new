import { useEffect, useState, type PointerEvent } from 'react';
import { useProgress } from '@react-three/drei';
import { input, readDriveInput, setTouchButton, useStore, type TouchButton } from '../store';
import { zones, type ZoneId } from '../world/layout';
import { profile } from '../data/profile';
import { carState } from '../world/carState';

export function Loader() {
  const { progress, active } = useProgress();
  const started = useStore((s) => s.started);
  const start = useStore((s) => s.start);
  const setClassic = useStore((s) => s.setClassic);
  const ready = !active && progress >= 100;
  // Also allow starting with any driving key.
  useEffect(() => {
    if (!ready || started) return;
    const onKey = (e: KeyboardEvent) => {
      if (['Enter', 'Space', 'KeyW', 'ArrowUp'].includes(e.code)) start();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [ready, started, start]);

  if (started) return null;
  return (
    <div className="loader">
      <div className="loader-box">
        <p className="eyebrow">Portfolio · 2026</p>
        <h1>{profile.name}</h1>
        <p className="lead">{profile.role}</p>
        <p className="muted">Take the car for a spin around my little world: projects, skills, and how to reach me.</p>
        <div className="bar" aria-hidden><span style={{ width: `${progress}%` }} /></div>
        <div className="actions center">
          <button className="btn primary big" disabled={!ready} onClick={start}>{ready ? 'Start driving' : `Loading ${Math.round(progress)}%`}</button>
          <button className="btn" onClick={() => setClassic(true)}>Classic view</button>
        </div>
      </div>
    </div>
  );
}

export function TopBar() {
  const teleportTo = useStore((s) => s.teleportTo);
  const setClassic = useStore((s) => s.setClassic);
  return (
    <header className="topbar">
      <div className="brand">
        <span className="logo">SR</span>
        <span className="brand-text"><b>{profile.name}</b><small>Full Stack Developer</small></span>
      </div>
      <nav className="teleports" aria-label="Jump to area">
        {(Object.keys(zones) as ZoneId[]).map((z) => (
          // Drop focus so Space/Enter while driving can't re-trigger the teleport.
          <button key={z} onClick={(e) => { e.currentTarget.blur(); teleportTo(z); }}>{zones[z].label}</button>
        ))}
      </nav>
      <button className="btn small" onClick={() => setClassic(true)}>Classic view</button>
    </header>
  );
}

export function KeyHints() {
  return (
    <div className="keyhints" aria-hidden>
      <span><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> drive</span>
      <span><kbd>Shift</kbd> boost</span>
      <span><kbd>Space</kbd> brake</span>
      <span><kbd>H</kbd> horn</span>
      <span><kbd>R</kbd> reset</span>
      <span>scroll to zoom</span>
    </div>
  );
}

/** On-screen pedals for phones and tablets. */
export function TouchControls() {
  const [touch] = useState(() => window.matchMedia('(pointer: coarse)').matches);
  if (!touch) return null;

  const hold = (button: TouchButton) => {
    const release = () => setTouchButton(button, false);
    return {
      onPointerDown: (e: PointerEvent) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        setTouchButton(button, true);
      },
      onPointerUp: release,
      onPointerCancel: release,
      // Fires whenever the browser takes the pointer away (gestures, alerts, app switch), even without pointerup.
      onLostPointerCapture: release,
      onContextMenu: (e: { preventDefault: () => void }) => e.preventDefault(),
    };
  };

  return (
    <div className="touch">
      <div className="pad-group">
        <button aria-label="Steer left" {...hold('left')}>◀</button>
        <button aria-label="Steer right" {...hold('right')}>▶</button>
      </div>
      <div className="pad-group">
        <button aria-label="Reverse" {...hold('reverse')}>▼</button>
        <button aria-label="Accelerate" className="gas" {...hold('gas')}>▲</button>
      </div>
    </div>
  );
}

/** `?debug` overlay showing the raw driving input, to catch stuck keys or pedals. */
export function InputDebug() {
  const [text, setText] = useState('');
  useEffect(() => {
    let raf = 0;
    const tick = () => {
      const pedals = (Object.keys(input.touch) as TouchButton[]).filter((b) => input.touch[b]);
      const d = readDriveInput();
      setText(`keys: ${[...input.keys].join(' ') || '-'}\ntouch: ${pedals.join(' ') || '-'}\nthrottle ${d.throttle} · steer ${d.steer}\nspeed ${carState.speed.toFixed(2)} · ${carState.grounded ? 'grounded' : 'airborne'}${carState.parked ? ' · parked' : ''}`);
      raf = requestAnimationFrame(tick);
    };
    tick();
    return () => cancelAnimationFrame(raf);
  }, []);
  return <pre className="input-debug">{text}</pre>;
}
