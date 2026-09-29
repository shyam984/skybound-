// Achievements: re-evaluated whenever something relevant happens.
// Unlocking grants coins automatically and raises a toast (queued while
// a challenge is being played so it never covers the action).

import { ACHIEVEMENTS } from '../data/achievements.js';

export class AchievementSystem {
  constructor(game) {
    this.game = game;
    const recheck = () => this.check();
    for (const evt of ['challenge:finished', 'building:built', 'nex:unlocked', 'decor:placed', 'mission:claimed', 'level:up']) {
      game.events.on(evt, recheck);
    }
    // Combo King can unlock mid-run.
    game.events.on('combo:tier', (e) => {
      if (e.mult >= 5 && game.data.stats.bestMultiplier < 5) {
        game.data.stats.bestMultiplier = 5;
        this.check();
      }
    });
    game.events.on('ability:used', () => {
      game.data.stats.abilitiesUsed += 1;
    });
  }

  list() {
    const d = this.game.data;
    return ACHIEVEMENTS.map((a) => {
      const value = Math.max(0, a.value(d) || 0);
      const unlocked = !!d.achievements[a.id]?.unlocked;
      return { ...a, value: Math.min(value, a.target), unlocked, progress: Math.min(1, value / a.target) };
    });
  }

  check() {
    const d = this.game.data;
    const fresh = [];
    for (const a of ACHIEVEMENTS) {
      if (d.achievements[a.id]?.unlocked) continue;
      if ((a.value(d) || 0) >= a.target) {
        d.achievements[a.id] = { unlocked: true, at: Date.now() };
        fresh.push(a);
      }
    }
    for (const a of fresh) {
      this.game.progress.addCoins(a.reward);
      this.game.events.emit('achievement:unlocked', { id: a.id, name: a.name, reward: a.reward, icon: a.icon });
    }
    if (fresh.length) this.game.saveNow();
    return fresh;
  }

  unlockedCount() {
    return Object.values(this.game.data.achievements).filter((a) => a.unlocked).length;
  }
}
