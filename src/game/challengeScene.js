// Challenge gameplay scene: arena, orbs, hazards, combo, abilities, scoring,
// camera and all the in-run feedback. One instance is reused for every run;
// start() fully resets it so no state leaks between runs.

import { getChallenge, THEMES, ORB_TYPES } from '../data/challenges.js';
import { TAU, clamp, damp, rand, dist2, mulberry32, ease, closestOnSegment } from '../core/math.js';
import { Camera } from '../render/view.js';
import { Sky } from '../render/sky.js';
import { FloatTexts } from '../render/particles.js';
import { glow, circle, rgba, roundRectPath, starPath, polyPath, mix, ellipsePath, softBlob } from '../render/draw.js';
import { drawDistantIsland } from '../render/islandArt.js';
import { patternPoints } from './patterns.js';
import { Combo } from './combo.js';
import { Player } from './player.js';
import { createHazard } from './hazards.js';
import { ABILITIES } from './abilities.js';
import { TutorialScript } from './tutorialScript.js';

const GATE_R = 58;
const GATE_CHARGE = 0.9; // seconds to warp out

export class ChallengeScene {
  constructor(game) {
    this.game = game;
    this.cam = new Camera();
    this.sky = new Sky(21);
    this.texts = new FloatTexts();
    this.active = false;
    this.paused = false;
    this.t = 0;
    this.flashes = [];
  }

  get particles() {
    return this.game.particles;
  }

  // ---------------------------------------------------------------- lifecycle
  start(id) {
    const g = this.game;
    const d = g.data;
    const def = getChallenge(id);
    if (!def) throw new Error(`Unknown challenge ${id}`);
    this.def = def;
    this.theme = THEMES[def.theme] || THEMES.meadow;
    this.arena = { w: def.arena.w, h: def.arena.h, corner: Math.min(200, def.arena.w / 4, def.arena.h / 4) };
    this.timed = def.time > 0;
    this.timeLeft = def.time;
    this.time = 0;
    this.lastDt = 1 / 60;
    this.phase = 'intro';
    this.countdown = 0;
    this.lastCount = 0;
    this.endTimer = 0;
    this.run = null;
    this.lastTick = 99;

    const nexId = d.nex[d.activeNex]?.unlocked ? d.activeNex : 'bolt';
    this.player = new Player({
      nexId,
      level: d.nex[nexId].level,
      palette: g.getPalette(nexId),
      x: def.spawn.x,
      y: def.spawn.y,
      trail: g.equippedCosmetic('trail'),
      quality: g.quality,
    });
    this.effect = g.equippedCosmetic('effect');
    this.combo = new Combo(def.comboWindow || 3);
    this.orbs = [];
    this.groups = [];
    for (const od of def.orbs) this.addOrbGroup(od);
    this.spawners = def.specials.map((s) => ({ def: s, next: s.at, orb: null, done: false }));
    this.hazards = [];
    for (const h of def.hazards) this.addHazard(h);
    this.gate = { open: false, x: def.gate.x, y: def.gate.y, t: 0, charge: 0 };
    this.stats = { score: 0, base: 0, energy: 0, damage: 0, bestCombo: 0, bestMult: 1, specials: 0, gold: 0, abilityUses: 0 };
    this.objectiveDone = false;
    this.tutorial = null;
    this.abilityState = null;
    this.flashes = [];
    this.hintText = '';
    this.buildProps();
    this.pattern = null;
    this.arenaCache = null;

    this.particles.clear();
    this.texts.clear();
    this.cam.reducedMotion = g.reducedMotion;
    this.resize();
    this.cam.snap(this.player.x, this.player.y);
    this.cam.zoomOffset = 0;
    this.active = true;
    this.paused = false;
    g.ui.hud.show(this);
  }

  stop() {
    this.active = false;
    this.paused = false;
    if (this.abilityState) this.endAbility();
    this.game.input.setGameplay(false);
    this.game.ui.hud.hide();
  }

  resize() {
    const v = this.game.view;
    let z = Math.min(v.w, v.h) / 600;
    z = Math.min(z, Math.max(v.w, v.h) / 980);
    this.cam.baseZoom = clamp(z, 0.5, 1.7);
    this.arenaCache = null;
    this.vignette = null;
  }

  beginCountdown() {
    if (this.phase !== 'intro') return;
    this.phase = 'countdown';
    this.countdown = 3;
    this.lastCount = 4;
    this.game.audio.play('whoosh');
  }

  // ---------------------------------------------------------------- content spawning
  addOrbGroup(od) {
    const group = { def: od, points: patternPoints(od), alive: 0, respawnT: 0 };
    this.groups.push(group);
    this.spawnGroup(group, 0);
    return group;
  }

  spawnGroup(group, delayStep = 0.04) {
    group.points.forEach(([x, y], i) => {
      this.orbs.push(this.makeOrb(group.def.type || 'blue', x, y, { group, delay: i * delayStep }));
      group.alive += 1;
    });
  }

  makeOrb(type, x, y, o = {}) {
    const T = ORB_TYPES[type];
    return {
      type, x, y, r: T.radius, group: o.group || null, spawner: o.spawner || null,
      state: 'spawn', k: -(o.delay || 0), life: o.life ?? Infinity, ph: rand(0, TAU), vx: 0, vy: 0,
    };
  }

  spawnSpecial(type, x, y, life = 10, spawner = null) {
    const orb = this.makeOrb(type, x, y, { life, spawner });
    this.orbs.push(orb);
    this.particles.ring(x, y, { color: ORB_TYPES[type].color, radius: 50, life: 0.5, width: 3 });
    return orb;
  }

  addHazard(def) {
    const h = createHazard(def);
    if (h) this.hazards.push(h);
    return h;
  }

  openGate() {
    if (this.gate.open) return;
    this.gate.open = true;
    this.gate.t = 0;
    this.game.audio.play('gateOpen');
    this.particles.ring(this.gate.x, this.gate.y, { color: '#48f5a0', radius: 140, life: 0.8, width: 6 });
    if (!this.tutorial) {
      this.game.ui.hud.banner('OBJECTIVE COMPLETE', 'Enter the gate for a time bonus — or keep collecting!', 'good');
    }
  }

  hint(html) {
    this.hintText = html;
    this.game.ui.hud.hint(html);
  }

  flash(color, alpha) {
    if (this.game.reducedMotion) alpha *= 0.35;
    this.flashes.push({ color, a: alpha });
  }

