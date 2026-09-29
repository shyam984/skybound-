// Progression: currencies, player XP/levels, Nex unlocks & upgrades,
// buildings, the energy generator and challenge rewards. All rules that
// change the save data live here so the UI never mutates data directly.

import { NEX, NEX_ORDER, NEX_LEVELS, MAX_NEX_LEVEL } from '../data/nex.js';
import { CHALLENGES, CHALLENGE_ORDER } from '../data/challenges.js';
import { BUILDINGS } from '../data/buildings.js';
import { totalStars } from '../data/achievements.js';
import { num } from '../core/math.js';

export const MAX_LEVEL = 30;

export function xpToNext(level) {
  return Math.round(80 + 45 * (level - 1) + 6 * (level - 1) ** 2);
}

export class Progression {
  constructor(game) {
    this.game = game;
  }

  get d() {
    return this.game.data;
  }

  emit(evt, payload) {
    this.game.events.emit(evt, payload);
  }

  // ---------------------------------------------------------------- currency
  addCoins(n) {
    n = Math.round(num(n));
    if (n <= 0) return;
    this.d.profile.coins = num(this.d.profile.coins) + n;
    this.emit('currency', { coins: n });
  }

  addEnergy(n) {
    n = Math.round(num(n));
    if (n <= 0) return;
    this.d.profile.energy = num(this.d.profile.energy) + n;
    this.emit('currency', { energy: n });
  }

  canAfford(cost = {}) {
    return this.d.profile.coins >= (cost.coins || 0) && this.d.profile.energy >= (cost.energy || 0);
  }

  spend(cost = {}) {
    if (!this.canAfford(cost)) return false;
    this.d.profile.coins -= cost.coins || 0;
    this.d.profile.energy -= cost.energy || 0;
    this.emit('currency', { spent: cost });
    return true;
  }

  // ---------------------------------------------------------------- levels
  xpToNext(level = this.d.profile.level) {
    return xpToNext(level);
  }

  /** Adds XP and returns an array of { level, unlocks, coins } for each level gained. */
  addXP(n) {
    n = Math.round(num(n));
    const gained = [];
    if (n <= 0) return gained;
    const p = this.d.profile;
    p.xp = num(p.xp) + n;
    while (p.level < MAX_LEVEL && p.xp >= xpToNext(p.level)) {
      p.xp -= xpToNext(p.level);
      p.level += 1;
      const bonus = 25 * p.level;
      this.addCoins(bonus);
      const info = { level: p.level, unlocks: this.levelUnlocks(p.level), coins: bonus };
      gained.push(info);
      this.emit('level:up', info);
    }
    if (p.level >= MAX_LEVEL) p.xp = 0;
    this.checkNexUnlocks();
    return gained;
  }

  /** Human-readable list of what becomes available at a given player level. */
  levelUnlocks(level) {
    const out = [];
    for (const b of Object.values(BUILDINGS)) {
      if (!b.levels) continue;
      b.levels.forEach((l, i) => {
        if (l && l.reqLevel === level && !(b.prebuilt && i === 1)) {
          out.push(i === 1 ? `Build the ${b.name}` : `${b.name} level ${i}`);
        }
      });
    }
    for (const id of CHALLENGE_ORDER) {
      const c = CHALLENGES[id];
      if (c.requires.level === level) out.push(`Challenge: ${c.name}`);
    }
    for (const id of NEX_ORDER) {
      const u = NEX[id].unlock;
      if (u.type === 'level' && u.level === level) out.push(`${NEX[id].name} joins your team!`);
    }
    return out;
  }

  totalStars() {
    return totalStars(this.d);
  }

  // ---------------------------------------------------------------- challenges
  record(id) {
    return this.d.challenges[id] || { stars: 0, bestScore: 0, bestCombo: 0, bestTime: 0, plays: 0, clears: 0 };
  }

  challengeStatus(id) {
    const def = CHALLENGES[id];
    if (!def) return { unlocked: false, reason: 'Unknown challenge' };
    const req = def.requires || {};
    const reasons = [];
    if (req.prev && !(this.record(req.prev).clears > 0)) reasons.push(`Clear ${CHALLENGES[req.prev].name}`);
    if (req.level && this.d.profile.level < req.level) reasons.push(`Reach level ${req.level}`);
    return { unlocked: reasons.length === 0, reason: reasons.join(' · '), record: this.record(id) };
  }

  /** The challenge the PLAY button should suggest. */
  recommendedChallenge() {
    let lastUnlocked = CHALLENGE_ORDER[0];
    for (const id of CHALLENGE_ORDER) {
      const st = this.challengeStatus(id);
      if (!st.unlocked) break;
      lastUnlocked = id;
      if (!(st.record.clears > 0)) return id;
    }
    return lastUnlocked;
  }

