// Pooled particle system. The cap depends on the graphics quality setting so
// effects never balloon into thousands of particles.

import { TAU, rand } from '../core/math.js';
import { glow, circle, starPath, heartPath } from './draw.js';

const CAPS = { low: 140, medium: 320, high: 560 };

export class Particles {
  constructor() {
    this.items = [];
    this.pool = [];
    this.max = CAPS.high;
  }

  setQuality(q) {
    this.max = CAPS[q] || CAPS.high;
  }

  clear() {
    while (this.items.length) this.pool.push(this.items.pop());
  }

  spawn(o) {
    if (this.items.length >= this.max) return null;
    const p = this.pool.pop() || {};
    p.x = o.x;
    p.y = o.y;
    p.vx = o.vx || 0;
    p.vy = o.vy || 0;
    p.life = p.max = o.life || 0.6;
    p.size = o.size || 3;
    p.size2 = o.size2 ?? o.size ?? 3;
    p.color = o.color || '#ffffff';
    p.type = o.type || 'dot';
    p.drag = o.drag ?? 2;
    p.gravity = o.gravity || 0;
    p.rot = o.rot ?? rand(0, TAU);
    p.spin = o.spin ?? rand(-6, 6);
    p.width = o.width || 2;
    p.target = o.target || null;
    p.homing = o.homing || 0;
    p.alpha = o.alpha ?? 1;
    p.additive = o.additive ?? true;
    p.delay = o.delay || 0;
    this.items.push(p);
    return p;
  }

  burst(x, y, o = {}) {
    const n = o.count || 12;
    const colors = o.colors || [o.color || '#ffffff'];
    for (let i = 0; i < n; i++) {
      const a = o.angle != null ? o.angle + rand(-(o.spread ?? TAU) / 2, (o.spread ?? TAU) / 2) : rand(0, TAU);
      const sp = rand(o.speedMin ?? (o.speed || 200) * 0.35, o.speed || 200);
      this.spawn({
        x: x + (o.jitter ? rand(-o.jitter, o.jitter) : 0),
        y: y + (o.jitter ? rand(-o.jitter, o.jitter) : 0),
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp,
        life: rand((o.life || 0.6) * 0.6, o.life || 0.6),
        size: rand((o.size || 3) * 0.6, o.size || 3),
        size2: o.size2 ?? 0,
        color: colors[i % colors.length],
        type: o.type || 'dot',
        drag: o.drag ?? 3,
        gravity: o.gravity || 0,
        width: o.width,
      });
    }
  }

  ring(x, y, o = {}) {
    this.spawn({
      x, y, type: 'ring', life: o.life || 0.5, size: o.from || 4, size2: o.radius || 60,
      color: o.color || '#ffffff', width: o.width || 3, drag: 0, alpha: o.alpha ?? 1,
    });
  }

  update(dt) {
    const items = this.items;
    for (let i = items.length - 1; i >= 0; i--) {
      const p = items[i];
      if (p.delay > 0) {
        p.delay -= dt;
        continue;
      }
      p.life -= dt;
      if (p.life <= 0) {
        items[i] = items[items.length - 1];
        items.pop();
        this.pool.push(p);
        continue;
      }
      if (p.target && p.homing) {
        const dx = p.target.x - p.x;
        const dy = p.target.y - p.y;
        const d = Math.hypot(dx, dy) || 1;
        p.vx += (dx / d) * p.homing * dt;
        p.vy += (dy / d) * p.homing * dt;
        if (d < 10) p.life = Math.min(p.life, 0.05);
      }
      const k = Math.exp(-p.drag * dt);
      p.vx *= k;
      p.vy *= k;
      p.vy += p.gravity * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.rot += p.spin * dt;
    }
  }