  // ---------------------------------------------------------------- ability
  useAbility() {
    if (this.phase !== 'play' || this.paused) return false;
    const p = this.player;
    if (p.abilityCd > 0 || this.abilityState) {
      this.game.audio.play('deny');
      this.game.ui.hud.abilityDenied();
      return false;
    }
    const a = p.ability;
    const impl = ABILITIES[a.id];
    if (!impl) return false;
    const active = impl.activeTime ?? a.duration;
    this.abilityState = { impl, a, left: active };
    p.abilityActive = active;
    p.abilityCd = a.cooldown;
    impl.activate(this, p, a);
    this.stats.abilityUses += 1;
    this.game.audio.play('ability', { id: p.id });
    this.game.events.emit('ability:used', { id: p.id });
    this.game.ui.hud.abilityUsed(a.name);
    return true;
  }

  endAbility() {
    const st = this.abilityState;
    if (!st) return;
    st.impl.end(this, this.player, st.a);
    this.abilityState = null;
    this.player.abilityActive = 0;
  }

  updateAbility(dt) {
    const p = this.player;
    if (this.abilityState) {
      const st = this.abilityState;
      st.left -= dt;
      p.abilityActive = Math.max(0, st.left);
      if (st.impl.update) st.impl.update(this, p, dt, st.a);
      if (st.left <= 0) this.endAbility();
    } else if (p.abilityCd > 0) {
      p.abilityCd -= dt;
      if (p.abilityCd <= 0) {
        p.abilityCd = 0;
        this.game.audio.play('abilityReady');
        this.particles.ring(p.x, p.y, { color: p.palette.glow, radius: 50, life: 0.4, width: 3 });
      }
    }
  }

  // ---------------------------------------------------------------- update
  update(dt) {
    this.t += dt;
    if (!this.active) return;
    this.cam.update(dt);
    if (this.paused) return;
    this.particles.update(dt);
    this.texts.update(dt);
    for (const f of this.flashes) f.a -= dt * 2.5;
    this.flashes = this.flashes.filter((f) => f.a > 0);
    const p = this.player;
    const noMove = { x: 0, y: 0, mag: 0 };

    if (this.phase === 'intro' || this.phase === 'results') {
      p.update(dt, noMove, this.arena, this.particles);
      this.updateCamera(dt);
      this.animateIdleOrbs(dt);
      return;
    }
    if (this.phase === 'countdown') {
      this.countdown -= dt;
      const n = Math.ceil(this.countdown);
      if (n !== this.lastCount && n > 0) {
        this.lastCount = n;
        this.game.ui.hud.bigText(String(n));
        this.game.audio.play('countdown');
      }
      if (this.countdown <= 0) {
        this.phase = 'play';
        this.game.ui.hud.bigText('GO!', 'go');
        this.game.audio.play('go');
        this.game.input.setGameplay(true);
        if (this.def.type === 'tutorial') this.tutorial = new TutorialScript(this);
      }
      p.update(dt, noMove, this.arena, this.particles);
      this.updateCamera(dt);
      this.animateIdleOrbs(dt);
      this.game.ui.hud.update(this);
      return;
    }
    if (this.phase === 'ending') {
      this.endTimer -= dt;
      p.celebrate = Math.max(0, p.celebrate - dt / 1.5);
      p.update(dt, noMove, this.arena, this.particles);
      this.updateCamera(dt);
      this.animateIdleOrbs(dt);
      if (this.endTimer <= 0) {
        this.phase = 'results';
        this.game.onChallengeEnded(this.run);
      }
      return;
    }
    // play: fixed sub-steps keep collisions reliable on slow frames
    let remaining = dt;
    while (remaining > 1e-6 && this.phase === 'play') {
      const step = Math.min(remaining, 1 / 60);
      this.step(step);
      remaining -= step;
    }
    this.updateCamera(dt);
    this.game.ui.hud.update(this);
  }

  step(dt) {
    this.lastDt = dt;
    this.time += dt;
    const p = this.player;
    const g = this.game;
    const move = g.input.getMove(this.cam.toScreen(g.view, p.x, p.y));
    p.update(dt, move, this.arena, this.particles);
    this.updateAbility(dt);

    if (this.timed) {
      this.timeLeft -= dt;
      const secs = Math.ceil(this.timeLeft);
      if (secs <= 10 && secs >= 1 && secs !== this.lastTick) {
        this.lastTick = secs;
        g.audio.play('tick');
      }
      if (this.timeLeft <= 0) {
        this.timeLeft = 0;
        this.finish(this.objectiveDone, this.objectiveDone ? 'time' : 'timeout');
        return;
      }
    }

    if (this.combo.update(dt)) {
      g.audio.play('comboLost');
      this.texts.add(p.x, p.y - 44, 'combo lost', { color: '#aab5de', size: 14, life: 0.7, bold: false });
    }

    this.updateSpawners();
    this.updateGroups(dt);
    this.updateOrbs(dt);
    if (this.phase !== 'play') return;

    for (const h of this.hazards) {
      const evt = h.tick(dt, this.time);
      if (evt === 'warn') g.audio.play('warn', { gap: 200 });
      if (h.dangerous && p.canBeHit() && h.collide(p.x, p.y, p.hitR)) {
        this.onHit(h);
        if (this.phase !== 'play') return;
      }
    }

    if (this.gate.open) {
      // Standing in the gate charges a short warp so passing through by
      // accident while chasing orbs never ends the run.
      this.gate.t += dt;
      const inside = dist2(p.x, p.y, this.gate.x, this.gate.y) < (GATE_R - 6) ** 2;
      if (inside) {
        if (this.gate.charge === 0) g.audio.play('gateOpen', { gap: 400 });
        this.gate.charge += dt / GATE_CHARGE;
        if (this.gate.charge >= 1) {
          this.finish(true, 'gate');
          return;
        }
      } else {
        this.gate.charge = Math.max(0, this.gate.charge - dt * 2.5);
      }
    }

    if (!this.objectiveDone && !this.tutorial && this.stats.energy >= this.def.objective.energy) {
      this.objectiveDone = true;
      this.openGate();
    }
    if (this.tutorial) this.tutorial.update(dt);
    if (p.shields <= 0) this.finish(false, 'shields');
  }

  updateCamera(dt) {
    const p = this.player;
    const v = this.game.view;
    const reduced = this.game.reducedMotion;
    let tx = p.x + (reduced ? 0 : p.vx * 0.2);
    let ty = p.y + (reduced ? 0 : p.vy * 0.2);
    const z = this.cam.zoom || 1;
    const halfW = v.w / 2 / z;
    const halfH = v.h / 2 / z;
    const mx = this.arena.w / 2 + 170;
    const my = this.arena.h / 2 + 170;
    tx = halfW < mx ? clamp(tx, -mx + halfW, mx - halfW) : 0;
    ty = halfH < my ? clamp(ty, -my + halfH, my - halfH) : 0;
    this.cam.follow(tx, ty, dt, 5.5);
    const targetOffset = reduced ? 0 : -0.07 * Math.min(1, p.speed01);
    this.cam.zoomOffset = damp(this.cam.zoomOffset, targetOffset, 2.5, dt);
  }