  // ---------------------------------------------------------------- nex
  nexStatus(id) {
    const def = NEX[id];
    const n = this.d.nex[id];
    if (!def || !n) return { unlocked: false, progress: 0, target: 1, text: '' };
    if (n.unlocked) return { unlocked: true, progress: 1, target: 1, text: 'Unlocked' };
    const u = def.unlock;
    switch (u.type) {
      case 'fragments':
        return { unlocked: false, progress: this.d.fragments[id] || 0, target: u.count, text: u.text, unit: 'fragments' };
      case 'level':
        return { unlocked: false, progress: this.d.profile.level, target: u.level, text: u.text, unit: 'level' };
      case 'stars':
        return { unlocked: false, progress: this.totalStars(), target: u.count, text: u.text, unit: 'stars' };
      case 'challenge':
        return { unlocked: false, progress: this.record(u.challenge).clears > 0 ? 1 : 0, target: 1, text: u.text, unit: 'clear' };
      default:
        return { unlocked: false, progress: 0, target: 1, text: '' };
    }
  }

  /** Unlock any Nex whose requirement is now met. Returns newly unlocked ids. */
  checkNexUnlocks() {
    const out = [];
    for (const id of NEX_ORDER) {
      const n = this.d.nex[id];
      if (!n || n.unlocked) continue;
      const st = this.nexStatus(id);
      if (st.progress >= st.target) {
        n.unlocked = true;
        out.push(id);
        this.emit('nex:unlocked', { id });
      }
    }
    if (out.length) this.game.saveNow();
    return out;
  }

  addNexXP(id, n) {
    const nx = this.d.nex[id];
    n = Math.round(num(n));
    if (!nx || n <= 0) return;
    nx.xp = num(nx.xp) + n;
  }

  nexUpgradeStatus(id) {
    const nx = this.d.nex[id];
    if (!nx || !nx.unlocked) return { ok: false, reason: 'Locked' };
    if (nx.level >= MAX_NEX_LEVEL) return { ok: false, maxed: true, reason: 'Max level' };
    const next = NEX_LEVELS[nx.level + 1];
    const cost = { coins: next.coins, energy: 0 };
    const xpReady = nx.xp >= next.xp;
    let reason = '';
    if (!(this.d.buildings.lab.level > 0)) reason = 'Build the Character Lab to upgrade';
    else if (!xpReady) reason = `Needs ${next.xp - nx.xp} more Nex XP`;
    else if (!this.canAfford(cost)) reason = 'Not enough coins';
    return { ok: !reason, reason, cost, xpNeeded: next.xp, xpReady, next: nx.level + 1 };
  }

  upgradeNex(id) {
    const st = this.nexUpgradeStatus(id);
    if (!st.ok) return false;
    if (!this.spend(st.cost)) return false;
    this.d.nex[id].level += 1;
    this.emit('nex:upgraded', { id, level: this.d.nex[id].level });
    this.game.saveNow();
    return true;
  }

  setActiveNex(id) {
    if (!this.d.nex[id]?.unlocked) return false;
    this.d.activeNex = id;
    this.emit('nex:active', { id });
    this.game.save.save();
    return true;
  }

  // ---------------------------------------------------------------- buildings
  buildingLevel(id) {
    return this.d.buildings[id]?.level || 0;
  }

  buildStatus(id) {
    const def = BUILDINGS[id];
    const level = this.buildingLevel(id);
    if (!def) return { state: 'none' };
    if (def.fixed) return { state: 'built', level };
    if (level >= def.maxLevel) return { state: 'maxed', level };
    const next = def.levels[level + 1];
    const cost = { coins: next.coins, energy: next.energy };
    if (this.d.profile.level < next.reqLevel) {
      return { state: 'locked', level, next: level + 1, cost, reason: `Reach level ${next.reqLevel}` };
    }
    const afford = this.canAfford(cost);
    return {
      state: 'available',
      level,
      next: level + 1,
      cost,
      afford,
      reason: afford ? '' : 'Not enough resources',
    };
  }

  build(id) {
    const st = this.buildStatus(id);
    if (st.state !== 'available' || !st.afford) return false;
    if (!this.spend(st.cost)) return false;
    const b = this.d.buildings[id];
    b.level = st.next;
    if (id === 'generator' && st.next === 1) {
      b.lastTick = Date.now();
      b.stored = 10; // a small head start so the first collect feels good
    }
    this.emit('building:built', { id, level: b.level });
    this.game.saveNow();
    return true;
  }

  coinMultiplier() {
    return 1 + (this.buildingLevel('hub') - 1) * 0.05;
  }

