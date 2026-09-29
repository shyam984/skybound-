// Hazards. Every hazard has a predictable pattern, a warning telegraph
// before it becomes dangerous, and can be disabled by Nova's Burst.
// To add a hazard type: add a class with update/collide/draw/distanceTo and
// register it in HAZARD_TYPES.

import { TAU, segmentDist2, dist2, clamp } from '../core/math.js';
import { glow, circle, rgba, polyPath, starPath } from '../render/draw.js';

export const WARN_TIME = 1.3; // two clear pulses before activation

const DANGER = '#ff4d6a';
const DANGER_HOT = '#ffd0d8';

class Hazard {
  constructor(def) {
    this.def = def;
    this.at = def.at || 0;
    this.lt = 0; // local time since spawn
    this.state = 'pending';
    this.disabled = 0;
    this.warnBeeps = 0;
  }

  /** Global play-time driven lifecycle. Returns 'warn' on warning start. */
  tick(dt, time) {
    let evt = null;
    if (this.state === 'pending' && time >= this.at) {
      this.state = 'warning';
      this.lt = 0;
      evt = 'warn';
    }
    if (this.state === 'pending') return evt;
    this.lt += dt;
    if (this.state === 'warning' && this.lt >= WARN_TIME) this.state = 'active';
    if (this.disabled > 0) this.disabled -= dt;
    this.update(dt);
    return evt;
  }

  get dangerous() {
    return this.state === 'active' && this.disabled <= 0 && this.isOn();
  }

  isOn() {
    return true;
  }

  get visible() {
    return this.state !== 'pending';
  }

  warnAlpha() {
    // Two pulses during the warning window.
    const p = this.lt / WARN_TIME;
    return 0.35 + 0.65 * Math.abs(Math.sin(p * Math.PI * 2));
  }

  update() {}
  collide() {
    return false;
  }
  distanceTo() {
    return Infinity;
  }
  draw() {}
}

// ------------------------------------------------------------------ Laser
class Laser extends Hazard {
  constructor(def) {
    super(def);
    this.len = def.len || 300;
    this.ang = ((def.angle || 0) * Math.PI) / 180;
    this.move = def.move || { dx: 0, dy: 0, period: 6 };
    this.update(0);
  }

  update() {
    const m = this.move;
    const ph = Math.sin(((this.lt / (m.period || 6)) + (m.phase || 0)) * TAU);
    const cx = this.def.x + (m.dx || 0) * ph;
    const cy = this.def.y + (m.dy || 0) * ph;
    const hx = Math.cos(this.ang) * this.len * 0.5;
    const hy = Math.sin(this.ang) * this.len * 0.5;
    this.ax = cx - hx;
    this.ay = cy - hy;
    this.bx = cx + hx;
    this.by = cy + hy;
    this.cx = cx;
    this.cy = cy;
  }

  collide(px, py, pr) {
    return segmentDist2(px, py, this.ax, this.ay, this.bx, this.by) < (pr + 6) ** 2;
  }

  distanceTo(px, py) {
    return Math.sqrt(segmentDist2(px, py, this.ax, this.ay, this.bx, this.by));
  }

