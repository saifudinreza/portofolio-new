import { useEffect, useRef } from 'react';
import { useStore } from '../store';
import { WORLD_SIZE, zones, type ZoneId } from '../world/layout';
import { drawLiveMap, drawStaticMap } from './DriveHud';
import { useDialogFocus } from './useDialog';

const PICK_RADIUS = 14; // metres: a click this close to an area's spawn point teleports there

/** The big map (M): the mini-map at full size, live, with every area one click away. */
export function BigMap() {
  const open = useStore((s) => s.mapOpen);
  const setMap = useStore((s) => s.setMap);
  const teleportTo = useStore((s) => s.teleportTo);
  const panel = useDialogFocus<HTMLDivElement>(open);
  const canvas = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!open) return;
    const c = canvas.current!;
    const size = c.clientWidth;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    c.width = c.height = size * dpr;
    const g = c.getContext('2d')!;
    const base = drawStaticMap(size, dpr);
    let raf = 0;
    const tick = () => {
      raf = requestAnimationFrame(tick);
      drawLiveMap(g, base, size, dpr);
    };
    tick();
    return () => cancelAnimationFrame(raf);
  }, [open]);

  if (!open) return null;

  const go = (zone: ZoneId) => {
    teleportTo(zone);
    setMap(false);
  };

  return (
    <div className="menu-backdrop" onPointerDown={(e) => e.target === e.currentTarget && setMap(false)}>
      <div className="menu bigmap" role="dialog" aria-modal="true" aria-label="Map" ref={panel} tabIndex={-1}>
        <div className="menu-head">
          <h2>Map</h2>
          <button className="menu-close" aria-label="Close map" onClick={() => setMap(false)}>✕</button>
        </div>
        <canvas
          ref={canvas}
          className="bigmap-canvas"
          aria-label="Map of the island. Click an area to drive there."
          onClick={(e) => {
            const r = e.currentTarget.getBoundingClientRect();
            const x = ((e.clientX - r.left) / r.width) * WORLD_SIZE - WORLD_SIZE / 2;
            const z = ((e.clientY - r.top) / r.height) * WORLD_SIZE - WORLD_SIZE / 2;
            let best: ZoneId | null = null;
            let bestD = PICK_RADIUS;
            for (const id of Object.keys(zones) as ZoneId[]) {
              const d = Math.hypot(x - zones[id].spawn[0], z - zones[id].spawn[1]);
              if (d < bestD) {
                bestD = d;
                best = id;
              }
            }
            if (best) go(best);
          }}
        />
        <nav className="bigmap-zones" aria-label="Jump to area">
          {(Object.keys(zones) as ZoneId[]).map((id) => (
            <button key={id} className="btn small" onClick={() => go(id)}>{zones[id].label}</button>
          ))}
        </nav>
      </div>
    </div>
  );
}