  updateSpawners() {
    for (const sp of this.spawners) {
      if (sp.done || sp.orb) continue;
      if (this.time >= sp.next) {
        const s = sp.def;
        sp.orb = this.spawnSpecial(s.type, s.x, s.y, s.life ?? Infinity, sp);
        if (s.every) sp.next = this.time + s.every;
        else sp.done = true;
      }
    }
  }

  updateGroups(dt) {
    for (const gr of this.groups) {
      if (gr.alive > 0 || !gr.def.respawn) continue;
      gr.respawnT += dt;
      if (gr.respawnT >= gr.def.respawn) {
        gr.respawnT = 0;
        this.spawnGroup(gr);
      }
    }
  }

  animateIdleOrbs(dt) {
    for (const o of this.orbs) {
      if (o.state === 'spawn') {
        o.k += dt / 0.35;
        if (o.k >= 1) o.state = 'idle';
      }
    }
  }

  updateOrbs(dt) {
    const p = this.player;
    const passive = p.g.magnet;
    const boost = p.magnetBoost;
    let nearby = 0;
    for (let i = this.orbs.length - 1; i >= 0; i--) {
      const o = this.orbs[i];
      if (o.state === 'spawn') {
        o.k += dt / 0.35;
        if (o.k >= 1) o.state = 'idle';
        if (o.k < 0.4) continue;
      }
      if (o.state === 'collect') {
        o.k += dt / 0.12;
        o.x += (p.x - o.x) * Math.min(1, dt * 22);
        o.y += (p.y - o.y) * Math.min(1, dt * 22);
        if (o.k >= 1) this.orbs.splice(i, 1);
        continue;
      }
      if (o.life !== Infinity) {
        o.life -= dt;
        if (o.life <= 0) {
          this.orbs.splice(i, 1);
          if (o.spawner) o.spawner.orb = null;
          this.particles.burst(o.x, o.y, { count: 6, color: ORB_TYPES[o.type].color, speed: 80, life: 0.4 });
          continue;
        }
      }
      const dx = p.x - o.x;
      const dy = p.y - o.y;
      const d = Math.hypot(dx, dy) || 1;
      if (d < 220) nearby++;
      // Attraction: Luma's magnet field, otherwise the passive Collection pull.
      if (boost > 0 && d < boost) {
        const k = 1 - d / boost;
        const pull = 300 + k * k * 1600;
        o.vx += (dx / d) * pull * dt;
        o.vy += (dy / d) * pull * dt;
        o.vx *= Math.exp(-3 * dt);
        o.vy *= Math.exp(-3 * dt);
        o.x += o.vx * dt;
        o.y += o.vy * dt;
      } else if (d < passive) {
        const k = 1 - d / passive;
        const pull = 90 + k * 380;
        o.x += (dx / d) * pull * dt;
        o.y += (dy / d) * pull * dt;
        o.vx = o.vy = 0;
      } else {
        o.vx = o.vy = 0;
      }
      if (d < p.r + o.r + 4) this.collect(o);
    }
    p.nearby = Math.min(1, nearby / 6);
  }

  collect(o) {
    const g = this.game;
    const p = this.player;
    const T = ORB_TYPES[o.type];
    const s = this.stats;
    o.state = 'collect';
    o.k = 0;
    if (o.group) {
      o.group.alive -= 1;
      if (o.group.alive <= 0) o.group.respawnT = 0;
    }
    if (o.spawner) o.spawner.orb = null;

    const tierUp = this.combo.add(o.type === 'rainbow' ? 5 : 1);
    let points = T.points * this.combo.mult;
    let label = `+${points}`;
    let labelColor = '#ffffff';
    switch (o.type) {
      case 'time':
        if (this.timed) {
          this.timeLeft += T.seconds;
          label = `+${T.seconds}s`;
          labelColor = '#8dff7a';
        }
        g.audio.play('timeOrb');
        break;
      case 'shield':
        if (p.shields < p.maxShields) {
          p.shields += 1;
          label = '+1 SHIELD';
          labelColor = '#9fc0ff';
          g.ui.hud.shieldGained();
        } else {
          points += T.fullBonus;
          label = `+${points} SHIELD BONUS`;
          labelColor = '#9fc0ff';
        }
        g.audio.play('shield');
        break;
      case 'gold':
        g.audio.play('gold');
        s.gold += 1;
        labelColor = '#ffd34a';
        break;
      case 'rainbow':
        g.audio.play('rainbow');
        label = `+${points} COMBO +5`;
        labelColor = '#ff9fe6';
        break;
      case 'giant':
        g.audio.play('giant');
        this.cam.zoomPunch(0.1);
        this.cam.shake(3);
        labelColor = '#bff8ff';
        break;
      default:
        g.audio.play('pickup', { combo: this.combo.count - 1, gap: 18 });
    }
    if (o.type !== 'blue') s.specials += 1;
    s.score += points;
    s.base += T.points;
    s.energy += T.energy;
    s.bestCombo = Math.max(s.bestCombo, this.combo.count);
    if (T.energy) g.events.emit('orb:collected', { type: o.type, energy: T.energy });

    // feedback
    const size = o.type === 'blue' ? 16 : 22;
    this.texts.add(o.x, o.y - 18, label, { color: labelColor, size, life: o.type === 'blue' ? 0.6 : 1 });
    const fx = this.effect;
    const colors = fx ? fx.colors : [T.color, T.core];
    const shape = fx ? fx.shape : o.type === 'gold' ? 'star' : 'dot';
    const big = o.type === 'giant' ? 2.2 : o.type === 'blue' ? 1 : 1.5;
    this.particles.burst(o.x, o.y, { count: Math.round(8 * big), colors, speed: 170 * big, life: 0.45, size: shape === 'dot' ? 3 : 4, type: shape, drag: 4 });
    this.particles.ring(o.x, o.y, { color: T.color, radius: 26 * big, life: 0.3, width: 2 });
    p.setExpr(this.combo.mult >= 4 ? 'excited' : 'happy', 0.3);
    p.coreBoost = Math.min(1.5, p.coreBoost + 0.35);
    p.squash = -0.08;
    g.ui.hud.pulseScore();
    if (tierUp) this.onTier(tierUp);
  }

  onTier(mult) {
    const g = this.game;
    const p = this.player;
    this.stats.bestMult = Math.max(this.stats.bestMult, mult);
    g.events.emit('combo:tier', { mult });
    g.audio.play('comboUp', { mult });
    g.ui.hud.comboTier(mult);
    const colors = ['#35e8ff', '#48f5a0', '#ffd34a', '#ff9838', '#ff4fb8'];
    const c = colors[mult - 1] || '#ffffff';
    this.particles.ring(p.x, p.y, { color: c, radius: 50 + mult * 22, life: 0.5, width: 3 + mult });
    if (mult >= 3) this.particles.burst(p.x, p.y, { count: 6 + mult * 4, colors: [c, '#ffffff'], speed: 200 + mult * 40, type: 'star', size: 3, life: 0.6 });
    this.texts.add(p.x, p.y - 56, `x${mult} COMBO!`, { color: c, size: 20 + mult * 3, life: 1.1 });
    if (mult >= 4) p.setExpr('excited', 1.2);
    if (mult >= 5) {
      this.flash('#ff4fb8', 0.18);
      this.cam.zoomPunch(0.06);
    }
  }

