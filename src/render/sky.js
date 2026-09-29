// Layered sky: gradient, stars, drifting clouds and energy motes.
// Used by the island (with a visual day/night cycle) and by challenges.

import { TAU, mulberry32, smoothstep } from '../core/math.js';
import { glow, softBlob, mix } from './draw.js';

// Day/night keyframes: [phase, top, middle, bottom]
const CYCLE = [
  [0.0, '#2b3aa0', '#d77ac0', '#ffc38a'], // dawn
  [0.1, '#1d45b0', '#4d8ee8', '#a9dcff'], // day
  [0.46, '#1d45b0', '#4d8ee8', '#a9dcff'],
  [0.56, '#2d2582', '#d8609e', '#ffa25a'], // sunset
  [0.66, '#060a24', '#141a4c', '#302260'], // night
  [0.9, '#060a24', '#141a4c', '#302260'],
  [1.0, '#2b3aa0', '#d77ac0', '#ffc38a'],
];

export function skyColors(phase) {
  for (let i = 0; i < CYCLE.length - 1; i++) {
    const a = CYCLE[i];
    const b = CYCLE[i + 1];
    if (phase >= a[0] && phase <= b[0]) {
      const k = smoothstep(0, 1, (phase - a[0]) / (b[0] - a[0] || 1));
      return [mix(a[1], b[1], k), mix(a[2], b[2], k), mix(a[3], b[3], k)];
    }
  }
  return [CYCLE[0][1], CYCLE[0][2], CYCLE[0][3]];
}

/** 0 at full day → 1 at full night. */
export function nightFactor(phase) {
  if (phase < 0.1) return 1 - smoothstep(0, 0.1, phase) * 1;
  if (phase < 0.46) return 0;
  if (phase < 0.66) return smoothstep(0.46, 0.66, phase);
  if (phase < 0.9) return 1;
  return 1 - smoothstep(0.9, 1, phase) * 0.6;
}

export class Sky {
  constructor(seed = 7) {
    const rng = mulberry32(seed);
    this.stars = Array.from({ length: 90 }, () => ({ x: rng(), y: rng() * 0.75, r: 0.6 + rng() * 1.6, ph: rng() * TAU }));
    this.clouds = Array.from({ length: 9 }, (_, i) => ({ x: rng() * 1.4 - 0.2, y: 0.12 + rng() * 0.8, w: 120 + rng() * 200, sp: 4 + rng() * 10, depth: 0.2 + (i % 3) * 0.2 }));
    this.motes = Array.from({ length: 24 }, () => ({ x: rng(), y: rng(), sp: 6 + rng() * 14, ph: rng() * TAU, c: rng() < 0.5 ? '#35e8ff' : '#ff7ad9' }));
  }

  /**
   * Draw in screen space.
   * opts: { colors:[top, mid, bottom], night 0..1, t, camX, camY, cloudAlpha, reduced }
   */
  draw(ctx, w, h, opts) {
    const [top, mid, bottom] = opts.colors;
    // Reuse the gradient object until the size or (quantised) colours change.
    const key = `${h}|${top}|${mid}|${bottom}`;
    if (!this.bg || this.bg.key !== key) {
      const grad = ctx.createLinearGradient(0, 0, 0, h);
      grad.addColorStop(0, top);
      grad.addColorStop(0.55, mid);
      grad.addColorStop(1, bottom);
      this.bg = { key, grad };
    }
    ctx.fillStyle = this.bg.grad;
    ctx.fillRect(0, 0, w, h);
    const t = opts.t || 0;
    const night = opts.night ?? 1;
    const px = (opts.camX || 0) * 0.04;
    const py = (opts.camY || 0) * 0.04;

    if (night > 0.02) {
      ctx.fillStyle = '#ffffff';
      for (const s of this.stars) {
        const tw = opts.reduced ? 0.8 : 0.55 + Math.sin(t * 2 + s.ph) * 0.45;
        ctx.globalAlpha = night * tw;
        const x = (((s.x * w - px) % w) + w) % w;
        const y = s.y * h - py;
        ctx.fillRect(x, y, s.r, s.r);
      }
      ctx.globalAlpha = 1;
    }
    // sun / moon glow
    if (opts.sun !== false) {
      const sx = w * 0.82 - px * 2;
      const sy = h * 0.2 - py;
      if (night < 0.8) glow(ctx, sx, sy, Math.min(w, h) * 0.24, '#fff1c8', (1 - night) * 0.55);
      if (night > 0.3) {
        glow(ctx, w * 0.18 - px, h * 0.16 - py, 90, '#c8d4ff', night * 0.5);
        ctx.globalAlpha = night;
        ctx.fillStyle = '#eef2ff';
        ctx.beginPath();
        ctx.arc(w * 0.18 - px, h * 0.16 - py, 18, 0, TAU);
        ctx.fill();
        ctx.fillStyle = mid;
        ctx.beginPath();
        ctx.arc(w * 0.18 - px + 8, h * 0.16 - py - 5, 15, 0, TAU);
        ctx.fill();
        ctx.globalAlpha = 1;
      }
    }
    // clouds (fewer layers on lower graphics settings)
    if (opts.quality === 'low') return;
    const detail = opts.quality === 'medium' ? 1 : 3;
    const ca = opts.cloudAlpha ?? 1;
    const cloudCol = night > 0.5 ? '#a9a2ff' : '#ffffff';
    for (const c of this.clouds) {
      const drift = opts.reduced ? 0 : t * c.sp;
      const span = w + c.w * 2;
      const x = ((((c.x * w + drift - px * c.depth * 10) % span) + span) % span) - c.w;
      const y = c.y * h - py * c.depth * 10;
      const a = (0.28 - night * 0.18) * ca * (0.6 + c.depth);
      if (a <= 0.01) continue;
      if (detail === 1) {
        softBlob(ctx, x, y, c.w, c.w * 0.32, cloudCol, a);
        continue;
      }
      const spr = cloudSprite(c, cloudCol);
      ctx.globalAlpha = a;
      ctx.drawImage(spr, x - c.w * 1.1, y - c.w * 0.45, c.w * 2.2, c.w * 0.8);
      ctx.globalAlpha = 1;
    }
  }

  /** Floating energy motes (screen space, very subtle). */
  drawMotes(ctx, w, h, t, alpha = 1, reduced = false) {
    for (const m of this.motes) {
      const y = (((m.y * h - (reduced ? 0 : t * m.sp)) % h) + h) % h;
      const x = m.x * w + Math.sin(t * 0.8 + m.ph) * 16;
      glow(ctx, x, y, 7, m.c, 0.45 * alpha);
    }
  }
}

/** Three soft blobs merged into one low-resolution sprite per cloud. */
const cloudCache = new Map();
function cloudSprite(c, color) {
  const key = `${c.w}|${color}`;
  let spr = cloudCache.get(key);
  if (spr) return spr;
  spr = document.createElement('canvas');
  spr.width = 176;
  spr.height = 64;
  const g = spr.getContext('2d');
  const k = 176 / (c.w * 2.2);
  g.scale(k, k);
  const ox = c.w * 1.1;
  const oy = c.w * 0.45;
  softBlob(g, ox, oy, c.w, c.w * 0.32, color, 1);
  softBlob(g, ox + c.w * 0.4, oy - c.w * 0.1, c.w * 0.6, c.w * 0.26, color, 1);
  softBlob(g, ox - c.w * 0.4, oy + c.w * 0.04, c.w * 0.5, c.w * 0.2, color, 1);
  cloudCache.set(key, spr);
  return spr;
}
