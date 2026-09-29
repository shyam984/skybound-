// The single requestAnimationFrame loop for the whole game.
// Every scene, tween and animated UI element is driven from here so there is
// never more than one loop running.

export class Loop {
  constructor(tick) {
    this.tick = tick;
    this.running = false;
    this.raf = 0;
    this.last = 0;
    this.errors = new Set();
    this._frame = this._frame.bind(this);
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.last = performance.now();
    this.raf = requestAnimationFrame(this._frame);
  }

  stop() {
    this.running = false;
    cancelAnimationFrame(this.raf);
  }

  _frame(now) {
    if (!this.running) return;
    let dt = (now - this.last) / 1000;
    this.last = now;
    if (!(dt > 0)) dt = 0;
    if (dt > 0.1) dt = 0.1; // avoid huge steps after tab switches
    try {
      this.tick(dt, now / 1000);
    } catch (err) {
      // Log each distinct error once so a bug can't flood the console at 60fps.
      const key = String(err && err.stack ? err.stack : err);
      if (!this.errors.has(key)) {
        this.errors.add(key);
        console.error('[loop]', err);
      }
    }
    this.raf = requestAnimationFrame(this._frame);
  }
}

/** Lightweight tween manager ticked by the main loop (used by UI counters etc). */
export class Tweens {
  constructor() {
    this.list = [];
  }

  add({ duration = 0.3, delay = 0, update, done, ease = (t) => t }) {
    const tw = { duration: Math.max(0.001, duration), delay, t: 0, update, done, ease, dead: false };
    this.list.push(tw);
    return () => {
      tw.dead = true;
    };
  }

  update(dt) {
    if (!this.list.length) return;
    for (const tw of this.list) {
      if (tw.dead) continue;
      if (tw.delay > 0) {
        tw.delay -= dt;
        continue;
      }
      tw.t += dt;
      const p = Math.min(1, tw.t / tw.duration);
      try {
        tw.update && tw.update(tw.ease(p), p);
        if (p >= 1) {
          tw.dead = true;
          tw.done && tw.done();
        }
      } catch (err) {
        tw.dead = true;
        console.error('[tween]', err);
      }
    }
    this.list = this.list.filter((t) => !t.dead);
  }

  clear() {
    this.list.length = 0;
  }
}