  onHit(h) {
    const p = this.player;
    const g = this.game;
    const hp = hitPoint(h, p.x, p.y);
    if (!p.hit(hp.x, hp.y)) return;
    this.stats.damage += 1;
    const lost = this.combo.reset();
    if (this.tutorial && p.shields < 1) p.shields = 1;
    g.audio.play('damage');
    this.cam.shake(7);
    this.flash('#ff4d6a', 0.22);
    this.particles.burst(p.x, p.y, { count: 16, colors: ['#ff4d6a', '#ffffff', p.palette.glow], speed: 260, type: 'spark', width: 2.5, life: 0.45 });
    g.ui.hud.shieldLost(p.shields);
    if (lost) this.texts.add(p.x, p.y - 50, 'COMBO BROKEN', { color: '#ff8a9a', size: 16, life: 0.9 });
    if (p.shields <= 0) this.finish(false, 'shields');
  }

  // ---------------------------------------------------------------- ending
  finish(success, reason) {
    if (this.phase !== 'play') return;
    const g = this.game;
    const p = this.player;
    this.phase = 'ending';
    this.endTimer = success ? 1.9 : 1.6;
    if (this.abilityState) this.endAbility();
    g.input.setGameplay(false);
    const s = this.stats;
    const timeBonus = success && this.timed && reason === 'gate' ? Math.ceil(this.timeLeft) * 15 : 0;
    const perfect = success && s.damage === 0;
    const perfectBonus = perfect ? (this.def.type === 'tutorial' ? 250 : 500) : 0;
    const total = s.score + timeBonus + perfectBonus;
    this.run = {
      id: this.def.id,
      success,
      reason,
      score: total,
      energy: s.energy,
      bestCombo: s.bestCombo,
      bestMult: s.bestMult,
      damage: s.damage,
      perfect,
      specials: s.specials,
      gold: s.gold,
      elapsed: this.time,
      timeLeft: this.timed ? this.timeLeft : 0,
      nexId: p.id,
      breakdown: { energy: s.base, combo: s.score - s.base, time: timeBonus, perfect: perfectBonus, total },
    };
    this.combo.reset();
    g.ui.hud.hint('');
    if (success) {
      g.audio.play('complete');
      g.audio.play('voice', { id: p.id, gap: 0 });
      p.setExpr('happy', 3);
      p.celebrate = 1;
      this.celebrate();
      if (reason === 'gate') this.particles.ring(this.gate.x, this.gate.y, { color: '#48f5a0', radius: 200, life: 0.8, width: 8 });
      g.ui.hud.banner('CHALLENGE COMPLETE', perfect ? 'Perfect run!' : '', 'good big');
    } else {
      g.audio.play('fail');
      p.setExpr('sad', 3);
      g.ui.hud.banner('CHALLENGE FAILED', reason === 'shields' ? 'All shields lost' : 'Out of time', 'bad big');
    }
  }

  /** Nex-specific celebration effects. */
  celebrate() {
    const p = this.player;
    const P = p.palette;
    const style = p.def.celebrate;
    const ps = this.particles;
    switch (style) {
      case 'spin':
        for (let i = 0; i < 24; i++) {
          const a = (i / 24) * TAU;
          ps.spawn({ x: p.x + Math.cos(a) * 30, y: p.y + Math.sin(a) * 30, vx: Math.cos(a + 1.4) * 220, vy: Math.sin(a + 1.4) * 220, life: 0.8, size: 4, color: P.trail, type: 'dot', drag: 3 });
        }
        break;
      case 'stars':
        for (let i = 0; i < 16; i++) ps.spawn({ x: p.x + rand(-40, 40), y: p.y + rand(-20, 20), vx: rand(-40, 40), vy: rand(-160, -60), life: 1.4, size: 4, color: i % 2 ? P.accent : '#ffffff', type: 'star', drag: 1 });
        break;
      case 'afterimage':
        for (let i = 0; i < 6; i++) {
          const a = (i / 6) * TAU;
          p.after.push({ x: p.x + Math.cos(a) * 46, y: p.y + Math.sin(a) * 46, life: 0.35 + i * 0.05, lean: 0 });
        }
        ps.ring(p.x, p.y, { color: P.accent, radius: 90, life: 0.7, width: 4 });
        break;
      case 'dissolve':
        ps.burst(p.x, p.y, { count: 22, colors: [P.light, P.accent, P.body], speed: 160, type: 'square', size: 4, life: 0.9, drag: 2 });
        break;
      case 'burst':
        ps.ring(p.x, p.y, { color: '#ffd34a', radius: 110, life: 0.6, width: 6 });
        ps.burst(p.x, p.y, { count: 20, colors: ['#ffd34a', '#ff8a2a', '#ffffff'], speed: 300, type: 'spark', width: 3, life: 0.6 });
        break;
      default:
        break;
    }
    ps.burst(p.x, p.y - 20, { count: 24, colors: ['#ffd34a', '#35e8ff', '#ff4fb8', '#48f5a0'], speed: 380, type: 'square', size: 4, life: 1.2, gravity: 380, drag: 1.5 });
  }

  // ---------------------------------------------------------------- props
  buildProps() {
    const rng = mulberry32(this.def.id.length * 977 + this.def.arena.w);
    const { w, h } = this.arena;
    const props = [];
    const types = this.theme.props;
    const n = 26;
    for (let i = 0; i < n; i++) {
      // walk the perimeter, inset from the boundary
      const u = (i + rng() * 0.6) / n;
      const perim = 2 * (w + h);
      let s = u * perim;
      let x;
      let y;
      const inset = 45 + rng() * 60;
      if (s < w) {
        x = -w / 2 + s;
        y = -h / 2 + inset;
      } else if ((s -= w) < h) {
        x = w / 2 - inset;
        y = -h / 2 + s;
      } else if ((s -= h) < w) {
        x = w / 2 - s;
        y = h / 2 - inset;
      } else {
        s -= w;
        x = -w / 2 + inset;
        y = h / 2 - s;
      }
      // keep clear of rounded corners
      const cx = Math.abs(x) - (w / 2 - this.arena.corner);
      const cy = Math.abs(y) - (h / 2 - this.arena.corner);
      if (cx > 0 && cy > 0 && Math.hypot(cx, cy) > this.arena.corner - 70) continue;
      props.push({ x, y, type: types[Math.floor(rng() * types.length)], s: 0.7 + rng() * 0.6, ph: rng() * TAU });
    }
    const patches = [];
    for (let i = 0; i < 14; i++) patches.push({ x: (rng() - 0.5) * w * 0.85, y: (rng() - 0.5) * h * 0.85, r: 80 + rng() * 160 });
    const rocks = [];
    for (let i = 0; i < 12; i++) {
      const a = rng() * TAU;
      rocks.push({ x: Math.cos(a) * (w / 2 + 120 + rng() * 200), y: Math.sin(a) * (h / 2 + 100 + rng() * 160), r: 16 + rng() * 34, ph: rng() * TAU });
    }
    this.props = props.sort((a, b) => a.y - b.y);
    this.patches = patches;
    this.rocks = rocks;
  }

