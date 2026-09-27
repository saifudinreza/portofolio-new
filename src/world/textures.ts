// Procedural textures drawn on canvases at startup: no image files to download, and they stay on-brand.
import * as THREE from 'three';
import { rng } from './layout';

const cache = new Map<string, THREE.Texture>();

function draw(size: [number, number], paint: (g: CanvasRenderingContext2D, w: number, h: number) => void) {
  const c = document.createElement('canvas');
  [c.width, c.height] = size;
  paint(c.getContext('2d')!, c.width, c.height);
  return c;
}

function texture(key: string, make: () => HTMLCanvasElement, { srgb = true, repeat = [1, 1] as [number, number] } = {}) {
  const hit = cache.get(key);
  if (hit) return hit;
  const t = new THREE.CanvasTexture(make());
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(...repeat);
  t.anisotropy = 4;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  cache.set(key, t);
  return t;
}

/** Tileable value noise in 0..1, summed over a few octaves. */
function noiseField(size: number, seed: number, octaves = 4) {
  const r = rng(seed);
  const out = new Float32Array(size * size);
  let amp = 1;
  let total = 0;
  for (let o = 0; o < octaves; o++) {
    const cells = 4 << o;
    const grid = Array.from({ length: cells * cells }, () => r());
    const at = (x: number, y: number) => grid[((y + cells) % cells) * cells + ((x + cells) % cells)];
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const fx = (x / size) * cells;
        const fy = (y / size) * cells;
        const ix = Math.floor(fx);
        const iy = Math.floor(fy);
        const tx = fx - ix;
        const ty = fy - iy;
        const sx = tx * tx * (3 - 2 * tx);
        const sy = ty * ty * (3 - 2 * ty);
        const a = at(ix, iy) + (at(ix + 1, iy) - at(ix, iy)) * sx;
        const b = at(ix, iy + 1) + (at(ix + 1, iy + 1) - at(ix, iy + 1)) * sx;
        out[y * size + x] += (a + (b - a) * sy) * amp;
      }
    }
    total += amp;
    amp *= 0.5;
  }
  for (let i = 0; i < out.length; i++) out[i] /= total;
  return out;
}

/** Tangent-space normal map from a height field (tileable, since the field wraps). */
function normalCanvas(height: Float32Array, size: number, strength: number) {
  return draw([size, size], (g) => {
    const img = g.createImageData(size, size);
    const h = (x: number, y: number) => height[((y + size) % size) * size + ((x + size) % size)];
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const dx = (h(x + 1, y) - h(x - 1, y)) * strength;
        const dy = (h(x, y + 1) - h(x, y - 1)) * strength;
        const len = Math.hypot(dx, dy, 1);
        const i = (y * size + x) * 4;
        img.data[i] = ((-dx / len) * 0.5 + 0.5) * 255;
        img.data[i + 1] = ((-dy / len) * 0.5 + 0.5) * 255;
        img.data[i + 2] = (1 / len) * 255;
        img.data[i + 3] = 255;
      }
    }
    g.putImageData(img, 0, 0);
  });
}

const GROUND = 256;
let groundHeight: Float32Array | null = null;
const groundField = () => (groundHeight ??= noiseField(GROUND, 91, 5));

/** Warm sand with soft patches and tiny pebbles. Tint comes from the material colour. */
export function groundColorMap(repeat: number) {
  return texture(`ground-color-${repeat}`, () =>
    draw([GROUND, GROUND], (g, w) => {
      const field = groundField();
      const img = g.createImageData(w, w);
      const r = rng(5);
      for (let i = 0; i < field.length; i++) {
        const v = 0.9 + (field[i] - 0.5) * 0.22 + (r() - 0.5) * 0.05;
        img.data[i * 4] = Math.min(255, 255 * v);
        img.data[i * 4 + 1] = Math.min(255, 250 * v);
        img.data[i * 4 + 2] = Math.min(255, 238 * v);
        img.data[i * 4 + 3] = 255;
      }
      g.putImageData(img, 0, 0);
      for (let i = 0; i < 160; i++) {
        g.fillStyle = r() > 0.5 ? 'rgba(150,120,85,0.22)' : 'rgba(255,255,245,0.25)';
        g.beginPath();
        g.arc(r() * w, r() * w, 0.6 + r() * 1.4, 0, Math.PI * 2);
        g.fill();
      }
    }), { repeat: [repeat, repeat] });
}

export function groundNormalMap(repeat: number) {
  return texture(`ground-normal-${repeat}`, () => normalCanvas(groundField(), GROUND, 18), { srgb: false, repeat: [repeat, repeat] });
}

