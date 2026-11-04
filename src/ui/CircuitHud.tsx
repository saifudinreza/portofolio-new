import { useEffect, useRef } from 'react';
import { cancelLap, checkIdle, useCircuit } from '../game/circuit';
import { circuitGates } from '../world/layout';

const fmt = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toFixed(2).padStart(5, '0')}`;

/** Lap timer while a time trial runs, then the result for a few seconds. */
export function CircuitHud() {
  const active = useCircuit((s) => s.active);
  const next = useCircuit((s) => s.next);
  const startedAt = useCircuit((s) => s.startedAt);
  const best = useCircuit((s) => s.best);
  const last = useCircuit((s) => s.last);
  const clock = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!active) return;
    let raf = 0;
    const tick = (now: number) => {
      raf = requestAnimationFrame(tick);
      if (clock.current) clock.current.textContent = fmt((now - startedAt) / 1000);
      checkIdle(now);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [active, startedAt]);

  if (!active && !last) return null;
  const checkpoints = circuitGates.length - 1;
  return (
    <div className="circuit-hud">
      {active ? (
        <>
          <span className="circuit-time" ref={clock}>0:00.00</span>
          <span className="circuit-meta">{next === 0 ? 'Back to the finish!' : `Checkpoint ${next} of ${checkpoints}`}</span>
          {best !== null && <span className="circuit-meta">Best {fmt(best)}</span>}
          <button className="btn small" onClick={(e) => { e.currentTarget.blur(); cancelLap(); }}>End lap</button>
        </>
      ) : (
        last && (
          <p role="status" className="circuit-result">
            Lap {fmt(last.time)}
            {last.record ? ' · new best!' : best !== null ? ` · best ${fmt(best)}` : ''}
          </p>
        )
      )}
    </div>
  );
}