  // ---------------------------------------------------------------- render
  render() {
    if (!this.def) return;
    const g = this.game;
    const v = g.view;
    const ctx = v.ctx;
    const th = this.theme;
    const t = this.t;
    const q = g.quality;
    v.screen();
    this.sky.draw(ctx, v.w, v.h, {
      colors: [th.skyTop, mix(th.skyTop, th.skyBottom, 0.55), th.skyBottom],
      night: 1, t, camX: this.cam.x, camY: this.cam.y, cloudAlpha: 0.55, sun: false, reduced: g.reducedMotion, quality: q,
    });
    this.drawDistant(ctx, v);
    this.cam.apply(v);
    this.drawArena(ctx);
    this.drawProps(ctx);
    this.drawGate(ctx);
    const view = this.cam.bounds(v);
    for (const h of this.hazards) if (h.visible && h.def.type === 'storm') h.draw(ctx, t, q);
    for (const h of this.hazards) if (h.visible && h.def.type !== 'storm' && (h.def.type === 'laser' || h.def.type === 'barrier')) h.draw(ctx, t, q);
    this.drawOrbs(ctx, view);
    for (const h of this.hazards) if (h.visible && (h.def.type === 'drone' || h.def.type === 'mine')) h.draw(ctx, t, q);
    this.drawPlayerFx(ctx);
    this.player.draw(ctx, q);
    this.particles.render(ctx, view);
    this.texts.render(ctx);
    v.screen();
    if (q !== 'low') this.sky.drawMotes(ctx, v.w, v.h, t, 0.35, g.reducedMotion);
    this.drawIndicators(ctx, v);
    this.drawOverlays(ctx, v);
  }

  drawDistant(ctx, v) {
    const px = this.cam.x * 0.12;
    const py = this.cam.y * 0.12;
    const t = this.t;
    const s = Math.min(v.w, v.h) / 800;
    drawDistantIsland(ctx, v.w * 0.12 - px, v.h * 0.3 - py, 0.28 * s, 'garden', t);
    drawDistantIsland(ctx, v.w * 0.9 - px, v.h * 0.22 - py, 0.22 * s, 'city', t);
    drawDistantIsland(ctx, v.w * 0.75 - px, v.h * 0.85 - py, 0.18 * s, 'crystal', t);
  }

  /** Static ground, cliff and texture, rendered once per run/resize. */
  buildArenaCache() {
    const { w, h } = this.arena;
    const v = this.game.view;
    const q = this.game.quality;
    const maxScale = q === 'low' ? 0.5 : q === 'medium' ? 0.75 : 1;
    const scale = clamp(this.cam.baseZoom * v.dpr, 0.4, maxScale);
    const pad = 40;
    const x0 = -w / 2 - pad;
    const y0 = -h / 2 - pad;
    const cw = w + pad * 2;
    const ch = h + pad * 2 + 180;
    const c = document.createElement('canvas');
    c.width = Math.ceil(cw * scale);
    c.height = Math.ceil(ch * scale);
    const g = c.getContext('2d');
    g.setTransform(scale, 0, 0, scale, -x0 * scale, -y0 * scale);
    this.paintArena(g);
    this.arenaCache = { canvas: c, x0, y0, cw, ch };
  }

  paintArena(ctx) {
    const { w, h, corner } = this.arena;
    const th = this.theme;
    const hw = w / 2;
    const hh = h / 2;
    // cliff thickness + hanging rock
    ctx.fillStyle = th.rockDark;
    roundRectPath(ctx, -hw + 20, -hh + 60, w - 40, h + 20, corner);
    ctx.fill();
    ctx.beginPath();
    for (let i = 0; i <= 10; i++) {
      const x = -hw + corner * 0.6 + (i / 10) * (w - corner * 1.2);
      const depth = 60 + Math.sin(i * 2.3) * 30 + (i % 3) * 25;
      if (i === 0) ctx.moveTo(x, hh);
      ctx.lineTo(x + 20, hh + depth);
      ctx.lineTo(x + (w - corner * 1.2) / 20, hh + 20);
    }
    ctx.lineTo(hw - corner * 0.6, hh);
    ctx.closePath();
    ctx.fill();
    glow(ctx, 0, hh + 90, 160, th.edge, 0.35);
    ctx.fillStyle = th.rock;
    roundRectPath(ctx, -hw, -hh + 26, w, h, corner);
    ctx.fill();
    // ground
    const grad = ctx.createRadialGradient(0, -hh * 0.2, 50, 0, 0, Math.max(w, h) * 0.7);
    grad.addColorStop(0, th.ground2);
    grad.addColorStop(1, th.ground);
    ctx.fillStyle = grad;
    roundRectPath(ctx, -hw, -hh, w, h, corner);
    ctx.fill();
    ctx.save();
    roundRectPath(ctx, -hw, -hh, w, h, corner);
    ctx.clip();
    for (const pa of this.patches) softBlob(ctx, pa.x, pa.y, pa.r, pa.r * 0.7, th.ground2, 0.5);
    const pattern = makeHexPattern(ctx, th.grid);
    if (pattern) {
      ctx.globalAlpha = 0.55;
      ctx.fillStyle = pattern;
      ctx.fillRect(-hw, -hh, w, h);
      ctx.globalAlpha = 1;
    }
    ctx.restore();
    ctx.strokeStyle = rgba(th.edge, 0.55);
    ctx.lineWidth = 5;
    roundRectPath(ctx, -hw + 3, -hh + 3, w - 6, h - 6, corner);
    ctx.stroke();
  }