  render(ctx, view) {
    const items = this.items;
    if (!items.length) return;
    // Cull to the visible world rectangle when provided.
    const vx0 = view ? view.x0 - 60 : -Infinity;
    const vx1 = view ? view.x1 + 60 : Infinity;
    const vy0 = view ? view.y0 - 60 : -Infinity;
    const vy1 = view ? view.y1 + 60 : Infinity;
    for (let i = 0; i < items.length; i++) {
      const p = items[i];
      if (p.delay > 0) continue;
      if (p.x < vx0 || p.x > vx1 || p.y < vy0 || p.y > vy1) continue;
      const t = 1 - p.life / p.max; // 0 → 1 over lifetime
      const a = (p.life / p.max) * p.alpha;
      const size = p.size + (p.size2 - p.size) * t;
      switch (p.type) {
        case 'dot':
          glow(ctx, p.x, p.y, size * 3.2, p.color, a);
          break;
        case 'solid':
          ctx.globalAlpha = a;
          ctx.fillStyle = p.color;
          circle(ctx, p.x, p.y, size);
          ctx.fill();
          ctx.globalAlpha = 1;
          break;
        case 'spark': {
          ctx.globalCompositeOperation = 'lighter';
          ctx.globalAlpha = a;
          ctx.strokeStyle = p.color;
          ctx.lineWidth = p.width;
          ctx.lineCap = 'round';
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(p.x - p.vx * 0.04, p.y - p.vy * 0.04);
          ctx.stroke();
          ctx.globalAlpha = 1;
          ctx.globalCompositeOperation = 'source-over';
          break;
        }
        case 'ring':
          ctx.globalCompositeOperation = 'lighter';
          ctx.globalAlpha = a;
          ctx.strokeStyle = p.color;
          ctx.lineWidth = p.width * (1 - t * 0.6);
          circle(ctx, p.x, p.y, size);
          ctx.stroke();
          ctx.globalAlpha = a * 0.35;
          ctx.lineWidth = p.width * 3 * (1 - t * 0.6);
          ctx.stroke();
          ctx.globalAlpha = 1;
          ctx.globalCompositeOperation = 'source-over';
          break;
        case 'star':
          ctx.globalAlpha = a;
          ctx.fillStyle = p.color;
          starPath(ctx, p.x, p.y, 4, size * 1.6, size * 0.55, p.rot);
          ctx.fill();
          ctx.globalAlpha = 1;
          break;
        case 'square':
          ctx.globalAlpha = a;
          ctx.fillStyle = p.color;
          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.rotate(p.rot);
          ctx.fillRect(-size, -size * 0.6, size * 2, size * 1.2);
          ctx.restore();
          ctx.globalAlpha = 1;
          break;
        case 'heart':
          ctx.globalAlpha = a;
          ctx.fillStyle = p.color;
          heartPath(ctx, p.x, p.y, size * 1.6);
          ctx.fill();
          ctx.globalAlpha = 1;
          break;
        default:
          break;
      }
    }
  }
}

/** Short-lived world-space text ("+10", "x3!"). */
export class FloatTexts {
  constructor() {
    this.items = [];
  }

  clear() {
    this.items.length = 0;
  }

  add(x, y, text, o = {}) {
    if (this.items.length > 40) this.items.shift();
    this.items.push({ x, y, text, color: o.color || '#ffffff', size: o.size || 18, life: o.life || 0.8, max: o.life || 0.8, vy: o.vy ?? -60, bold: o.bold ?? true });
  }

  update(dt) {
    for (const t of this.items) {
      t.life -= dt;
      t.y += t.vy * dt;
      t.vy *= Math.exp(-2.5 * dt);
    }
    this.items = this.items.filter((t) => t.life > 0);
  }

  render(ctx) {
    if (!this.items.length) return;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const t of this.items) {
      const p = 1 - t.life / t.max;
      const pop = p < 0.15 ? 0.6 + (p / 0.15) * 0.5 : 1.1 - Math.min(0.1, (p - 0.15));
      ctx.globalAlpha = Math.min(1, (t.life / t.max) * 2.2);
      ctx.font = `${t.bold ? 700 : 600} ${Math.round(t.size * pop)}px Fredoka, 'Trebuchet MS', sans-serif`;
      ctx.lineWidth = 4;
      ctx.strokeStyle = 'rgba(8,10,30,0.75)';
      ctx.strokeText(t.text, t.x, t.y);
      ctx.fillStyle = t.color;
      ctx.fillText(t.text, t.x, t.y);
    }
    ctx.globalAlpha = 1;
  }
}