  draw(ctx, t, q) {
    const off = this.disabled > 0;
    if (this.state === 'warning') {
      // Show the full sweep path and the beam ghost.
      const m = this.move;
      ctx.strokeStyle = rgba(DANGER, 0.18);
      ctx.lineWidth = 2;
      ctx.setLineDash([8, 10]);
      for (const s of [-1, 1]) {
        const ox = (m.dx || 0) * s;
        const oy = (m.dy || 0) * s;
        ctx.beginPath();
        ctx.moveTo(this.def.x + ox - Math.cos(this.ang) * this.len * 0.5, this.def.y + oy - Math.sin(this.ang) * this.len * 0.5);
        ctx.lineTo(this.def.x + ox + Math.cos(this.ang) * this.len * 0.5, this.def.y + oy + Math.sin(this.ang) * this.len * 0.5);
        ctx.stroke();
      }
      ctx.setLineDash([]);
      ctx.strokeStyle = rgba(DANGER, this.warnAlpha());
      ctx.lineWidth = 4;
      ctx.setLineDash([14, 10]);
      ctx.beginPath();
      ctx.moveTo(this.ax, this.ay);
      ctx.lineTo(this.bx, this.by);
      ctx.stroke();
      ctx.setLineDash([]);
    } else if (!off) {
      const flick = 0.85 + Math.sin(t * 40) * 0.15;
      if (q !== 'low') {
        const n = 5;
        for (let i = 0; i <= n; i++) {
          const k = i / n;
          glow(ctx, this.ax + (this.bx - this.ax) * k, this.ay + (this.by - this.ay) * k, 26, DANGER, 0.35 * flick);
        }
      }
      ctx.lineCap = 'round';
      ctx.strokeStyle = rgba(DANGER, 0.9);
      ctx.lineWidth = 11;
      ctx.beginPath();
      ctx.moveTo(this.ax, this.ay);
      ctx.lineTo(this.bx, this.by);
      ctx.stroke();
      ctx.strokeStyle = DANGER_HOT;
      ctx.lineWidth = 4 * flick;
      ctx.stroke();
    } else {
      ctx.strokeStyle = 'rgba(160,160,200,0.35)';
      ctx.lineWidth = 3;
      ctx.setLineDash([4, 8]);
      ctx.beginPath();
      ctx.moveTo(this.ax, this.ay);
      ctx.lineTo(this.bx, this.by);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    // emitters
    for (const [x, y] of [[this.ax, this.ay], [this.bx, this.by]]) {
      ctx.fillStyle = '#2a2350';
      circle(ctx, x, y, 11);
      ctx.fill();
      ctx.fillStyle = off ? '#777a9a' : DANGER;
      circle(ctx, x, y, 6);
      ctx.fill();
      ctx.strokeStyle = '#e8e6ff';
      ctx.lineWidth = 2;
      circle(ctx, x, y, 11);
      ctx.stroke();
    }
  }
}

// ------------------------------------------------------------------ Rotating barrier
class Barrier extends Hazard {
  constructor(def) {
    super(def);
    this.len = def.len || 200;
    this.arms = def.arms || 2;
    this.speed = def.speed || 1;
    this.inner = 46;
    this.angle = def.phase || 0;
  }

  update(dt) {
    if (this.disabled <= 0 || this.state !== 'active') this.angle += this.speed * dt * (this.state === 'warning' ? 0.4 : 1);
  }

  segments() {
    const out = [];
    for (let i = 0; i < this.arms; i++) {
      const a = this.angle + (i * TAU) / this.arms;
      const c = Math.cos(a);
      const s = Math.sin(a);
      out.push([this.def.x + c * this.inner, this.def.y + s * this.inner, this.def.x + c * this.len, this.def.y + s * this.len]);
    }
    return out;
  }

  collide(px, py, pr) {
    for (const [ax, ay, bx, by] of this.segments()) {
      if (segmentDist2(px, py, ax, ay, bx, by) < (pr + 8) ** 2) return true;
    }
    return false;
  }

  distanceTo(px, py) {
    return Math.max(0, Math.sqrt(dist2(px, py, this.def.x, this.def.y)) - this.len);
  }