  drawArena(ctx) {
    const { w, h, corner } = this.arena;
    const th = this.theme;
    const t = this.t;
    const hw = w / 2;
    const hh = h / 2;
    // floating rocks in the void
    for (const r of this.rocks) {
      const y = r.y + Math.sin(t * 0.8 + r.ph) * 8;
      ctx.fillStyle = th.rockDark;
      polyPath(ctx, r.x, y + 6, 6, r.r, r.ph);
      ctx.fill();
      ctx.fillStyle = th.rock;
      polyPath(ctx, r.x, y, 6, r.r, r.ph);
      ctx.fill();
      glow(ctx, r.x, y + r.r, r.r, th.edge, 0.25);
    }
    if (!this.arenaCache) this.buildArenaCache();
    const a = this.arenaCache;
    ctx.drawImage(a.canvas, a.x0, a.y0, a.cw, a.ch);
    // animated inner boundary
    const p = this.player;
    ctx.strokeStyle = rgba(th.edge, 0.3);
    ctx.lineWidth = 2;
    ctx.setLineDash([16, 14]);
    ctx.lineDashOffset = -t * 30;
    roundRectPath(ctx, -hw + 16, -hh + 16, w - 32, h - 32, corner - 12);
    ctx.stroke();
    ctx.setLineDash([]);
    if (p && p.edgeGlow > 0 && p.edgeNormal) {
      const ex = p.x + p.edgeNormal.x * 34;
      const ey = p.y + p.edgeNormal.y * 34;
      glow(ctx, ex, ey, 90, th.edge, p.edgeGlow * 0.9);
      ctx.strokeStyle = rgba('#ffffff', p.edgeGlow * 0.7);
      ctx.lineWidth = 3;
      ctx.beginPath();
      const nx = p.edgeNormal.x;
      const ny = p.edgeNormal.y;
      ctx.moveTo(ex - ny * 50, ey + nx * 50);
      ctx.lineTo(ex + ny * 50, ey - nx * 50);
      ctx.stroke();
    }
  }

  drawProps(ctx) {
    const t = this.t;
    const th = this.theme;
    for (const pr of this.props) {
      const { x, y, s } = pr;
      switch (pr.type) {
        case 'crystal': {
          const c = [th.edge, th.accent, '#ffffff'];
          for (let i = 0; i < 3; i++) {
            const ox = (i - 1) * 12 * s;
            const hgt = (30 - Math.abs(i - 1) * 10) * s;
            ctx.fillStyle = c[i % 3];
            ctx.globalAlpha = i === 2 ? 0.7 : 1;
            ctx.beginPath();
            ctx.moveTo(x + ox - 7 * s, y);
            ctx.lineTo(x + ox, y - hgt);
            ctx.lineTo(x + ox + 7 * s, y);
            ctx.closePath();
            ctx.fill();
          }
          ctx.globalAlpha = 1;
          glow(ctx, x, y - 12 * s, 36 * s, th.edge, 0.3);
          break;
        }
        case 'bush':
          ctx.fillStyle = mix(th.ground2, '#ffffff', 0.18);
          circle(ctx, x - 10 * s, y, 13 * s);
          ctx.fill();
          circle(ctx, x + 9 * s, y + 1, 11 * s);
          ctx.fill();
          circle(ctx, x, y - 8 * s, 14 * s);
          ctx.fill();
          glow(ctx, x + 4 * s, y - 10 * s, 8 * s, th.accent, 0.6);
          break;
        case 'flower':
          for (let i = 0; i < 4; i++) {
            const a = pr.ph + i * 1.7;
            const fx = x + Math.cos(a) * 14 * s;
            const fy = y + Math.sin(a) * 8 * s;
            glow(ctx, fx, fy, 10 * s, i % 2 ? th.accent : th.edge, 0.7);
            ctx.fillStyle = '#ffffff';
            starPath(ctx, fx, fy, 5, 4 * s, 2 * s, t * 0.4 + i);
            ctx.fill();
          }
          break;
        case 'tree':
          ctx.fillStyle = 'rgba(5,8,24,0.3)';
          ellipsePath(ctx, x, y + 6, 24 * s, 8 * s);
          ctx.fill();
          ctx.fillStyle = mix(th.accent, '#000000', 0.25);
          circle(ctx, x, y - 6 * s, 24 * s);
          ctx.fill();
          ctx.fillStyle = th.accent;
          circle(ctx, x - 5 * s, y - 11 * s, 16 * s);
          ctx.fill();
          break;
        case 'lamp':
          ctx.fillStyle = '#d8dcff';
          ctx.fillRect(x - 2, y - 30 * s, 4, 30 * s);
          glow(ctx, x, y - 32 * s, 26 * s, th.edge, 0.7 + Math.sin(t * 2 + pr.ph) * 0.2);
          ctx.fillStyle = '#ffffff';
          circle(ctx, x, y - 32 * s, 5 * s);
          ctx.fill();
          break;
        case 'pylon':
          ctx.fillStyle = '#2a2d66';
          polyPath(ctx, x, y, 6, 16 * s, 0);
          ctx.fill();
          ctx.fillStyle = th.edge;
          polyPath(ctx, x, y, 6, 8 * s, t * 0.6 + pr.ph);
          ctx.fill();
          glow(ctx, x, y, 30 * s, th.edge, 0.35 + Math.sin(t * 3 + pr.ph) * 0.15);
          break;
        default:
          break;
      }
    }
  }

  drawGate(ctx) {
    const gt = this.gate;
    const t = this.t;
    if (this.def.type === 'tutorial' && !gt.open) return;
    const { x, y } = gt;
    if (!gt.open) {
      ctx.strokeStyle = 'rgba(200,210,255,0.3)';
      ctx.lineWidth = 6;
      circle(ctx, x, y, GATE_R);
      ctx.stroke();
      ctx.setLineDash([6, 10]);
      ctx.lineWidth = 2;
      circle(ctx, x, y, GATE_R - 12);
      ctx.stroke();
      ctx.setLineDash([]);
      // padlock
      ctx.strokeStyle = 'rgba(220,225,255,0.6)';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(x, y - 4, 9, Math.PI, 0);
      ctx.stroke();
      ctx.fillStyle = 'rgba(220,225,255,0.6)';
      roundRectPath(ctx, x - 13, y - 4, 26, 18, 4);
      ctx.fill();
      return;
    }
    const k = Math.min(1, gt.t / 0.6);
    const r = GATE_R * ease.outBack(k);
    glow(ctx, x, y, r * 3, '#48f5a0', 0.5);
    // beacon
    const beam = ctx.createLinearGradient(x, y - 420, x, y);
    beam.addColorStop(0, 'rgba(72,245,160,0)');
    beam.addColorStop(1, 'rgba(72,245,160,0.3)');
    ctx.fillStyle = beam;
    ctx.fillRect(x - r * 0.6, y - 420, r * 1.2, 420);
    ctx.save();
    circle(ctx, x, y, r);
    ctx.clip();
    const bg = ctx.createRadialGradient(x, y, 2, x, y, r);
    bg.addColorStop(0, '#ffffff');
    bg.addColorStop(0.4, '#9dffd0');
    bg.addColorStop(1, '#1c8f68');
    ctx.fillStyle = bg;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
    ctx.lineWidth = 4;
    for (let i = 0; i < 4; i++) {
      const a = t * 3 + (i * TAU) / 4;
      ctx.strokeStyle = i % 2 ? 'rgba(255,255,255,0.8)' : 'rgba(53,232,255,0.7)';
      ctx.beginPath();
      ctx.arc(x, y, 10 + i * 11, a, a + 1.8);
      ctx.stroke();
    }
    ctx.restore();
    ctx.strokeStyle = '#eafff5';
    ctx.lineWidth = 6;
    circle(ctx, x, y, r);
    ctx.stroke();
    if (gt.charge > 0) {
      ctx.strokeStyle = '#ffd34a';
      ctx.lineWidth = 8;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.arc(x, y, r + 10, -Math.PI / 2, -Math.PI / 2 + TAU * Math.min(1, gt.charge));
      ctx.stroke();
      glow(ctx, x, y, r * 2, '#ffd34a', gt.charge * 0.6);
    }
    ctx.font = '700 13px Fredoka, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#eafff5';
    ctx.fillText(gt.charge > 0 ? 'WARPING…' : 'EXIT', x, y + r + 26);
  }

