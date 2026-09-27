// Procedural textures for trees and shrubs: leaf sprigs, fir sprigs, single leaves and bark.
import { rng } from './layout';
import { draw, texture } from './textures';

/** One almond-shaped leaf with a midrib, pointing up (-y on the canvas), lit from the top left. */
function paintLeaf(g: CanvasRenderingContext2D, x: number, y: number, len: number, wid: number, angle: number, shade: number) {
  g.save();
  g.translate(x, y);
  g.rotate(angle);
  const grad = g.createLinearGradient(-wid, -len, wid, 0);
  const hi = Math.round(255 * shade);
  const lo = Math.round(200 * shade);
  grad.addColorStop(0, `rgb(${hi},${hi},${hi})`);
  grad.addColorStop(1, `rgb(${lo},${lo},${lo})`);
  g.fillStyle = grad;
  g.beginPath();
  g.moveTo(0, 0);
  g.quadraticCurveTo(wid, -len * 0.45, 0, -len);
  g.quadraticCurveTo(-wid, -len * 0.45, 0, 0);
  g.fill();
  g.strokeStyle = `rgba(0,0,0,${0.18 * shade})`;
  g.lineWidth = 1.2;
  g.beginPath();
  g.moveTo(0, -len * 0.05);
  g.lineTo(0, -len * 0.9);
  g.stroke();
  g.restore();
}

/** A sprig of leaves on transparent ground, for alpha-tested canopy cards. Tinted by vertex/instance colour. */
export function leafClusterMap() {
  return texture('leaf-cluster', () =>
    draw([128, 128], (g, w, h) => {
      const r = rng(5);
      for (let i = 0; i < 18; i++) {
        const a = (i / 18) * Math.PI * 2 * 1.6 + (r() - 0.5) * 0.5;
        const d = 4 + r() * 26;
        paintLeaf(g, w / 2 + Math.cos(a) * d * 0.5, h / 2 + Math.sin(a) * d * 0.5, 34 + r() * 18, 12 + r() * 6, a + Math.PI / 2 + (r() - 0.5) * 0.6, 0.72 + r() * 0.28);
      }
    }));
}

/** A fir sprig: a twig with short needles either side, for pine canopy cards. */
export function needleMap() {
  return texture('needles', () =>
    draw([128, 128], (g, w, h) => {
      const r = rng(8);
      for (let b = 0; b < 3; b++) {
        const x0 = w * (0.3 + b * 0.2);
        const tilt = (b - 1) * 0.35;
        g.save();
        g.translate(x0, h - 6);
        g.rotate(tilt);
        g.strokeStyle = 'rgb(150,150,150)';
        g.lineWidth = 2;
        g.beginPath();
        g.moveTo(0, 0);
        g.lineTo(0, -h * 0.85);
        g.stroke();
        for (let y = -8; y > -h * 0.85; y -= 4) {
          const len = 12 * (1 + y / (h * 0.9)) + 5;
          for (const side of [-1, 1]) {
            const v = Math.round(200 + r() * 55);
            g.strokeStyle = `rgb(${v},${v},${v})`;
            g.lineWidth = 1.6;
            g.beginPath();
            g.moveTo(0, y);
            g.lineTo(side * len, y - len * 0.6);
            g.stroke();
          }
        }
        g.restore();
      }
    }));
}

/** A single leaf, for the ones drifting down. */
export function singleLeafMap() {
  return texture('leaf-single', () =>
    draw([64, 64], (g, w, h) => paintLeaf(g, w / 2, h - 4, h - 8, 16, 0, 1)));
}

/** Bark: vertical ridges and grooves, tinted by the material colour. */
export function barkMap() {
  return texture('bark', () =>
    draw([64, 256], (g, w, h) => {
      const r = rng(13);
      g.fillStyle = '#fff';
      g.fillRect(0, 0, w, h);
      for (let i = 0; i < 40; i++) {
        const x = r() * w;
        g.strokeStyle = `rgba(60,40,25,${0.12 + r() * 0.25})`;
        g.lineWidth = 1 + r() * 2.5;
        g.beginPath();
        g.moveTo(x, 0);
        for (let y = 0; y <= h; y += 16) g.lineTo(x + Math.sin(y * 0.05 + i) * 2.5, y);
        g.stroke();
      }
      for (let k = 0; k < 6; k++) {
        g.fillStyle = 'rgba(50,30,20,0.25)';
        g.beginPath();
        g.ellipse(r() * w, r() * h, 3 + r() * 3, 5 + r() * 4, 0, 0, Math.PI * 2);
        g.fill();
      }
    }), { repeat: [2, 2] });
}
