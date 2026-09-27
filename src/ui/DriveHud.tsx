import { useEffect, useRef } from 'react';
import { useStore } from '../store';
import { carState } from '../world/carState';
import { actors } from '../world/actors';
import { RIVER_HALF_WIDTH, WORLD_SIZE, aboutArea, bridge, contactPads, palette, pond, projectPadPositions, riverPath, roadSegments, trails, warehouse } from '../world/layout';

const HALF = WORLD_SIZE / 2;
const MAX_KMH = 70; // a little over boost top speed (19 m/s ≈ 68 km/h)
const ARC = 157; // length of the gauge arc path below, for the dash offset

/** Draws the parts of the map that never move, once, onto an offscreen canvas. */
function drawStaticMap(size: number, dpr: number) {
  const c = document.createElement('canvas');
  c.width = c.height = size * dpr;
  const g = c.getContext('2d')!;
  g.scale(dpr, dpr);
  const s = size / WORLD_SIZE;
  const px = (x: number) => (x + HALF) * s;

  g.fillStyle = '#E9D3A6';
  g.fillRect(0, 0, size, size);
  g.lineCap = 'round';
  g.lineJoin = 'round';
  // river under everything else
  g.strokeStyle = '#6CC7BA';
  g.lineWidth = RIVER_HALF_WIDTH * 2 * s;
  g.beginPath();
  riverPath.forEach((p, i) => (i ? g.lineTo(px(p.x), px(p.z)) : g.moveTo(px(p.x), px(p.z))));
  g.stroke();
  g.strokeStyle = '#D0B07E';
  g.lineWidth = Math.max(2, 3 * s);
  for (const [x1, z1, x2, z2] of roadSegments) {
    g.beginPath();
    g.moveTo(px(x1), px(z1));
    g.lineTo(px(x2), px(z2));
    g.stroke();
  }
  g.setLineDash([2, 3]);
  g.lineWidth = 1;
  for (const [x1, z1, x2, z2] of trails) {
    g.beginPath();
    g.moveTo(px(x1), px(z1));
    g.lineTo(px(x2), px(z2));
    g.stroke();
  }
  g.setLineDash([]);
  // the bridge: a wooden bar across the water, along the road
  g.save();
  g.translate(px(bridge.x), px(bridge.z));
  g.rotate(-bridge.yaw);
  g.fillStyle = palette.woodDark;
  g.fillRect(-bridge.halfWidth * s * 1.4, -bridge.deckHalf * s, bridge.halfWidth * s * 2.8, bridge.deckHalf * s * 2);
  g.restore();

  g.fillStyle = '#6CC7BA';
  g.beginPath();
  g.ellipse(px(pond.x), px(pond.z), pond.rx * s, pond.rz * s, 0, 0, Math.PI * 2);
  g.fill();

  const dot = (x: number, z: number, r: number, color: string) => {
    g.fillStyle = color;
    g.beginPath();
    g.arc(px(x), px(z), r, 0, Math.PI * 2);
    g.fill();
  };
  for (const [x, z] of projectPadPositions) dot(x, z, 2.6, palette.teal);
  for (const [x, z] of contactPads) dot(x, z, 2.6, palette.coral);
  g.fillStyle = palette.navy;
  g.fillRect(px(warehouse.x) - 5, px(warehouse.z) - 5, 10, 8);
  dot(aboutArea.x, aboutArea.z, 4, palette.yellow);
  dot(0, -3, 3, palette.navy);

  g.font = '700 9px "DM Sans", system-ui, sans-serif';
  g.fillStyle = palette.navy;
  g.textAlign = 'center';
  // keep labels inside the canvas; on the small phone map the ones near the edge would be clipped
  const label = (text: string, x: number, z: number) => {
    const half = g.measureText(text).width / 2 + 2;
    g.fillText(text, Math.min(Math.max(px(x), half), size - half), px(z));
  };
  label('PROJECTS', 26, -35);
  label('SKILLS', warehouse.x, warehouse.z - 8);
  label('ABOUT', aboutArea.x, aboutArea.z + 9);
  label('CONTACT', 26, 38);
  label('HOME', 0, 3.5);
  return c;
}

/**
 * Driving HUD: a speedometer with a boost light and a mini-map showing the areas, the pond, the people
 * walking around and the car. Updated straight from carState every frame, without React re-renders.
 */
export function DriveHud() {
  const started = useStore((s) => s.started);
  const classicOpen = useStore((s) => s.classicOpen);
  const map = useRef<HTMLCanvasElement>(null);
  const speed = useRef<HTMLSpanElement>(null);
  const arc = useRef<SVGPathElement>(null);
  const boost = useRef<HTMLSpanElement>(null);
  const visible = started && !classicOpen;

  useEffect(() => {
    if (!visible) return;
    const canvas = map.current!;
    const size = canvas.clientWidth;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = canvas.height = size * dpr;
    const g = canvas.getContext('2d')!;
    const base = drawStaticMap(size, dpr);
    const s = size / WORLD_SIZE;
    const px = (x: number) => (x + HALF) * s;
    let raf = 0;
    let lastMap = 0;

    const tick = (now: number) => {
      raf = requestAnimationFrame(tick);
      const kmh = Math.abs(carState.speed) * 3.6;
      if (speed.current) speed.current.textContent = String(Math.round(kmh));
      arc.current?.setAttribute('stroke-dashoffset', String(ARC * (1 - Math.min(kmh / MAX_KMH, 1))));
      boost.current?.classList.toggle('on', carState.boost);

      // the map doesn't need 60 fps
      if (now - lastMap < 66) return;
      lastMap = now;
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      g.drawImage(base, 0, 0, size, size);
      g.fillStyle = palette.dark;
      for (const a of actors) {
        // the car is an actor too; skip it (it gets the arrow)
        if (a.x === carState.x && a.z === carState.z) continue;
        g.beginPath();
        g.arc(px(a.x), px(a.z), 1.8, 0, Math.PI * 2);
        g.fill();
      }
      g.save();
      g.translate(px(carState.x), px(carState.z));
      // heading: forward is (sin yaw, cos yaw) in x/z, and +z is down on the map
      g.rotate(-carState.yaw + Math.PI);
      g.fillStyle = palette.coral;
      g.strokeStyle = '#fff';
      g.lineWidth = 1.5;
      g.beginPath();
      g.moveTo(0, -6);
      g.lineTo(4.5, 5);
      g.lineTo(0, 2.5);
      g.lineTo(-4.5, 5);
      g.closePath();
      g.fill();
      g.stroke();
      g.restore();
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [visible]);

  if (!visible) return null;
  return (
    <div className="drive-hud" aria-hidden>
      <canvas ref={map} className="minimap" />
      <div className="speedo">
        <svg viewBox="0 0 120 70" className="gauge">
          <path d="M10 62 A50 50 0 0 1 110 62" className="gauge-track" />
          <path ref={arc} d="M10 62 A50 50 0 0 1 110 62" className="gauge-fill" strokeDasharray={ARC} strokeDashoffset={ARC} />
        </svg>
        <div className="speed-readout">
          <span ref={speed} className="speed-value">0</span>
          <span className="speed-unit">km/h</span>
        </div>
        <span ref={boost} className="boost-light" title="Boost">
          <svg viewBox="0 0 24 24" width="16" height="16"><path d="M13 2 4 14h6l-1 8 9-12h-6z" fill="currentColor" /></svg>
        </span>
      </div>
    </div>
  );
}