  animOrbScale(o) {
    if (o.state === 'spawn') return o.k <= 0 ? 0 : ease.outBack(Math.min(1, o.k));
    if (o.state === 'collect') return Math.max(0, 1 - o.k);
    return 1;
  }

  drawOrbs(ctx, view) {
    const t = this.t;
    const low = this.game.quality === 'low';
    for (const o of this.orbs) {
      if (o.x < view.x0 - 60 || o.x > view.x1 + 60 || o.y < view.y0 - 60 || o.y > view.y1 + 60) continue;
      const sc = this.animOrbScale(o);
      if (sc <= 0.01) continue;
      const bob = Math.sin(t * 3 + o.ph) * 3;
      const x = o.x;
      const y = o.y + bob;
      const pulse = sc * (1 + Math.sin(t * 5 + o.ph) * 0.06);
      const r = o.r * pulse;
      let alpha = 1;
      if (o.life < 3) alpha = Math.sin(o.life * 18) > 0 ? 1 : 0.35;
      ctx.globalAlpha = alpha;
      // Pre-rendered body + glow (one drawImage per orb).
      const spr = orbSprite(o.type, low);
      const half = spr.half * pulse;
      ctx.drawImage(spr.canvas, x - half, y - half, half * 2, half * 2);
      // Cheap animated details on top.
      switch (o.type) {
        case 'blue':
          ctx.strokeStyle = 'rgba(255,255,255,0.7)';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.ellipse(x, y, r * 1.45, r * 0.45, t * 2 + o.ph, 0, TAU);
          ctx.stroke();
          break;
        case 'gold':
          ctx.fillStyle = '#ffffff';
          starPath(ctx, x + r * 0.9, y - r * 0.9, 4, 4 + Math.sin(t * 6) * 2, 1.2, 0);
          ctx.fill();
          break;
        case 'rainbow': {
          ctx.lineWidth = 3;
          for (let i = 0; i < 6; i++) {
            ctx.strokeStyle = RAINBOW[i];
            ctx.beginPath();
            ctx.arc(x, y, r + 5, t * 3 + (i * TAU) / 6, t * 3 + ((i + 1) * TAU) / 6);
            ctx.stroke();
          }
          break;
        }
        case 'giant':
          ctx.strokeStyle = 'rgba(255,255,255,0.8)';
          ctx.lineWidth = 2.5;
          ctx.beginPath();
          ctx.ellipse(x, y, r * 1.5, r * 0.4, t * 1.5, 0, TAU);
          ctx.stroke();
          ctx.beginPath();
          ctx.ellipse(x, y, r * 1.5, r * 0.4, -t * 1.2 + 1, 0, TAU);
          ctx.stroke();
          break;
        case 'time':
          ctx.strokeStyle = '#1f6b2a';
          ctx.lineWidth = 2.5;
          ctx.beginPath();
          ctx.moveTo(x, y);
          ctx.lineTo(x + Math.cos(t * 3) * r * 0.4, y + Math.sin(t * 3) * r * 0.4);
          ctx.stroke();
          break;
        default:
          break;
      }
    }
    ctx.globalAlpha = 1;
  }

  drawPlayerFx(ctx) {
    const p = this.player;
    if (!p) return;
    const t = this.t;
    if (p.magnetBoost > 0) {
      const r = p.magnetBoost;
      ctx.strokeStyle = rgba(p.palette.accent, 0.35);
      ctx.lineWidth = 3;
      circle(ctx, p.x, p.y, r);
      ctx.stroke();
      ctx.strokeStyle = rgba(p.palette.accent, 0.5);
      ctx.lineWidth = 2;
      for (let i = 0; i < 6; i++) {
        const a = t * 1.5 + (i * TAU) / 6;
        const rr = r * (1 - ((t * 0.8 + i / 6) % 1));
        ctx.beginPath();
        ctx.arc(p.x, p.y, rr, a, a + 0.5);
        ctx.stroke();
      }
    }
    if (this.abilityState && p.id === 'echo') {
      for (let i = 0; i < 2; i++) {
        ctx.strokeStyle = rgba(p.palette.accent, 0.6);
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.ellipse(p.x, p.y, 44 + i * 12, 16 + i * 5, t * (i ? -3 : 3), 0, TAU);
        ctx.stroke();
      }
    }
  }

  drawIndicators(ctx, v) {
    const targets = [];
    if (this.gate.open) targets.push({ x: this.gate.x, y: this.gate.y, color: '#48f5a0', label: 'GATE' });
    for (const o of this.orbs) {
      if (o.state === 'collect') continue;
      if (o.type === 'giant' || (this.tutorial && o.type === 'gold')) targets.push({ x: o.x, y: o.y, color: ORB_TYPES[o.type].color, label: o.type === 'giant' ? '+20' : 'GOLD' });
    }
    const pad = 40;
    const top = 92;
    const bottom = 110;
    for (const tg of targets) {
      const s = this.cam.toScreen(v, tg.x, tg.y);
      if (s.x > pad && s.x < v.w - pad && s.y > top && s.y < v.h - bottom) continue;
      const cx = v.w / 2;
      const cy = v.h / 2;
      const dx = s.x - cx;
      const dy = s.y - cy;
      const kx = dx !== 0 ? (dx > 0 ? v.w - pad - cx : pad - cx) / dx : Infinity;
      const ky = dy !== 0 ? (dy > 0 ? v.h - bottom - cy : top - cy) / dy : Infinity;
      const k = Math.min(Math.abs(kx), Math.abs(ky));
      const ix = cx + dx * k;
      const iy = cy + dy * k;
      const a = Math.atan2(dy, dx);
      const pulse = 1 + Math.sin(this.t * 6) * 0.1;
      glow(ctx, ix, iy, 30, tg.color, 0.5);
      ctx.save();
      ctx.translate(ix, iy);
      ctx.rotate(a);
      ctx.scale(pulse, pulse);
      ctx.fillStyle = tg.color;
      ctx.beginPath();
      ctx.moveTo(16, 0);
      ctx.lineTo(-8, -11);
      ctx.lineTo(-3, 0);
      ctx.lineTo(-8, 11);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
      ctx.font = '700 11px Fredoka, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#ffffff';
      ctx.fillText(tg.label, ix - Math.cos(a) * 26, iy - Math.sin(a) * 22);
    }
  }

