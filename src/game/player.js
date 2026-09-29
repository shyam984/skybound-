// The player-controlled Nex during challenges: acceleration-based floating
// movement, shields + invulnerability, expressions, trail and afterimages.

import { NEX, getNexGameplay, getAbilityParams } from '../data/nex.js';
import { clamp, damp, rand, TAU } from '../core/math.js';
import { drawNex } from '../render/nexRenderer.js';
import { glow, circle, rgba } from '../render/draw.js';

export class Player {
  constructor({ nexId, level, palette, x, y, trail, quality }) {
    this.id = nexId;
    this.def = NEX[nexId];
    this.level = level;
    this.palette = palette;
    this.trailStyle = trail; // equipped trail cosmetic or null
    this.quality = quality;
    this.g = getNexGameplay(nexId, level);
    this.ability = getAbilityParams(nexId, level);
    this.r = this.g.radius;
    this.hitR = this.r * 0.72; // forgiving hitbox
    this.x = x;
    this.y = y;
    this.vx = 0;
    this.vy = 0;
    this.speedMult = 1;
    this.magnetBoost = 0;
    this.phased = false;
    this.shields = 3;
    this.maxShields = 3;
    this.invuln = 0;
    this.abilityCd = 0; // starts ready
    this.abilityActive = 0;
    this.t = rand(0, 10);
    this.blink = 0;
    this.nextBlink = rand(1.5, 4);
    this.expr = 'idle';
    this.exprT = 0;
    this.lean = 0;
    this.look = { x: 0, y: 0 };
    this.coreBoost = 0;
    this.squash = 0;
    this.trail = [];
    this.trailTimer = 0;
    this.after = [];
    this.celebrate = 0;
    this.dissolve = 0;
    this.edgeGlow = 0;
  }

  get speed01() {
    return clamp(Math.hypot(this.vx, this.vy) / this.g.maxSpeed, 0, 1.5);
  }

  setExpr(expr, time = 0.4) {
    const priority = { hurt: 3, sad: 3, excited: 2, happy: 1, focus: 1, idle: 0 };
    if (this.exprT > 0 && priority[expr] < priority[this.expr]) return;
    this.expr = expr;
    this.exprT = time;
  }

  update(dt, move, arena, particles) {
    this.t += dt;
    // --- movement: acceleration toward input direction, friction otherwise
    const maxSpeed = this.g.maxSpeed * this.speedMult;
    const accel = this.g.accel * (this.speedMult > 1 ? 1.25 : 1);
    if (move.mag > 0) {
      const tx = move.x * maxSpeed * move.mag;
      const ty = move.y * maxSpeed * move.mag;
      const dx = tx - this.vx;
      const dy = ty - this.vy;
      const d = Math.hypot(dx, dy);
      const step = accel * dt;
      if (d <= step) {
        this.vx = tx;
        this.vy = ty;
      } else {
        this.vx += (dx / d) * step;
        this.vy += (dy / d) * step;
      }
    } else {
      const k = Math.exp(-this.g.friction * dt);
      this.vx *= k;
      this.vy *= k;
    }
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.constrain(arena, dt);

    // --- presentation state
    const sp = this.speed01;
    this.lean = damp(this.lean, clamp(this.vx / this.g.maxSpeed, -1, 1) * 0.28, 10, dt);
    const lx = clamp(this.vx / (this.g.maxSpeed * 0.6), -1, 1);
    const ly = clamp(this.vy / (this.g.maxSpeed * 0.6), -1, 1);
    this.look.x = damp(this.look.x, lx, 8, dt);
    this.look.y = damp(this.look.y, ly, 8, dt);
    this.coreBoost = damp(this.coreBoost, sp * 0.4 + (this.abilityActive > 0 ? 0.6 : 0), 6, dt);
    this.squash = damp(this.squash, 0, 10, dt);
    if (this.invuln > 0) this.invuln -= dt;
    if (this.exprT > 0) {
      this.exprT -= dt;
      if (this.exprT <= 0) this.expr = 'idle';
    }
    this.nextBlink -= dt;
    if (this.nextBlink <= 0) {
      this.blink = 1;
      this.nextBlink = rand(2, 4.5);
    }
    this.blink = Math.max(0, this.blink - dt * 7);
    if (this.id === 'flux') {
      const cyc = this.t % 6.5;
      this.dissolve = cyc < 0.6 ? Math.sin((cyc / 0.6) * Math.PI) : 0;
    }

    // --- trail
    this.trailTimer -= dt;
    const trailOn = this.quality !== 'low';
    if (trailOn && this.trailTimer <= 0 && (sp > 0.35 || this.abilityActive > 0)) {
      this.trailTimer = this.abilityActive > 0 ? 0.012 : 0.03;
      this.emitTrail(particles, sp);
    }
    if ((this.id === 'echo' || this.id === 'flux') && trailOn) {
      this.afterTimer = (this.afterTimer || 0) - dt;
      if (this.afterTimer <= 0 && sp > 0.3) {
        this.afterTimer = this.abilityActive > 0 ? 0.05 : 0.1;
        this.after.push({ x: this.x, y: this.y, life: 0.35, lean: this.lean });
        if (this.after.length > 8) this.after.shift();
      }
    }
    for (const a of this.after) a.life -= dt;
    this.after = this.after.filter((a) => a.life > 0);
  }