/**
 * Dirt road strip: u runs across the road, v along it. Edges fade out raggedly into the sand, with two
 * darker worn wheel tracks and some gravel. Used as both colour and alpha.
 */
export function roadMap() {
  return texture('road', () =>
    draw([128, 256], (g, w, h) => {
      const r = rng(17);
      const img = g.createImageData(w, h);
      for (let y = 0; y < h; y++) {
        // ragged edge that wobbles along the road
        const wobble = Math.sin(y * 0.11) * 0.04 + Math.sin(y * 0.37 + 1.3) * 0.025;
        for (let x = 0; x < w; x++) {
          const u = x / (w - 1);
          const edge = Math.min(u, 1 - u) + wobble * (u < 0.5 ? 1 : -1);
          const alpha = Math.min(1, Math.max(0, (edge - 0.02) / 0.16));
          const track = Math.exp(-(((u - 0.3) / 0.045) ** 2)) + Math.exp(-(((u - 0.7) / 0.045) ** 2));
          const shade = 0.84 - track * 0.14 + (r() - 0.5) * 0.06;
          const i = (y * w + x) * 4;
          img.data[i] = 255 * shade;
          img.data[i + 1] = 245 * shade;
          img.data[i + 2] = 228 * shade;
          img.data[i + 3] = 255 * alpha * (0.85 + r() * 0.15);
        }
      }
      g.putImageData(img, 0, 0);
      for (let i = 0; i < 120; i++) {
        g.fillStyle = `rgba(${130 + r() * 40},${105 + r() * 30},${80 + r() * 20},0.55)`;
        g.fillRect(w * (0.15 + r() * 0.7), r() * h, 1 + r() * 2, 1 + r() * 2);
      }
    }));
}

/** Wooden crate planks with grain, tinted by the material colour. */
export function woodMap() {
  return texture('wood', () =>
    draw([256, 256], (g, w, h) => {
      const r = rng(33);
      g.fillStyle = '#fff';
      g.fillRect(0, 0, w, h);
      const planks = 4;
      for (let p = 0; p < planks; p++) {
        const y0 = (p * h) / planks;
        const tone = 0.88 + r() * 0.12;
        g.fillStyle = `rgb(${255 * tone},${245 * tone},${230 * tone})`;
        g.fillRect(0, y0, w, h / planks);
        for (let i = 0; i < 26; i++) {
          g.strokeStyle = `rgba(120,80,45,${0.08 + r() * 0.12})`;
          g.lineWidth = 0.6 + r() * 1.2;
          g.beginPath();
          const y = y0 + r() * (h / planks);
          g.moveTo(0, y);
          g.bezierCurveTo(w * 0.3, y + (r() - 0.5) * 6, w * 0.7, y + (r() - 0.5) * 6, w, y + (r() - 0.5) * 4);
          g.stroke();
        }
        g.fillStyle = 'rgba(80,50,25,0.45)';
        g.fillRect(0, y0, w, 3);
      }
      // frame boards and nails
      g.strokeStyle = 'rgba(80,50,25,0.5)';
      g.lineWidth = 10;
      g.strokeRect(5, 5, w - 10, h - 10);
      g.fillStyle = 'rgba(60,60,60,0.8)';
      for (const [x, y] of [[14, 14], [w - 14, 14], [14, h - 14], [w - 14, h - 14]]) g.fillRect(x - 2, y - 2, 4, 4);
    }));
}

/** Chevron tyre tread for the bump map; u runs around the tyre. */
export function treadMap() {
  return texture('tread', () =>
    draw([256, 64], (g, w, h) => {
      g.fillStyle = '#fff';
      g.fillRect(0, 0, w, h);
      g.strokeStyle = '#000';
      g.lineWidth = 3;
      for (let x = 0; x < w; x += 8) {
        g.beginPath();
        g.moveTo(x, h * 0.2);
        g.lineTo(x + 4, h * 0.5);
        g.lineTo(x, h * 0.8);
        g.stroke();
      }
    }), { srgb: false });
}

/** Soft oval glow for the headlight pool: bright near the car (top of the canvas, which faces the car), fading ahead. */
export function glowMap() {
  return texture('glow', () =>
    draw([128, 128], (g, w, h) => {
      const grad = g.createRadialGradient(w / 2, h * 0.15, 2, w / 2, h * 0.4, w * 0.55);
      grad.addColorStop(0, 'rgba(255,255,255,1)');
      grad.addColorStop(0.45, 'rgba(255,255,255,0.45)');
      grad.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = grad;
      g.fillRect(0, 0, w, h);
    }), { repeat: [1, 1] });
}
