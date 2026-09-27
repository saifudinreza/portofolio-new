// Procedural textures for the ground decor: plaza paving, lamp light pools and the interaction key cap.
import * as THREE from 'three';
import { rng } from './layout';
import { draw, texture } from './textures';

/**
 * Stone paving in a running bond: rounded slabs with grout lines, each slab a slightly different tone,
 * a few cracks and worn patches. Tinted by the material colour.
 */
export function pavingMap() {
  return texture('paving', () =>
    draw([256, 256], (g, w, h) => {
      const r = rng(61);
      g.fillStyle = 'rgb(150,140,125)';
      g.fillRect(0, 0, w, h);
      const rows = 6;
      const rh = h / rows;
      for (let row = 0; row < rows; row++) {
        const cols = 4;
        const cw = w / cols;
        const shift = row % 2 ? cw / 2 : 0;
        for (let c = -1; c < cols; c++) {
          const x = c * cw + shift + 2;
          const y = row * rh + 2;
          const tone = 205 + r() * 45;
          g.fillStyle = `rgb(${tone},${tone - 6},${tone - 16})`;
          g.beginPath();
          g.roundRect(x, y, cw - 4, rh - 4, 5);
          g.fill();
          // worn, lighter middle
          const grad = g.createRadialGradient(x + cw / 2, y + rh / 2, 2, x + cw / 2, y + rh / 2, cw * 0.6);
          grad.addColorStop(0, 'rgba(255,255,255,0.12)');
          grad.addColorStop(1, 'rgba(0,0,0,0.06)');
          g.fillStyle = grad;
          g.fill();
        }
      }
      // speckle and a few cracks
      for (let i = 0; i < 900; i++) {
        g.fillStyle = `rgba(${90 + r() * 60},${80 + r() * 50},${70 + r() * 40},${0.12 + r() * 0.15})`;
        g.fillRect(r() * w, r() * h, 1 + r() * 1.5, 1 + r() * 1.5);
      }
      g.strokeStyle = 'rgba(80,70,60,0.45)';
      g.lineWidth = 1;
      for (let k = 0; k < 7; k++) {
        let x = r() * w;
        let y = r() * h;
        g.beginPath();
        g.moveTo(x, y);
        for (let s = 0; s < 5; s++) {
          x += (r() - 0.5) * 18;
          y += (r() - 0.5) * 18;
          g.lineTo(x, y);
        }
        g.stroke();
      }
    }));
}

/** Warm pool of lamp light on the ground: bright centre fading to nothing. Used as an additive decal. */
export function lightPoolMap() {
  return texture('light-pool', () =>
    draw([128, 128], (g, w, h) => {
      const grad = g.createRadialGradient(w / 2, h / 2, 1, w / 2, h / 2, w / 2);
      grad.addColorStop(0, 'rgba(255,255,255,0.9)');
      grad.addColorStop(0.35, 'rgba(255,255,255,0.35)');
      grad.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = grad;
      g.fillRect(0, 0, w, h);
    }), { repeat: [1, 1] });
}

/** Floating "press Enter" marker: a key cap with the ↵ symbol above a label, on a transparent canvas. */
export function keyMarkerTexture(label: string) {
  const c = draw([256, 160], (g, w) => {
    g.fillStyle = 'rgba(31,56,100,0.92)';
    g.beginPath();
    g.roundRect(w / 2 - 44, 6, 88, 80, 16);
    g.fill();
    g.fillStyle = '#FFF6E6';
    g.beginPath();
    g.roundRect(w / 2 - 38, 8, 76, 70, 12);
    g.fill();
    g.fillStyle = '#1F3864';
    g.font = '700 50px "DM Sans", system-ui, sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText('↵', w / 2, 44);
    g.font = '800 30px "Archivo Black", system-ui, sans-serif';
    g.lineWidth = 7;
    g.strokeStyle = 'rgba(31,56,100,0.9)';
    g.strokeText(label, w / 2, 124);
    g.fillStyle = '#FFF6E6';
    g.fillText(label, w / 2, 124);
  });
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

/** One fallen leaf with a midrib, on transparent ground; for the leaves scattered over roads and paving. */
export function fallenLeafMap() {
  return texture('fallen-leaf', () =>
    draw([64, 64], (g, w, h) => {
      g.translate(w / 2, h - 6);
      const grad = g.createLinearGradient(-14, -h, 14, 0);
      grad.addColorStop(0, '#ffffff');
      grad.addColorStop(1, '#c8c8c8');
      g.fillStyle = grad;
      g.beginPath();
      g.moveTo(0, 0);
      g.quadraticCurveTo(18, -h * 0.45, 0, -(h - 12));
      g.quadraticCurveTo(-18, -h * 0.45, 0, 0);
      g.fill();
      g.strokeStyle = 'rgba(0,0,0,0.25)';
      g.lineWidth = 1.5;
      g.beginPath();
      g.moveTo(0, 2);
      g.lineTo(0, -(h - 16));
      g.stroke();
    }), { repeat: [1, 1] });
}