  draw(ctx, t, q) {
    const { x, y } = this.def;
    const off = this.disabled > 0;
    if (this.state === 'warning') {
      ctx.strokeStyle = rgba(DANGER, this.warnAlpha() * 0.8);
      ctx.lineWidth = 3;
      ctx.setLineDash([12, 10]);
      circle(ctx, x, y, this.len);
      ctx.stroke();
      ctx.setLineDash([]);
    } else if (!off) {
      ctx.strokeStyle = rgba(DANGER, 0.12);
      ctx.lineWidth = 2;
      circle(ctx, x, y, this.len);
      ctx.stroke();
    }
    const segs = this.segments();
    for (const [ax, ay, bx, by] of segs) {
      if (this.state === 'warning') {
        ctx.strokeStyle = rgba(DANGER, this.warnAlpha() * 0.6);
        ctx.lineWidth = 12;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(ax, ay);
        ctx.lineTo(bx, by);
        ctx.stroke();
        continue;
      }
      if (!off && q !== 'low') glow(ctx, (ax + bx) / 2, (ay + by) / 2, this.len * 0.5, '#ff7a3a', 0.25);
      ctx.lineCap = 'round';
      ctx.strokeStyle = off ? '#5d5a7a' : '#ff7a3a';
      ctx.lineWidth = 16;
      ctx.beginPath();
      ctx.moveTo(ax, ay);
      ctx.lineTo(bx, by);
      ctx.stroke();
      ctx.strokeStyle = off ? '#8b88a8' : '#ffd08a';
      ctx.lineWidth = 6;
      ctx.stroke();
      // chevrons
      if (!off) {
        ctx.fillStyle = '#2a1238';
        const n = Math.floor(this.len / 40);
        for (let i = 1; i < n; i++) {
          const k = i / n;
          circle(ctx, ax + (bx - ax) * k, ay + (by - ay) * k, 2.5);
          ctx.fill();
        }
      }
    }
    // hub
    ctx.fillStyle = '#2a2350';
    circle(ctx, x, y, 30);
    ctx.fill();
    ctx.strokeStyle = off ? '#8b88a8' : '#ff7a3a';
    ctx.lineWidth = 5;
    circle(ctx, x, y, 30);
    ctx.stroke();
    ctx.fillStyle = off ? '#777a9a' : '#ffd08a';
    polyPath(ctx, x, y, 6, 12, this.angle);
    ctx.fill();
  }
}

// ------------------------------------------------------------------ Drone
class Drone extends Hazard {
  constructor(def) {
    super(def);
    let pts = def.path.map(([x, y]) => ({ x, y }));
    if (pts.length === 2) pts = [pts[0], pts[1]]; // ping-pong handled as loop a→b→a
    this.pts = pts;
    this.closed = def.path.length > 2;
    const loop = this.closed ? [...pts, pts[0]] : [pts[0], pts[1], pts[0]];
    this.loop = loop;
    this.lengths = [];
    this.total = 0;
    for (let i = 0; i < loop.length - 1; i++) {
      const l = Math.hypot(loop[i + 1].x - loop[i].x, loop[i + 1].y - loop[i].y);
      this.lengths.push(l);
      this.total += l;
    }
    this.speed = def.speed || 120;
    this.r = 19;
    this.update(0);
  }

  posAt(s) {
    s = ((s % this.total) + this.total) % this.total;
    for (let i = 0; i < this.lengths.length; i++) {
      if (s <= this.lengths[i]) {
        const k = s / (this.lengths[i] || 1);
        const a = this.loop[i];
        const b = this.loop[i + 1];
        return { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k, dx: b.x - a.x, dy: b.y - a.y };
      }
      s -= this.lengths[i];
    }
    return { x: this.loop[0].x, y: this.loop[0].y, dx: 1, dy: 0 };
  }

  update() {
    const s = (this.def.offset || 0) * this.total + this.lt * this.speed;
    const p = this.posAt(s);
    this.x = p.x;
    this.y = p.y;
    this.dir = Math.atan2(p.dy, p.dx);
  }

  collide(px, py, pr) {
    return dist2(px, py, this.x, this.y) < (pr + this.r) ** 2;
  }

  distanceTo(px, py) {
    return Math.max(0, Math.sqrt(dist2(px, py, this.x, this.y)) - this.r);
  }