  emitTrail(particles, sp) {
    const P = this.palette;
    const boost = this.abilityActive > 0 ? 1.6 : 1;
    const back = { x: this.x - this.vx * 0.02, y: this.y - this.vy * 0.02 + 8 };
    const cos = this.trailStyle;
    if (cos) {
      const color = cos.colors[Math.floor(this.t * 12) % cos.colors.length];
      particles.spawn({ x: back.x + rand(-5, 5), y: back.y + rand(-5, 5), vx: rand(-20, 20), vy: rand(-20, 20), life: 0.5 * boost, size: cos.shape === 'ring' ? 2 : 3, size2: cos.shape === 'ring' ? 9 : 0.5, color, type: cos.shape === 'star' ? 'star' : cos.shape === 'ring' ? 'ring' : 'dot', drag: 2 });
      return;
    }
    switch (this.id) {
      case 'bolt':
        particles.spawn({ x: back.x, y: back.y, vx: -this.vx * 0.1, vy: -this.vy * 0.1, life: 0.28 * boost, size: 5 * boost, size2: 1, color: P.trail, type: 'dot', drag: 4 });
        if (this.abilityActive > 0) particles.spawn({ x: back.x + rand(-10, 10), y: back.y + rand(-10, 10), vx: rand(-60, 60), vy: rand(-60, 60), life: 0.25, size: 2, color: '#ffffff', type: 'spark', width: 2, drag: 5 });
        break;
      case 'luma':
        particles.spawn({ x: back.x + rand(-8, 8), y: back.y + rand(-8, 8), vx: rand(-15, 15), vy: rand(-25, 5), life: 0.6, size: 2.5, size2: 0.5, color: Math.random() < 0.5 ? P.accent : P.glow, type: 'dot', drag: 1.5 });
        break;
      case 'echo':
        particles.spawn({ x: back.x, y: back.y, vx: 0, vy: 0, life: 0.35 * boost, size: 4, size2: 1, color: P.accent, type: 'dot', drag: 0 });
        break;
      case 'flux':
        particles.spawn({ x: back.x + rand(-8, 8), y: back.y + rand(-4, 4), vx: rand(-20, 20), vy: rand(10, 40), life: 0.5, size: 3, size2: 1, color: Math.random() < 0.5 ? P.light : P.accent, type: 'square', drag: 1, alpha: 0.7 });
        break;
      case 'nova':
        particles.spawn({ x: back.x + rand(-6, 6), y: back.y + rand(-6, 6), vx: -this.vx * 0.15 + rand(-40, 40), vy: -this.vy * 0.15 + rand(-40, 40), life: 0.35, size: 2, color: Math.random() < 0.5 ? P.spike : '#ffffff', type: 'spark', width: 2, drag: 3 });
        break;
      default:
        break;
    }
    void sp;
  }

