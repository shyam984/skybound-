// Canvas view: handles DPR scaling and resize, plus a Camera with
// smoothing, zoom punches and (reduced-motion-aware) screen shake.

import { damp, rand } from '../core/math.js';

const DPR_CAP = { low: 1, medium: 1.5, high: 2 };

export class CanvasView {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false });
    this.w = 1;
    this.h = 1;
    this.dpr = 1;
    this.quality = 'high';
    this.resize();
  }

  setQuality(q) {
    this.quality = q;
    this.resize();
  }

  resize() {
    const w = Math.max(1, window.innerWidth);
    const h = Math.max(1, window.innerHeight);
    const dpr = Math.min(DPR_CAP[this.quality] || 2, window.devicePixelRatio || 1);
    this.w = w;
    this.h = h;
    this.dpr = dpr;
    this.canvas.width = Math.round(w * dpr);
    this.canvas.height = Math.round(h * dpr);
  }

  /** Reset to screen space (CSS pixels). */
  screen() {
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
  }
}

export class Camera {
  constructor() {
    this.x = 0;
    this.y = 0;
    this.zoom = 1;
    this.baseZoom = 1;
    this.zoomOffset = 0; // multiplicative offset (speed zoom-out)
    this.punch = 0; // brief zoom-in on big moments
    this.shakeAmt = 0;
    this.sx = 0;
    this.sy = 0;
    this.reducedMotion = false;
  }

  snap(x, y) {
    this.x = x;
    this.y = y;
  }

  follow(tx, ty, dt, lambda = 6) {
    this.x = damp(this.x, tx, lambda, dt);
    this.y = damp(this.y, ty, lambda, dt);
  }

  shake(amount) {
    if (this.reducedMotion) return;
    this.shakeAmt = Math.min(14, Math.max(this.shakeAmt, amount));
  }

  zoomPunch(amount) {
    if (this.reducedMotion) return;
    this.punch = Math.max(this.punch, amount);
  }

  update(dt) {
    this.shakeAmt = damp(this.shakeAmt, 0, 9, dt);
    if (this.shakeAmt < 0.05) this.shakeAmt = 0;
    this.sx = this.shakeAmt ? rand(-this.shakeAmt, this.shakeAmt) : 0;
    this.sy = this.shakeAmt ? rand(-this.shakeAmt, this.shakeAmt) : 0;
    this.punch = damp(this.punch, 0, 4, dt);
    this.zoom = this.baseZoom * (1 + this.zoomOffset + this.punch);
  }

  /** Apply world transform: world (x, y) → screen. */
  apply(view) {
    const z = this.zoom * view.dpr;
    view.ctx.setTransform(z, 0, 0, z, (view.w / 2 - this.x * this.zoom + this.sx) * view.dpr, (view.h / 2 - this.y * this.zoom + this.sy) * view.dpr);
  }

  toScreen(view, x, y) {
    return { x: (x - this.x) * this.zoom + view.w / 2 + this.sx, y: (y - this.y) * this.zoom + view.h / 2 + this.sy };
  }

  toWorld(view, sx, sy) {
    return { x: (sx - view.w / 2) / this.zoom + this.x, y: (sy - view.h / 2) / this.zoom + this.y };
  }

  /** Visible world rectangle (for culling). */
  bounds(view) {
    const hw = view.w / 2 / this.zoom;
    const hh = view.h / 2 / this.zoom;
    return { x0: this.x - hw, x1: this.x + hw, y0: this.y - hh, y1: this.y + hh };
  }
}