  draw(ctx, t, q) {
    const off = this.disabled > 0;
    // patrol route
    ctx.strokeStyle = rgba(DANGER, this.state === 'warning' ? this.warnAlpha() * 0.5 : 0.14);
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 12]);
    ctx.beginPath();
    this.pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
    if (this.closed) ctx.closePath();
    ctx.stroke();
    ctx.setLineDash([]);
    if (this.state === 'warning') {
      ctx.strokeStyle = rgba(DANGER, this.warnAlpha());
      ctx.lineWidth = 3;
      circle(ctx, this.x, this.y, this.r + 8 + (1 - this.warnAlpha()) * 10);
      ctx.stroke();
      ctx.globalAlpha = 0.35;
    }
    const bob = Math.sin(t * 6 + this.at) * 2;
    const x = this.x;
    const y = this.y + bob;
    ctx.fillStyle = 'rgba(5,8,24,0.3)';
    ctx.beginPath();
    ctx.ellipse(this.x, this.y + 26, 14, 5, 0, 0, TAU);
    ctx.fill();
    if (!off && this.state === 'active' && q !== 'low') glow(ctx, x, y, 44, DANGER, 0.35);
    // rotor ring
    ctx.strokeStyle = off ? '#8b88a8' : '#ffb3c0';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.ellipse(x, y - 14, 20, 5, 0, 0, TAU);
    ctx.stroke();
    ctx.lineWidth = 2;
    const ra = t * 30;
    ctx.beginPath();
    ctx.moveTo(x + Math.cos(ra) * 18, y - 14 + Math.sin(ra) * 4);
    ctx.lineTo(x - Math.cos(ra) * 18, y - 14 - Math.sin(ra) * 4);
    ctx.stroke();
    // body
    ctx.fillStyle = off ? '#55557a' : '#2d2458';
    circle(ctx, x, y, this.r);
    ctx.fill();
    ctx.strokeStyle = off ? '#777a9a' : DANGER;
    ctx.lineWidth = 3;
    circle(ctx, x, y, this.r);
    ctx.stroke();
    // hazard stripes
    ctx.fillStyle = off ? '#777a9a' : '#ffd34a';
    for (let i = 0; i < 4; i++) {
      const a = (i * TAU) / 4 + Math.PI / 4;
      polyPath(ctx, x + Math.cos(a) * (this.r - 4), y + Math.sin(a) * (this.r - 4), 3, 4, a);
      ctx.fill();
    }
    // eye
    ctx.fillStyle = '#10081e';
    circle(ctx, x, y, 9);
    ctx.fill();
    ctx.fillStyle = off ? '#777a9a' : DANGER;
    circle(ctx, x + Math.cos(this.dir) * 3, y + Math.sin(this.dir) * 3, 5);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    circle(ctx, x + Math.cos(this.dir) * 3 - 1.5, y + Math.sin(this.dir) * 3 - 1.5, 1.6);
    ctx.fill();
    ctx.globalAlpha = 1;
    if (off) sparks(ctx, x, y, t);
  }
}

// ------------------------------------------------------------------ Energy mine
class Mine extends Hazard {
  constructor(def) {
    super(def);
    this.orbit = def.r || 50;
    this.speed = def.speed || 1.2;
    this.r = 17;
    this.update(0);
  }

  update() {
    const a = (this.def.phase || 0) + this.lt * this.speed;
    this.x = this.def.x + Math.cos(a) * this.orbit;
    this.y = this.def.y + Math.sin(a) * this.orbit;
  }

  collide(px, py, pr) {
    return dist2(px, py, this.x, this.y) < (pr + this.r) ** 2;
  }

  distanceTo(px, py) {
    return Math.max(0, Math.sqrt(dist2(px, py, this.x, this.y)) - this.r);
  }

  draw(ctx, t, q) {
    const off = this.disabled > 0;
    ctx.strokeStyle = rgba(DANGER, this.state === 'warning' ? this.warnAlpha() * 0.6 : 0.12);
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 9]);
    circle(ctx, this.def.x, this.def.y, this.orbit);
    ctx.stroke();
    ctx.setLineDash([]);
    if (this.state === 'warning') {
      ctx.strokeStyle = rgba(DANGER, this.warnAlpha());
      ctx.lineWidth = 3;
      circle(ctx, this.x, this.y, this.r + 10);
      ctx.stroke();
      ctx.globalAlpha = 0.35;
    }
    const pulse = 1 + Math.sin(t * 8 + this.at) * 0.08;
    if (!off && this.state === 'active' && q !== 'low') glow(ctx, this.x, this.y, 40 * pulse, '#ff3fa0', 0.4);
    ctx.fillStyle = off ? '#55557a' : '#ff3fa0';
    starPath(ctx, this.x, this.y, 8, this.r * 1.25 * pulse, this.r * 0.8, t * 1.5);
    ctx.fill();
    ctx.fillStyle = off ? '#777a9a' : '#3a0d2e';
    circle(ctx, this.x, this.y, this.r * 0.62);
    ctx.fill();
    const blink = Math.sin(t * 10 + this.at) > 0;
    ctx.fillStyle = off ? '#9a9ab8' : blink ? '#ffffff' : '#ff8ad0';
    circle(ctx, this.x, this.y, 4);
    ctx.fill();
    ctx.globalAlpha = 1;
    if (off) sparks(ctx, this.x, this.y, t);
  }
}

// ------------------------------------------------------------------ Energy storm
class Storm extends Hazard {
  constructor(def) {
    super(def);
    this.r = def.r || 140;
    this.on = def.on || 3;
    this.off = def.off || 3;
    this.phase = def.phase || 0;
  }

