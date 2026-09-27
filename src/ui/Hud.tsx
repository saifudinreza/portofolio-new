import { useEffect, useRef, useState, type PointerEvent } from 'react';
import { input, readDriveInput, setTouchButton, useStore, type Quality, type TouchButton } from '../store';
import { zones, type ZoneId } from '../world/layout';
import { profile } from '../data/profile';
import { carState } from '../world/carState';
import { reducedMotion, touchUi } from './device';

const TIPS = [
  'W A S D or the arrow keys to drive, Shift to boost',
  'Park on a glowing pad to open a project',
  'Knock over the REZA letters and the skill crates',
  'Hold H for the horn, M to mute',
  'Scroll to zoom the camera in and out',
  'Short on time? Classic view has everything on one page',
];
const TOUCH_TIPS = ['Use the joystick to steer and drive', 'Park on a glowing pad to open a project', 'Tap the bolt to boost'];

export function Loader() {
  const progress = useStore((s) => s.loadProgress);
  const ready = useStore((s) => s.loadDone);
  const started = useStore((s) => s.started);
  const start = useStore((s) => s.start);
  const setClassic = useStore((s) => s.setClassic);
  const [tip, setTip] = useState(0);
  const [gone, setGone] = useState(false);
  const tips = touchUi() ? TOUCH_TIPS : TIPS;

  // Also allow starting with any driving key.
  useEffect(() => {
    if (!ready || started) return;
    const onKey = (e: KeyboardEvent) => {
      if (['Enter', 'Space', 'KeyW', 'ArrowUp'].includes(e.code)) start();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [ready, started, start]);

  useEffect(() => {
    if (started) return;
    const id = window.setInterval(() => setTip((t) => (t + 1) % tips.length), 3200);
    return () => window.clearInterval(id);
  }, [started, tips.length]);

  // Fade out instead of vanishing, then unmount.
  useEffect(() => {
    if (!started) return;
    const id = window.setTimeout(() => setGone(true), reducedMotion() ? 0 : 450);
    return () => window.clearTimeout(id);
  }, [started]);

  if (gone) return null;
  return (
    <div className={`loader${started ? ' leaving' : ''}${ready ? ' ready' : ''}`}>
      <div className="loader-box">
        <p className="eyebrow">Portfolio · 2026</p>
        <h1>{profile.name}</h1>
        <p className="lead">{profile.role}</p>
        <p className="muted">Take the car for a spin around my little world: projects, skills, and how to reach me.</p>
        <div className={`bar${progress === 0 && !ready ? ' indeterminate' : ''}`} role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress)} aria-label="Loading the 3D world">
          <span style={{ width: `${ready ? 100 : progress}%` }} />
        </div>
        <p className="tip" key={tip} aria-live="polite"><b>Tip</b> {tips[tip]}</p>
        <div className="actions center">
          <button className="btn primary big" disabled={!ready || started} onClick={start}>{ready ? 'Start driving' : `Loading ${Math.round(progress)}%`}</button>
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
      <QualitySelect />
      <SoundControl />
      <button className="btn small" onClick={() => setClassic(true)}>Classic view</button>
    </header>
  );
}

const TIER_LABEL = { low: 'Low', medium: 'Medium', high: 'High' } as const;