  drawOverlays(ctx, v) {
    if (!this.vignette || this.vignette.w !== v.w || this.vignette.h !== v.h) {
      // Cached at half resolution — a single image blit per frame.
      const make = (inner, outer, c0, c1) => {
        const c = document.createElement('canvas');
        c.width = Math.max(1, Math.round(v.w / 2));
        c.height = Math.max(1, Math.round(v.h / 2));
        const g = c.getContext('2d');
        const gr = g.createRadialGradient(c.width / 2, c.height / 2, Math.min(c.width, c.height) * inner, c.width / 2, c.height / 2, Math.max(c.width, c.height) * outer);
        gr.addColorStop(0, c0);
        gr.addColorStop(1, c1);
        g.fillStyle = gr;
        g.fillRect(0, 0, c.width, c.height);
        return c;
      };
      this.vignette = { w: v.w, h: v.h, dark: make(0.35, 0.75, 'rgba(0,0,0,0)', 'rgba(3,4,18,0.55)'), red: null, make };
    }
    if (this.game.quality !== 'low') ctx.drawImage(this.vignette.dark, 0, 0, v.w, v.h);
    // low-shield warning
    if (this.phase === 'play' && this.player.shields === 1 && !this.tutorial) {
      const vg = this.vignette;
      if (!vg.red) vg.red = vg.make(0.4, 0.7, 'rgba(255,60,90,0)', 'rgba(255,60,90,1)');
      ctx.globalAlpha = 0.18 + Math.sin(this.t * 5) * 0.08 * (this.game.reducedMotion ? 0 : 1);
      ctx.drawImage(vg.red, 0, 0, v.w, v.h);
      ctx.globalAlpha = 1;
    }
    for (const f of this.flashes) {
      ctx.globalAlpha = Math.max(0, f.a);
      ctx.fillStyle = f.color;
      ctx.fillRect(0, 0, v.w, v.h);
    }
    ctx.globalAlpha = 1;
  }
}

function hitPoint(h, px, py) {
  if (h.ax !== undefined) return closestOnSegment(px, py, h.ax, h.ay, h.bx, h.by);
  if (h.segments) {
    let best = null;
    let bd = Infinity;
    for (const [ax, ay, bx, by] of h.segments()) {
      const c = closestOnSegment(px, py, ax, ay, bx, by);
      const d = dist2(px, py, c.x, c.y);
      if (d < bd) {
        bd = d;
        best = c;
      }
    }
    return best || { x: h.def.x, y: h.def.y };
  }
  if (h.x !== undefined) return { x: h.x, y: h.y };
  return { x: h.def.x, y: h.def.y };
}

function makeHexPattern(ctx, color) {
  try {
    const c = document.createElement('canvas');
    const w = 84;
    const h = 48;
    c.width = w;
    c.height = h;
    const g = c.getContext('2d');
    g.strokeStyle = color;
    g.lineWidth = 1.5;
    const r = 28;
    const hex = (cx, cy) => {
      g.beginPath();
      for (let i = 0; i < 6; i++) {
        const a = (i * Math.PI) / 3;
        const x = cx + Math.cos(a) * r;
        const y = cy + Math.sin(a) * r;
        if (i === 0) g.moveTo(x, y);
        else g.lineTo(x, y);
      }
      g.closePath();
      g.stroke();
    };
    hex(0, 0);
    hex(w, 0);
    hex(0, h);
    hex(w, h);
    hex(w / 2, h / 2);
    return ctx.createPattern(c, 'repeat');
  } catch {
    return null;
  }
}

const RAINBOW = ['#ff5470', '#ff9838', '#ffd34a', '#48f5a0', '#35e8ff', '#9b5cff'];
const orbSprites = new Map();

/** Orb body + soft glow rendered once per type/quality into an offscreen canvas. */
function orbSprite(type, low) {
  const key = `${type}|${low ? 1 : 0}`;
  let spr = orbSprites.get(key);
  if (spr) return spr;
  const T = ORB_TYPES[type];
  const k = 2; // supersample for crisp scaling on high-DPI screens
  const r = T.radius;
  const half = r * (low ? 2.4 : 3.5);
  const size = Math.ceil(half * 2 * k);
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  g.scale(k, k);
  const cx = half;
  const cy = half;
  const gl = g.createRadialGradient(cx, cy, 0, cx, cy, half);
  const ga = type === 'blue' ? 0.5 : 0.75;
  gl.addColorStop(0, rgba(T.color, ga));
  gl.addColorStop(0.3, rgba(T.color, ga * 0.45));
  gl.addColorStop(1, rgba(T.color, 0));
  g.fillStyle = gl;
  g.fillRect(0, 0, half * 2, half * 2);
  const body = g.createRadialGradient(cx - r * 0.35, cy - r * 0.35, r * 0.1, cx, cy, r);
  body.addColorStop(0, '#ffffff');
  body.addColorStop(0.45, T.core);
  body.addColorStop(1, T.color);
  g.fillStyle = body;
  circle(g, cx, cy, r);
  g.fill();
  switch (type) {
    case 'gold':
      g.fillStyle = '#fff6cf';
      starPath(g, cx, cy, 5, r * 0.62, r * 0.3);
      g.fill();
      break;
    case 'giant':
      g.font = `700 ${Math.round(r * 0.8)}px Fredoka, 'Trebuchet MS', sans-serif`;
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillStyle = '#1b5f8f';
      g.fillText('20', cx, cy + 1);
      break;
    case 'time':
      g.strokeStyle = '#1f6b2a';
      g.lineWidth = 2.5;
      circle(g, cx, cy, r * 0.6);
      g.stroke();
      g.beginPath();
      g.moveTo(cx, cy);
      g.lineTo(cx, cy - r * 0.45);
      g.stroke();
      break;
    case 'shield':
      g.fillStyle = '#2a4fb0';
      polyPath(g, cx, cy, 6, r * 0.62, Math.PI / 6);
      g.fill();
      g.fillStyle = '#ffffff';
      polyPath(g, cx, cy, 6, r * 0.34, Math.PI / 6);
      g.fill();
      break;
    default:
      break;
  }
  spr = { canvas: c, half };
  orbSprites.set(key, spr);
  return spr;
}