  cycle() {
    const period = this.on + this.off;
    return ((this.lt - WARN_TIME + this.phase) % period + period) % period;
  }

  isOn() {
    return this.cycle() < this.on;
  }

  /** Seconds until the storm turns on (for the warning ring). */
  timeToOn() {
    const period = this.on + this.off;
    const c = this.cycle();
    return c < this.on ? 0 : period - c;
  }

  collide(px, py, pr) {
    return dist2(px, py, this.def.x, this.def.y) < (this.r + pr * 0.4) ** 2;
  }

  distanceTo(px, py) {
    return Math.max(0, Math.sqrt(dist2(px, py, this.def.x, this.def.y)) - this.r);
  }

  draw(ctx, t, q) {
    const { x, y } = this.def;
    const off = this.disabled > 0;
    const on = this.state === 'active' && this.isOn() && !off;
    const soon = this.state === 'warning' || (!on && this.timeToOn() < 1.2 && !off);
    // zone
    ctx.fillStyle = on ? 'rgba(150,40,190,0.35)' : 'rgba(150,40,190,0.08)';
    circle(ctx, x, y, this.r);
    ctx.fill();
    if (on) {
      if (q !== 'low') glow(ctx, x, y, this.r * 1.3, '#b34dff', 0.45);
      // swirling clouds
      for (let i = 0; i < 7; i++) {
        const a = t * 1.6 + (i * TAU) / 7;
        const rr = this.r * (0.35 + (i % 3) * 0.2);
        ctx.fillStyle = i % 2 ? 'rgba(210,140,255,0.35)' : 'rgba(90,30,140,0.5)';
        circle(ctx, x + Math.cos(a) * rr, y + Math.sin(a) * rr, this.r * 0.28);
        ctx.fill();
      }
      // lightning
      ctx.strokeStyle = '#fff2ff';
      ctx.lineWidth = 2.5;
      const seed = Math.floor(t * 8);
      for (let b = 0; b < 2; b++) {
        let a = ((seed * 1.7 + b * 2.3) % TAU);
        let px = x;
        let py = y;
        ctx.beginPath();
        ctx.moveTo(px, py);
        for (let k = 1; k <= 4; k++) {
          a += Math.sin(seed * 3.1 + k * 1.9 + b) * 0.7;
          px = x + Math.cos(a) * (this.r * k) / 4.2;
          py = y + Math.sin(a) * (this.r * k) / 4.2;
          ctx.lineTo(px, py);
        }
        ctx.stroke();
      }
    }
    ctx.strokeStyle = on ? rgba(DANGER, 0.9) : soon ? rgba(DANGER, 0.35 + 0.65 * Math.abs(Math.sin(t * 7))) : 'rgba(200,150,255,0.35)';
    ctx.lineWidth = on ? 4 : 3;
    ctx.setLineDash(on ? [] : [10, 10]);
    ctx.lineDashOffset = -t * 20;
    circle(ctx, x, y, this.r);
    ctx.stroke();
    ctx.setLineDash([]);
    // countdown pips so timing is readable without colour
    if (!on && !off && this.state === 'active') {
      const left = clamp(this.timeToOn(), 0, 9);
      if (left < 3) {
        ctx.fillStyle = 'rgba(255,255,255,0.85)';
        ctx.font = '700 22px Fredoka, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(String(Math.ceil(left)), x, y);
      }
    }
  }
}

function sparks(ctx, x, y, t) {
  ctx.strokeStyle = '#bff8ff';
  ctx.lineWidth = 1.5;
  for (let i = 0; i < 3; i++) {
    const a = t * 13 + i * 2.1;
    if (Math.sin(t * 20 + i) < 0.2) continue;
    ctx.beginPath();
    ctx.moveTo(x + Math.cos(a) * 10, y + Math.sin(a) * 10);
    ctx.lineTo(x + Math.cos(a + 0.4) * 22, y + Math.sin(a + 0.4) * 22);
    ctx.stroke();
  }
}

export const HAZARD_TYPES = { laser: Laser, barrier: Barrier, drone: Drone, mine: Mine, storm: Storm };

export function createHazard(def) {
  const C = HAZARD_TYPES[def.type];
  return C ? new C(def) : null;
}