  energyMultiplier() {
    return 1 + this.decorCount() * 0.01;
  }

  decorCount() {
    return Object.values(this.d.decor.slots).filter(Boolean).length;
  }

  // ---------------------------------------------------------------- generator
  updateGenerator(now = Date.now()) {
    const g = this.d.buildings.generator;
    if (!(g.level > 0)) {
      g.lastTick = now;
      return;
    }
    const L = BUILDINGS.generator.levels[g.level];
    const minutes = Math.max(0, now - num(g.lastTick, now)) / 60000;
    g.lastTick = now;
    g.stored = Math.min(L.cap, num(g.stored) + minutes * L.rate);
  }

  generatorInfo() {
    const g = this.d.buildings.generator;
    if (!(g.level > 0)) return null;
    const L = BUILDINGS.generator.levels[g.level];
    return { stored: Math.floor(num(g.stored)), cap: L.cap, rate: L.rate, full: g.stored >= L.cap - 0.01 };
  }

  collectGenerator() {
    this.updateGenerator();
    const g = this.d.buildings.generator;
    const amount = Math.floor(num(g.stored));
    if (amount <= 0) return 0;
    g.stored -= amount;
    this.addEnergy(amount);
    this.emit('generator:collected', { amount });
    this.game.saveNow();
    return amount;
  }

  // ---------------------------------------------------------------- rewards
  starsFor(def, run) {
    if (!run.success) return 0;
    let stars = 1;
    if (run.score >= def.stars[0]) stars = 2;
    if (run.score >= def.stars[1] && run.damage <= 1) stars = 3;
    return stars;
  }

  /** Apply the outcome of a challenge exactly once and return a reward summary. */
  applyChallengeResult(run) {
    const def = CHALLENGES[run.id];
    const d = this.d;
    const lockedBefore = NEX_ORDER.filter((id) => !d.nex[id]?.unlocked);
    const before = { level: d.profile.level, xp: d.profile.xp, coins: d.profile.coins, energy: d.profile.energy };
    const rec = (d.challenges[run.id] = this.record(run.id));
    const stars = this.starsFor(def, run);
    const prevStars = rec.stars || 0;
    const newStars = Math.max(0, stars - prevStars);
    const newBest = run.score > (rec.bestScore || 0);

    rec.plays = (rec.plays || 0) + 1;
    rec.stars = Math.max(prevStars, stars);
    rec.bestScore = Math.max(rec.bestScore || 0, run.score);
    rec.bestCombo = Math.max(rec.bestCombo || 0, run.bestCombo);
    if (run.success) {
      rec.clears = (rec.clears || 0) + 1;
      if (run.elapsed > 0 && (!rec.bestTime || run.elapsed < rec.bestTime)) rec.bestTime = run.elapsed;
    }
    const firstClear = run.success && rec.clears === 1;

    const s = d.stats;
    s.challengesPlayed += 1;
    if (run.success) s.challengesCompleted += 1;
    if (run.success && run.perfect) s.perfectRuns += 1;
    s.totalEnergy += run.energy;
    s.bestMultiplier = Math.max(s.bestMultiplier, run.bestMult);
    s.bestCombo = Math.max(s.bestCombo, run.bestCombo);

    const base = def.rewards || {};
    const coins = Math.round(
      (run.energy * 0.5 + (run.success ? (base.coins || 0) + stars * 15 : 0) + (firstClear ? base.coins || 0 : 0)) *
        this.coinMultiplier(),
    );
    const xp = run.success ? (base.xp || 0) + stars * 15 + (firstClear ? 30 : 0) : Math.round((base.xp || 0) * 0.35);
    const energy = Math.round(run.energy * this.energyMultiplier());
    const nexXP = (run.success ? 100 : 40) + run.specials * 10;

    const fragments = {};
    if (run.success && base.fragments) {
      for (const [id, amount] of Object.entries(base.fragments)) {
        if (d.nex[id] && !d.nex[id].unlocked) {
          const n = amount + newStars * 2;
          d.fragments[id] = (d.fragments[id] || 0) + n;
          fragments[id] = n;
        }
      }
    }

    this.addCoins(coins);
    this.addEnergy(energy);
    this.addNexXP(d.activeNex, nexXP);
    const levelsGained = this.addXP(xp);
    this.checkNexUnlocks();
    const unlockedNex = lockedBefore.filter((id) => d.nex[id]?.unlocked);

    this.game.saveNow();
    return {
      stars,
      prevStars,
      newStars,
      newBest,
      firstClear,
      coins,
      xp,
      energy,
      nexXP,
      fragments,
      levelsGained,
      unlockedNex,
      before,
      after: { level: d.profile.level, xp: d.profile.xp },
    };
  }
}
