// Daily missions: three per day, generated from a date seed and tracked via
// gameplay events. Claiming rewards is explicit so the player sees the payoff.

import { MISSION_TEMPLATES, MISSION_NEX_XP } from '../data/missions.js';
import { mulberry32, hashString, todayKey } from '../core/math.js';

export class MissionSystem {
  constructor(game) {
    this.game = game;
    const ev = game.events;
    ev.on('orb:collected', (e) => {
      this.bump('energy', e.energy);
      if (e.type === 'gold') this.bump('gold', 1);
    });
    ev.on('combo:tier', (e) => this.max('comboMax', e.mult));
    ev.on('ability:used', () => this.bump('ability', 1));
    ev.on('challenge:finished', (e) => {
      if (e.success) this.bump('clears', 1);
      if (e.stars) this.bump('stars', e.stars);
      if (e.success && e.perfect) this.bump('perfect', 1);
    });
  }

  get state() {
    return this.game.data.missions;
  }

  /** Make sure today's missions exist (rolls over at local midnight). */
  refresh() {
    const key = todayKey();
    const st = this.state;
    if (st.day === key && st.list.length === 3) return;
    const rng = mulberry32(hashString(`nn-${key}`));
    const pool = [...MISSION_TEMPLATES];
    const picks = [];
    while (picks.length < 3 && pool.length) {
      picks.push(pool.splice(Math.floor(rng() * pool.length), 1)[0]);
    }
    const tier = Math.min(2, Math.floor((this.game.data.profile.level - 1) / 4));
    st.day = key;
    st.list = picks.map((t) => ({ id: t.id, target: t.values[tier], progress: 0, claimed: false }));
    this.game.save.save();
  }

  missions() {
    this.refresh();
    return this.state.list
      .map((m) => {
        const t = MISSION_TEMPLATES.find((x) => x.id === m.id);
        if (!t) return null;
        return {
          ...m,
          text: t.text(m.target),
          icon: t.icon,
          reward: { coins: t.reward.coins, xp: t.reward.xp, nexXP: MISSION_NEX_XP },
          complete: m.progress >= m.target,
        };
      })
      .filter(Boolean);
  }

  claimableCount() {
    return this.missions().filter((m) => m.complete && !m.claimed).length;
  }

  bump(stat, amount) {
    this.refresh();
    let changed = false;
    for (const m of this.state.list) {
      const t = MISSION_TEMPLATES.find((x) => x.id === m.id);
      if (!t || t.stat !== stat || t.mode === 'max' || m.progress >= m.target) continue;
      m.progress = Math.min(m.target, m.progress + amount);
      changed = true;
      if (m.progress >= m.target) this.game.events.emit('mission:complete', { id: m.id, text: t.text(m.target) });
    }
    if (changed) this.game.save.save();
  }

  max(stat, value) {
    this.refresh();
    let changed = false;
    for (const m of this.state.list) {
      const t = MISSION_TEMPLATES.find((x) => x.id === m.id);
      if (!t || t.stat !== stat || t.mode !== 'max' || m.progress >= m.target) continue;
      if (value > m.progress) {
        m.progress = Math.min(m.target, value);
        changed = true;
        if (m.progress >= m.target) this.game.events.emit('mission:complete', { id: m.id, text: t.text(m.target) });
      }
    }
    if (changed) this.game.save.save();
  }

  claim(id) {
    const m = this.missions().find((x) => x.id === id);
    const raw = this.state.list.find((x) => x.id === id);
    if (!m || !raw || !m.complete || raw.claimed) return null;
    raw.claimed = true;
    this.state.completedTotal += 1;
    const p = this.game.progress;
    p.addCoins(m.reward.coins);
    p.addNexXP(this.game.data.activeNex, m.reward.nexXP);
    const levels = p.addXP(m.reward.xp);
    this.game.events.emit('mission:claimed', { id });
    this.game.saveNow();
    return { reward: m.reward, levels };
  }

  msUntilReset() {
    const now = new Date();
    const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    return next - now;
  }
}
