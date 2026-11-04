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
  'Space to jump, B to brake, hold H for the horn, L to mute',
  'Scroll to zoom the camera in and out',
  'Short on time? Classic view has everything on one page',
];
const TOUCH_TIPS = ['Use the joystick to steer and drive', 'Park on a glowing pad to open a project', 'Tap the bolt to boost, the arrow to jump'];

/** After this long without the 3D world being ready, the loader says it is slow. */
const SLOW_LOAD_MS = 30_000;

/** While the 3D chunk downloads there is no real progress to show: the bar creeps towards this, and never completes by itself. */
const DOWNLOAD_CAP = 30;
const DOWNLOAD_HALF_LIFE_MS = 5000;

export function Loader() {
  const ready = useStore((s) => s.loadDone);
  const started = useStore((s) => s.started);
  const label = useStore((s) => s.loadLabel);
  const start = useStore((s) => s.start);
  const setClassic = useStore((s) => s.setClassic);
  const [tip, setTip] = useState(0);
  const [gone, setGone] = useState(false);
  const [slow, setSlow] = useState(false);
  const tips = touchUi() ? TOUCH_TIPS : TIPS;
  const fill = useRef<HTMLSpanElement>(null);
  const jeep = useRef<HTMLDivElement>(null);
  const track = useRef<HTMLDivElement>(null);
  const percent = useRef<HTMLSpanElement>(null);
  const bar = useRef<HTMLDivElement>(null);

  // The bar is drawn from here, not from React state: every frame it eases towards the real progress (so it moves
  // smoothly, never jumps back, and never gets ahead of what has really loaded), by transform only, which keeps
  // moving even while the main thread is busy building the world.
  useEffect(() => {
    let raf = 0;
    let shown = 0;
    let last = performance.now();
    const t0 = last;
    let lastText = -1;
    const frame = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.1);
      last = now;
      const st = useStore.getState();
      const creep = DOWNLOAD_CAP * (1 - Math.pow(0.5, (now - t0) / DOWNLOAD_HALF_LIFE_MS));
      const target = st.loadDone ? 100 : st.loadProgress > 0 ? st.loadProgress : creep;
      shown += Math.max(0, target - shown) * (1 - Math.exp(-(st.loadDone ? 9 : 3.5) * dt));
      if (target - shown < 0.05) shown = target;
      if (fill.current) fill.current.style.transform = `scaleX(${shown / 100})`;
      if (jeep.current && track.current) jeep.current.style.transform = `translate3d(${((track.current.clientWidth - jeep.current.clientWidth) * shown) / 100}px, 0, 0)`;
      const whole = Math.floor(shown);
      if (whole !== lastText) {
        lastText = whole;
        if (percent.current) percent.current.textContent = `${whole}%`;
        bar.current?.setAttribute('aria-valuenow', String(whole));
      }
      if (shown < 100) raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, []);

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

  // A slow connection or a stalled download: say so and point at the classic view instead of leaving a silent bar.
  useEffect(() => {
    if (ready || started) return;
    const id = window.setTimeout(() => setSlow(true), SLOW_LOAD_MS);
    return () => window.clearTimeout(id);
  }, [ready, started]);

  // Fade out instead of vanishing, then unmount.
  useEffect(() => {
    if (!started) return;
    const id = window.setTimeout(() => setGone(true), reducedMotion() ? 0 : 450);
    return () => window.clearTimeout(id);
  }, [started]);

  if (gone) return null;
  const stage = ready ? 'Ready' : label || 'Fetching the world';
  return (
    <div className={`loader${started ? ' leaving' : ''}${ready ? ' ready' : ''}`}>
      {/* the game-style backdrop: sun, drifting clouds and a far island; it fades away when the real world is ready */}
      <div className="loader-art" aria-hidden="true">
        <div className="art-sun" />
        <div className="art-cloud c1" />
        <div className="art-cloud c2" />
        <div className="art-cloud c3" />
        <svg className="art-island" viewBox="0 0 800 220" preserveAspectRatio="xMidYMax slice">
          <path d="M0 220V150c60-34 120-44 190-18 70-52 150-62 230-14 60-26 130-24 190 6 60-30 130-22 190 12V220z" fill="#e8b865" />
          <path d="M0 220V176c80-26 150-22 230 0 80-30 170-30 250-2 80-22 220-22 320 4V220z" fill="#d89a4a" />
          <path d="M0 220V196c120-16 240-10 360 4 120-14 280-16 440-2V220z" fill="#1f8c93" opacity="0.85" />
        </svg>
      </div>
      <div className="loader-box">
        <p className="eyebrow">Portfolio · 2026</p>
        <h1>{profile.name}</h1>
        <p className="lead">{profile.role}</p>
        <p className="muted">Take the car for a spin around my little world: projects, skills, and how to reach me.</p>
        <div className="road" ref={track}>
          <div className="jeep" ref={jeep} aria-hidden="true">
            <svg viewBox="0 0 56 30" width="56" height="30">
              <rect x="4" y="12" width="46" height="11" rx="4" fill="#f26b4f" stroke="#1f3864" strokeWidth="2" />
              <path d="M14 12l5-8h16l6 8z" fill="#fff6e6" stroke="#1f3864" strokeWidth="2" strokeLinejoin="round" />
              <circle cx="14" cy="24" r="5" fill="#1f3864" />
              <circle cx="40" cy="24" r="5" fill="#1f3864" />
              <circle cx="14" cy="24" r="1.8" fill="#fff6e6" />
              <circle cx="40" cy="24" r="1.8" fill="#fff6e6" />
            </svg>
          </div>
          <div className="bar" ref={bar} role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={0} aria-label="Loading the 3D world">
            <span ref={fill} />
          </div>
        </div>
        <p className="stage" role="status" aria-live="polite">
          <span className="stage-pct" ref={percent}>0%</span>
          <span className="stage-label">{stage}</span>
        </p>
        {slow && !ready ? (
          <p className="tip" role="status"><b>Still loading…</b> This is taking longer than usual. You can wait, reload, or use the classic view.</p>
        ) : ready ? (
          <p className="tip press"><b>Ready</b> Press Enter or tap Start to drive</p>
        ) : (
          <p className="tip" key={tip} aria-live="polite"><b>Tip</b> {tips[tip]}</p>
        )}
        <div className="actions center">
          <button className="btn primary big" disabled={!ready || started} onClick={start}>{ready ? 'Start driving' : 'Loading…'}</button>
          <button className="btn" onClick={() => setClassic(true)}>Classic view</button>
        </div>
      </div>
    </div>
  );
}

