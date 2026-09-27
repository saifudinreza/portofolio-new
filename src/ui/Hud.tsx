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
      <QualityToggle />
      <SoundControl />
      <button className="btn small" onClick={() => setClassic(true)}>Classic view</button>
    </header>
  );
}

/** HD / Lite switch for post-processing and the heavier effects; remembered in localStorage. */
function QualityToggle() {
  const quality = useStore((s) => s.quality);
  const setQuality = useStore((s) => s.setQuality);
  const high = quality === 'high';
  return (
    <button
      className="quality-toggle"
      aria-pressed={high}
      title={high ? 'High quality: switch to lite for speed' : 'Lite quality: switch to HD visuals'}
      onClick={(e) => {
        e.currentTarget.blur();
        setQuality(high ? 'low' : 'high');
      }}
    >
      {high ? 'HD' : 'Lite'}
    </button>
  );
}

/** Mute button plus a volume slider (slider hidden on small screens). Both are remembered in localStorage. */
function SoundControl() {
  const muted = useStore((s) => s.muted);
  const volume = useStore((s) => s.volume);
  const setMuted = useStore((s) => s.setMuted);
  const setVolume = useStore((s) => s.setVolume);
  const silent = muted || volume === 0;
  return (
    <div className="sound">
      <button
        className="sound-toggle"
        aria-label={silent ? 'Unmute sound' : 'Mute sound'}
        aria-pressed={silent}
        title={silent ? 'Unmute (M)' : 'Mute (M)'}
        onClick={(e) => {
          e.currentTarget.blur();
          if (volume === 0) setVolume(0.7);
          else setMuted(!muted);
        }}
      >
        <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden>
          <path d="M4 9h4l5-4v14l-5-4H4z" fill="currentColor" />
          {silent ? (
            <path d="M16 9l5 6M21 9l-5 6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" fill="none" />
          ) : (
            <path d="M16 8.5a5 5 0 0 1 0 7M18.5 6a8.5 8.5 0 0 1 0 12" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" fill="none" />
          )}
        </svg>
      </button>
      <input
        type="range"
        min={0}
        max={1}
        step={0.05}
        value={muted ? 0 : volume}
        aria-label="Volume"
        onChange={(e) => setVolume(Number(e.currentTarget.value))}
        // don't keep focus, or arrow keys meant for driving would move the slider
        onPointerUp={(e) => e.currentTarget.blur()}
      />
    </div>
  );
}

export function KeyHints() {
  return (
    <div className="keyhints" aria-hidden>
      <span><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> drive</span>
      <span><kbd>Shift</kbd> boost</span>
      <span><kbd>Space</kbd> brake</span>
      <span><kbd>H</kbd> hold horn</span>
      <span><kbd>M</kbd> mute</span>
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
      <button aria-label="Horn" className="horn" {...hold('horn')}>
        <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden>
          <path d="M3 10v4h3l7 4V6l-7 4z" fill="currentColor" />
          <path d="M16 9a4 4 0 0 1 0 6M19 7a7 7 0 0 1 0 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" fill="none" />
        </svg>
      </button>
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