/** Graphics quality: Auto (adapts to the frame rate) or a fixed Low / Medium / High. Remembered in localStorage. */
function QualitySelect() {
  const quality = useStore((s) => s.quality);
  const tier = useStore((s) => s.tier);
  const setQuality = useStore((s) => s.setQuality);
  return (
    <label className="quality" title="Graphics quality">
      <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden>
        <path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
        <circle cx="16" cy="6" r="2.2" fill="none" stroke="currentColor" strokeWidth="2" />
        <circle cx="10" cy="12" r="2.2" fill="none" stroke="currentColor" strokeWidth="2" />
        <circle cx="18" cy="18" r="2.2" fill="none" stroke="currentColor" strokeWidth="2" />
      </svg>
      <span className="sr-only">Graphics quality</span>
      <select
        value={quality}
        onChange={(e) => {
          setQuality(e.currentTarget.value as Quality);
          e.currentTarget.blur();
        }}
      >
        <option value="auto">Auto ({TIER_LABEL[tier]})</option>
        <option value="high">High</option>
        <option value="medium">Medium</option>
        <option value="low">Low</option>
      </select>
    </label>
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
  // keyboard hints make no sense next to on-screen controls
  if (touchUi()) return null;
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

// ---------- touch ----------

const TOUCH_MODE_KEY = 'zare-world-touch';
type TouchMode = 'joystick' | 'buttons';

function loadTouchMode(): TouchMode {
  try {
    return localStorage.getItem(TOUCH_MODE_KEY) === 'buttons' ? 'buttons' : 'joystick';
  } catch {
    return 'joystick';
  }
}

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

const JOY_RADIUS = 46;
const JOY_DEAD = 0.14;

/** Thumb stick: x steers, y drives forward/back, both analogue. Springs back to centre on release. */
function Joystick() {
  const knob = useRef<HTMLSpanElement>(null);
  const origin = useRef({ x: 0, y: 0 });

  const move = (clientX: number, clientY: number) => {
    let dx = (clientX - origin.current.x) / JOY_RADIUS;
    let dy = (clientY - origin.current.y) / JOY_RADIUS;
    const len = Math.hypot(dx, dy);
    if (len > 1) {
      dx /= len;
      dy /= len;
    }
    const dead = (v: number) => (Math.abs(v) < JOY_DEAD ? 0 : (v - Math.sign(v) * JOY_DEAD) / (1 - JOY_DEAD));
    input.joy.x = dead(dx);
    input.joy.y = -dead(dy);
    if (knob.current) knob.current.style.transform = `translate(${dx * JOY_RADIUS}px, ${dy * JOY_RADIUS}px)`;
  };
  const release = () => {
    input.joy.x = input.joy.y = 0;
    if (knob.current) knob.current.style.transform = '';
  };

  return (
    <div
      className="joystick"
      role="application"
      aria-label="Joystick: drag to steer and drive"
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        const r = e.currentTarget.getBoundingClientRect();
        origin.current = { x: r.left + r.width / 2, y: r.top + r.height / 2 };
        move(e.clientX, e.clientY);
      }}
      onPointerMove={(e) => e.buttons && move(e.clientX, e.clientY)}
      onPointerUp={release}
      onPointerCancel={release}
      onLostPointerCapture={release}
      onContextMenu={(e) => e.preventDefault()}
    >
      <span ref={knob} className="joystick-knob" />
    </div>
  );
}

const HornIcon = () => (
  <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden>
    <path d="M3 10v4h3l7 4V6l-7 4z" fill="currentColor" />
    <path d="M16 9a4 4 0 0 1 0 6M19 7a7 7 0 0 1 0 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" fill="none" />
  </svg>
);
const BoostIcon = () => (
  <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden><path d="M13 2 4 14h6l-1 8 9-12h-6z" fill="currentColor" /></svg>
);

/** On-screen controls for phones and tablets: a joystick (default) or arrow buttons, plus boost and horn. */
export function TouchControls() {
  const [touch] = useState(touchUi);
  const [mode, setMode] = useState(loadTouchMode);
  const started = useStore((s) => s.started);
  const classicOpen = useStore((s) => s.classicOpen);
  if (!touch || !started || classicOpen) return null;

  const switchMode = () => {
    const next: TouchMode = mode === 'joystick' ? 'buttons' : 'joystick';
    input.joy.x = input.joy.y = 0;
    setMode(next);
    try {
      localStorage.setItem(TOUCH_MODE_KEY, next);
    } catch {
      // not remembered
    }
  };

  return (
    <div className={`touch mode-${mode}`}>
      <div className="pad-group left">
        {mode === 'joystick' ? (
          <Joystick />
        ) : (
          <>
            <button aria-label="Steer left" {...hold('left')}>◀</button>
            <button aria-label="Steer right" {...hold('right')}>▶</button>
          </>
        )}
      </div>
      <button className="touch-mode" onClick={switchMode} aria-label={mode === 'joystick' ? 'Use arrow buttons' : 'Use joystick'}>
        {mode === 'joystick' ? 'Buttons' : 'Stick'}
      </button>
      <div className="pad-group right">
        <div className="pad-extras">
          <button aria-label="Horn" className="round horn" {...hold('horn')}><HornIcon /></button>
          <button aria-label="Boost" className="round boost" {...hold('boost')}><BoostIcon /></button>
        </div>
        {mode === 'buttons' && (
          <div className="pedals">
            <button aria-label="Reverse" {...hold('reverse')}>▼</button>
            <button aria-label="Accelerate" className="gas" {...hold('gas')}>▲</button>
          </div>
        )}
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
      setText(`keys: ${[...input.keys].join(' ') || '-'}\ntouch: ${pedals.join(' ') || '-'} · joy ${input.joy.x.toFixed(2)},${input.joy.y.toFixed(2)}\nthrottle ${d.throttle.toFixed(2)} · steer ${d.steer.toFixed(2)}\nspeed ${carState.speed.toFixed(2)} · ${carState.grounded ? 'grounded' : 'airborne'}${carState.parked ? ' · parked' : ''}
${Math.round(carState.fps)} fps · quality ${useStore.getState().quality} → ${useStore.getState().tier}`);
      raf = requestAnimationFrame(tick);
    };
    tick();
    return () => cancelAnimationFrame(raf);
  }, []);
  return <pre className="input-debug">{text}</pre>;
}