export function TopBar() {
  const teleportTo = useStore((s) => s.teleportTo);
  const setClassic = useStore((s) => s.setClassic);
  const setMenu = useStore((s) => s.setMenu);
  return (
    <header className="topbar">
      <div className="brand">
        <span className="logo">SR</span>
        <span className="brand-text"><b>{profile.name}</b><small>Full Stack Developer</small></span>
      </div>
      <nav className="teleports" aria-label="Jump to area">
        {(Object.keys(zones) as ZoneId[]).map((z) => (
          // Drop focus so Space/Enter while driving can't re-trigger the teleport.
          <button key={z} onClick={(e) => { e.currentTarget.blur(); teleportTo(z); }}>{zones[z].short ? (<><span className="zone-long">{zones[z].label}</span><span className="zone-short">{zones[z].short}</span></>) : zones[z].label}</button>
        ))}
      </nav>
      <div className="sound compact"><MuteButton /></div>
      <button className="btn small" aria-haspopup="dialog" onClick={() => setMenu('options')}>☰ Menu</button>
      <button className="btn small" onClick={() => setClassic(true)}>Classic view</button>
    </header>
  );
}

const TIER_LABEL = { low: 'Low', medium: 'Medium', high: 'High' } as const;

/** Graphics quality: Auto (adapts to the frame rate) or a fixed Low / Medium / High. Remembered in localStorage. */
export function QualitySelect() {
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

/** Mute toggle: stays in the top bar, the volume slider lives in the menu. */
function MuteButton() {
  const muted = useStore((s) => s.muted);
  const volume = useStore((s) => s.volume);
  const setMuted = useStore((s) => s.setMuted);
  const setVolume = useStore((s) => s.setVolume);
  const silent = muted || volume === 0;
  return (
    <button
      className="sound-toggle"
      aria-label={silent ? 'Unmute sound' : 'Mute sound'}
      aria-pressed={silent}
      title={silent ? 'Unmute (L)' : 'Mute (L)'}
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
  );
}

/** Mute button plus a volume slider. Both are remembered in localStorage. */
export function SoundControl() {
  const muted = useStore((s) => s.muted);
  const volume = useStore((s) => s.volume);
  const setVolume = useStore((s) => s.setVolume);
  return (
    <div className="sound">
      <MuteButton />
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

const HINT_DRIVE_SECONDS = 10;

/** A short pointer to the menu that fades away once the player has driven for a while (or opened the menu). */
export function KeyHints() {
  const started = useStore((s) => s.started);
  const menuOpen = useStore((s) => s.menuOpen);
  const [gone, setGone] = useState(false);

  useEffect(() => {
    if (!started || gone) return;
    let driven = 0;
    const id = window.setInterval(() => {
      if (Math.abs(carState.speed) > 0.5) driven += 0.5;
      if (driven >= HINT_DRIVE_SECONDS) setGone(true);
    }, 500);
    return () => window.clearInterval(id);
  }, [started, gone]);
  // opening the menu retires the hint for good (state set while rendering, not in an effect)
  if (menuOpen && !gone) setGone(true);

  // keyboard hints make no sense next to on-screen controls
  if (touchUi() || gone || !started) return null;
  return (
    <div className="keyhints" aria-hidden>
      <span><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> drive</span>
      <span><kbd>Space</kbd> jump</span>
      <span>Controls and settings: <b>☰ Menu</b></span>
      <span><kbd>M</kbd> map</span>
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
const JumpIcon = () => (
  <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden><path d="M12 4 5 12h4.5v8h5v-8H19z" fill="currentColor" /></svg>
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
      <div className="touch-side">
        <button className="touch-mode" onClick={() => (input.respawnNearestRequested = true)} aria-label="I'm stuck: put the car back at the nearest area">
          I'm stuck
        </button>
        <button className="touch-mode" onClick={switchMode} aria-label={mode === 'joystick' ? 'Use arrow buttons' : 'Use joystick'}>
          {mode === 'joystick' ? 'Buttons' : 'Stick'}
        </button>
      </div>
      <div className="pad-group right">
        <div className="pad-extras">
          <button aria-label="Jump" className="round jump" {...hold('jump')}><JumpIcon /></button>
          <button aria-label="Horn" className="round horn" {...hold('horn')}><HornIcon /></button>
          <button aria-label="Drift" className="round drift" {...hold('brake')}>Drift</button>
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