  /** Keep the player inside the arena's rounded rectangle with a soft edge. */
  constrain(arena, dt) {
    const hw = arena.w / 2;
    const hh = arena.h / 2;
    const cr = arena.corner;
    const margin = this.r + 6;
    const ax = Math.abs(this.x);
    const ay = Math.abs(this.y);
    const qx = ax - (hw - cr);
    const qy = ay - (hh - cr);
    const outside = Math.hypot(Math.max(qx, 0), Math.max(qy, 0));
    const sd = outside + Math.min(Math.max(qx, qy), 0) - cr;
    let nx;
    let ny;
    if (qx > 0 && qy > 0) {
      nx = (qx / (outside || 1)) * Math.sign(this.x);
      ny = (qy / (outside || 1)) * Math.sign(this.y);
    } else if (qx > qy) {
      nx = Math.sign(this.x) || 1;
      ny = 0;
    } else {
      nx = 0;
      ny = Math.sign(this.y) || 1;
    }
    const soft = 40;
    const pen = sd + margin + soft; // > 0 when inside the soft band
    this.edgeGlow = clamp(pen / soft, 0, 1);
    this.edgeNormal = { x: nx, y: ny };
    if (pen > 0) {
      // Slow outward velocity and push back gently.
      const vn = this.vx * nx + this.vy * ny;
      if (vn > 0) {
        const k = 1 - Math.min(1, (pen / soft) * 0.9) * Math.min(1, dt * 14);
        this.vx -= nx * vn * (1 - k);
        this.vy -= ny * vn * (1 - k);
      }
      this.vx -= nx * pen * 25 * dt;
      this.vy -= ny * pen * 25 * dt;
    }
    const hard = sd + margin;
    if (hard > 0) {
      this.x -= nx * hard;
      this.y -= ny * hard;
    }
  }

  canBeHit() {
    return this.invuln <= 0 && !this.phased;
  }

  /** Take one shield of damage. Returns true if the hit landed. */
  hit(fromX, fromY) {
    if (!this.canBeHit()) return false;
    this.shields = Math.max(0, this.shields - 1);
    this.invuln = this.g.invuln;
    const dx = this.x - fromX;
    const dy = this.y - fromY;
    const d = Math.hypot(dx, dy) || 1;
    this.vx = (dx / d) * this.g.knockback;
    this.vy = (dy / d) * this.g.knockback;
    this.setExpr('hurt', 0.7);
    this.squash = 0.18;
    return true;
  }

  draw(ctx, quality) {
    const P = this.palette;
    const t = this.t;
    // afterimages (Echo / Flux)
    for (const a of this.after) {
      drawNex(ctx, this.id, { x: a.x, y: a.y, t, lean: a.lean, alpha: (a.life / 0.35) * 0.35, flat: this.id === 'echo' ? P.accent : P.light, quality });
    }
    const hover = Math.sin(t * 3.2) * 3;
    // shadow on the ground
    ctx.fillStyle = 'rgba(5,8,24,0.35)';
    ctx.beginPath();
    ctx.ellipse(this.x, this.y + 30, 17 - hover * 0.6, 6, 0, 0, TAU);
    ctx.fill();
    let alpha = 1;
    if (this.invuln > 0 && !this.phased) alpha = Math.sin(this.invuln * 40) > 0 ? 0.35 : 0.9;
    if (this.invuln > 0) {
      ctx.strokeStyle = rgba('#8fe9ff', 0.6 * Math.min(1, this.invuln * 2));
      ctx.lineWidth = 2;
      circle(ctx, this.x, this.y + hover, this.r * 1.7);
      ctx.stroke();
    }
    let cel = 0;
    if (this.celebrate > 0) cel = this.celebrate;
    const spin = this.def.celebrate === 'spin' && cel > 0 ? (1 - cel) * TAU * 3 : 0;
    drawNex(ctx, this.id, {
      x: this.x,
      y: this.y + hover - (cel > 0 ? Math.sin((1 - cel) * Math.PI) * 18 : 0),
      t,
      lean: this.lean + spin,
      look: this.look,
      blink: this.blink,
      expr: this.expr,
      core: this.coreBoost,
      speed: Math.min(1, this.speed01),
      ability: this.abilityActive > 0,
      palette: P,
      alpha,
      squash: this.squash,
      quality,
      dissolve: this.dissolve,
      nearby: this.nearby || 0,
    });
    if (this.phased) glow(ctx, this.x, this.y, this.r * 3, P.accent || P.glow, 0.35);
  }
}
