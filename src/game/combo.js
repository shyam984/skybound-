// Combo: consecutive pickups raise the count; the multiplier steps up at
// fixed milestones (x2 at 5, x3 at 10, x4 at 20, x5 at 30). The combo timer
// resets on each pickup and the combo breaks when it runs out.

import { COMBO_TIERS } from '../data/challenges.js';

export function multForCount(count) {
  let m = 1;
  for (const t of COMBO_TIERS) if (count >= t.at) m = t.mult;
  return m;
}

export class Combo {
  constructor(window = 3) {
    this.window = window;
    this.count = 0;
    this.timer = 0;
    this.mult = 1;
    this.drainMult = 1; // Echo's ability slows the drain
  }

  /** Register pickups. Returns the new multiplier if a tier was reached, else 0. */
  add(n = 1) {
    const before = this.mult;
    this.count += n;
    this.timer = this.window;
    this.mult = multForCount(this.count);
    return this.mult > before ? this.mult : 0;
  }

  refill() {
    if (this.count > 0) this.timer = this.window;
  }

  /** Returns true when the combo just broke. */
  update(dt) {
    if (this.count <= 0) return false;
    this.timer -= dt * this.drainMult;
    if (this.timer <= 0) {
      this.reset();
      return true;
    }
    return false;
  }

  reset() {
    const had = this.count > 0;
    this.count = 0;
    this.timer = 0;
    this.mult = 1;
    return had;
  }

  get progress() {
    return this.count > 0 ? Math.max(0, this.timer / this.window) : 0;
  }
}
