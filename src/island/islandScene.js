// Nexus Island: the player's home and the main menu backdrop.
// The active Nex can be flown around (tap-to-move or WASD); walking up to a
// building shows an interaction prompt. Buildings visibly appear and evolve
// with a construction animation, and the sky runs a visual day/night cycle.

import { TAU, clamp, damp, rand, ease, pick } from '../core/math.js';
import { Camera } from '../render/view.js';
import { Sky, skyColors, nightFactor } from '../render/sky.js';
import { glow, rgba, roundRectPath, circle, ellipsePath, shadow } from '../render/draw.js';
import { drawNex } from '../render/nexRenderer.js';
import {
  ISLAND, scenery, drawIslandUnderside, drawIslandTop, drawTree, drawBuilding, buildingHeight,
  drawPlot, drawDecor, drawBot, drawVehicle, drawDistantIsland,
} from '../render/islandArt.js';
import { BUILDINGS, BUILDING_ORDER, DECOR_SLOTS, WORLD_ISLANDS } from '../data/buildings.js';
import { el, esc } from '../core/dom.js';
import { icon } from '../ui/icons.js';
import { fmt } from '../core/math.js';

const PATHS = [
  { x0: 0, y0: 30, cx: 0, cy: 110, x1: 0, y1: 185 },
  { x0: -110, y0: -10, cx: -230, cy: 40, x1: -330, y1: 150 },
  { x0: 110, y0: -10, cx: 230, cy: 40, x1: 340, y1: 160 },
  { x0: -130, y0: -40, cx: -240, cy: -80, x1: -320, y1: -60 },
  { x0: 130, y0: -40, cx: 240, cy: -80, x1: 320, y1: -60 },
];

const BOT_COLORS = ['#35e8ff', '#ff7ad9', '#ffd34a', '#48f5a0', '#b88cff'];

export class IslandScene {
  constructor(game) {
    this.game = game;
    this.cam = new Camera();
    this.sky = new Sky(3);
    this.t = 0;
    this.dayPhase = 0.14;
    this.interactive = false;
    this.player = { x: -140, y: 120, vx: 0, vy: 0, target: null, lean: 0, look: { x: 0, y: 0.2 }, blink: 0, nextBlink: 2, expr: 'idle', exprT: 0, idle: 0, spin: 0 };
    this.nearest = null;
    this.promptKey = '';
    this.prompt = null;
    this.speech = null;
    this.labels = [];
    this.bots = [];
    this.vehicles = [];
    this.vehicleTimer = 3;
    this.construction = null;
    this.decorating = false;
    this.focus = null;
    this.worldUI = document.getElementById('world-ui');
  }

  get d() {
    return this.game.data;
  }

  enter() {
    this.game.input.handler = this;
    this.resize();
    this.cam.reducedMotion = this.game.reducedMotion;
    this.syncBots();
    this.buildLabels();
    if (!this.entered) {
      this.cam.snap(0, 10);
      this.entered = true;
    }
  }

  exit() {
    this.setInteractive(false);
    this.clearLabels();
    this.hideSpeech();
  }

  setInteractive(on) {
    this.interactive = on;
    if (!on) {
      this.hidePrompt();
      this.player.target = null;
    }
  }

  resize() {
    const v = this.game.view;
    const avail = v.h - 180;
    let z = Math.min(v.w / 1320, avail / 860);
    // Portrait phones: zoom in and let the camera follow the Nex sideways.
    if (v.h > v.w * 1.2) z = Math.max(z, v.w / 720);
    this.cam.baseZoom = clamp(z, 0.46, 1.3);
  }

  // ---------------------------------------------------------------- helpers
  isBuilt(id) {
    return (this.d.buildings[id]?.level || 0) > 0;
  }

  syncBots() {
    const built = BUILDING_ORDER.filter((id) => this.isBuilt(id)).length;
    const want = Math.min(6, 1 + Math.max(0, built - 3) + this.d.buildings.hub.level - 1);
    while (this.bots.length < want) {
      const a = rand(0, TAU);
      this.bots.push({ x: Math.cos(a) * 250, y: Math.sin(a) * 140 + 40, tx: 0, ty: 0, wait: rand(0, 2), color: BOT_COLORS[this.bots.length % BOT_COLORS.length], facing: 1, ph: rand(0, 6) });
    }
    this.bots.length = want;
  }

  inside(x, y, margin = 40) {
    const rx = ISLAND.rx - margin;
    const ry = ISLAND.ry - margin * 0.7;
    return (x * x) / (rx * rx) + (y * y) / (ry * ry) <= 1;
  }

  clampInside(x, y, margin = 40) {
    const rx = ISLAND.rx - margin;
    const ry = ISLAND.ry - margin * 0.7;
    const k = (x * x) / (rx * rx) + (y * y) / (ry * ry);
    if (k <= 1) return { x, y };
    const s = 1 / Math.sqrt(k);
    return { x: x * s, y: y * s };
  }

  obstacles() {
    const out = [];
    for (const id of BUILDING_ORDER) {
      const b = BUILDINGS[id];
      if (this.isBuilt(id)) out.push({ x: b.slot.x, y: b.slot.y, r: b.radius * 0.72 });
    }
    return out;
  }

  // ---------------------------------------------------------------- input
  pointerDown(sx, sy) {
    if (!this.interactive && !this.decorating) return;
    const v = this.game.view;
    const w = this.cam.toWorld(v, sx, sy);
    if (this.decorating) {
      const slot = DECOR_SLOTS.find((s) => Math.hypot(w.x - s.x, (w.y - s.y) * 1.4) < 48);
      if (slot) this.game.ui.openDecorPicker(slot.id);
      return;
    }
    // Tap a building (within its drawn bounds) → fly to it.
    for (const id of BUILDING_ORDER) {
      const b = BUILDINGS[id];
      const hgt = this.isBuilt(id) ? buildingHeight(id, this.d.buildings[id].level) : 70;
      if (Math.abs(w.x - b.slot.x) < b.radius && w.y < b.slot.y + 30 && w.y > b.slot.y - hgt) {
        this.moveTo(b.slot.x + (w.x > b.slot.x ? 1 : -1) * 10, b.slot.y + b.radius * 0.55 + 14);
        return;
      }
    }
    this.moveTo(w.x, w.y);
  }

  moveTo(x, y) {
    const c = this.clampInside(x, y, 50);
    this.player.target = c;
    this.game.audio.play('tab', { gap: 60 });
    this.game.particles.ring(c.x, c.y, { color: '#ffffff', radius: 26, life: 0.4, width: 2 });
  }

  // ---------------------------------------------------------------- interaction prompt
  findNearest() {
    const p = this.player;
    let best = null;
    let bd = Infinity;
    for (const id of BUILDING_ORDER) {
      const b = BUILDINGS[id];
      const dx = p.x - b.slot.x;
      const dy = (p.y - b.slot.y) * 1.3;
      const d = Math.hypot(dx, dy);
      if (d < b.radius + 70 && d < bd) {
        bd = d;
        best = id;
      }
    }
    return best;
  }

  promptInfo(id) {
    const prog = this.game.progress;
    const b = BUILDINGS[id];
    const lvl = prog.buildingLevel(id);
    if (b.fixed) {
      if (id === 'portal') return { name: b.name, btn: 'PLAY', cls: 'btn-play', icon: 'play', action: 'play' };
      return { name: b.name, btn: 'OPEN', cls: 'btn-primary', icon: 'shop', action: 'shop' };
    }
    if (lvl <= 0) {
      const st = prog.buildStatus(id);
      if (st.state === 'locked') return { name: b.name, note: `${st.reason} to build`, action: null };
      return {
        name: b.name,
        btn: `BUILD`,
        sub: costHtml(st.cost),
        cls: st.afford ? 'btn-green' : '',
        disabled: !st.afford,
        note: st.afford ? '' : 'Not enough resources',
        action: 'build',
      };
    }
    const sub = b.maxLevel > 1 ? ` · Lv ${lvl}` : '';
    switch (b.action) {
      case 'upgrade':
        return { name: b.name + sub, btn: 'UPGRADE', cls: 'btn-primary', icon: 'build', action: 'islandPanel' };
      case 'collect': {
        const info = prog.generatorInfo();
        const n = info ? info.stored : 0;
        return { name: b.name + sub, btn: n > 0 ? `COLLECT` : 'CHARGING…', sub: n > 0 ? `${icon('energy')}${n}` : '', cls: n > 0 ? 'btn-primary' : '', disabled: n <= 0, action: 'collect', key: `c${n}` };
      }
      case 'nex':
        return { name: b.name, btn: 'OPEN', cls: 'btn-primary', icon: 'nex', action: 'nex' };
      case 'decorate':
        return { name: b.name, btn: 'DECORATE', cls: 'btn-pink', icon: 'decor', action: 'decorate' };
      default:
        return { name: b.name, action: null };
    }
  }

  updatePrompt() {
    const id = this.interactive && !this.construction ? this.findNearest() : null;
    if (!id) {
      this.hidePrompt();
      return;
    }
    const info = this.promptInfo(id);
    const key = `${id}|${info.btn}|${info.sub}|${info.note}|${info.disabled}|${info.key || ''}`;
    if (key !== this.promptKey || !this.prompt) {
      this.hidePrompt();
      this.promptKey = key;
      const p = el('div', 'world-prompt');
      p.innerHTML = `<div class="wp-name">${esc(info.name)}</div>${
        info.btn
          ? `<button class="btn ${info.cls || ''}" ${info.disabled ? 'disabled' : ''} data-id="${id}">${info.icon ? icon(info.icon) : ''}${esc(info.btn)}${info.sub ? `<span class="btn-sub">${info.sub}</span>` : ''}</button>`
          : ''
      }${info.note ? `<div class="wp-note">${esc(info.note)}</div>` : ''}`;
      const btn = p.querySelector('button');
      if (btn) btn.addEventListener('click', () => this.activate(id));
      this.worldUI.appendChild(p);
      this.prompt = p;
      this.nearest = id;
      this.promptAction = info.disabled ? null : info.action;
    }
    const b = BUILDINGS[id];
    const lvl = this.d.buildings[id]?.level || 0;
    const hgt = lvl > 0 ? buildingHeight(id, lvl) : 80;
    const s = this.cam.toScreen(this.game.view, b.slot.x, b.slot.y - hgt - 8);
    const x = clamp(s.x, 90, this.game.view.w - 90);
    const y = clamp(s.y, 150, this.game.view.h - 120);
    this.prompt.style.left = `${x}px`;
    this.prompt.style.top = `${y}px`;
  }

  hidePrompt() {
    if (this.prompt) this.prompt.remove();
    this.prompt = null;
    this.nearest = null;
    this.promptKey = '';
    this.promptAction = null;
  }

  /** E / Enter key or prompt button. */
  interact() {
    if (this.nearest && this.promptAction) this.activate(this.nearest);
  }

  activate(id) {
    const info = this.promptInfo(id);
    if (!info.action || info.disabled) {
      this.game.audio.play('deny');
      return;
    }
    this.game.audio.play('click');
    this.game.onBuildingAction(id, info.action);
    this.promptKey = '';
  }

  // ---------------------------------------------------------------- labels (distant islands, plots)
  buildLabels() {
    this.clearLabels();
    for (const isl of WORLD_ISLANDS) {
      const b = el('button', 'world-label', `${icon('lock')}${esc(isl.name)}`);
      b.setAttribute('aria-label', `${isl.name}: ${isl.note}`);
      b.addEventListener('click', () => {
        this.game.audio.play('tab');
        this.game.ui.toast({ kicker: 'Locked area', title: `${isl.name}`, text: isl.note, icon: 'lock' });
      });
      this.worldUI.appendChild(b);
      this.labels.push({ el: b, x: isl.x, y: isl.y - 150 * isl.scale - 30, parallax: 0.3 });
    }
  }

  clearLabels() {
    for (const l of this.labels) l.el.remove();
    this.labels = [];
  }

  updateLabels() {
    const v = this.game.view;
    const show = this.interactive || this.decorating;
    for (const l of this.labels) {
      const s = this.cam.toScreen(v, l.x + this.cam.x * l.parallax, l.y + this.cam.y * l.parallax);
      const vis = show && s.x > 40 && s.x < v.w - 40 && s.y > 90 && s.y < v.h - 120;
      l.el.style.display = vis ? '' : 'none';
      if (vis) l.el.style.transform = `translate(${s.x}px, ${s.y}px) translate(-50%, -50%)`;
    }
  }

  // ---------------------------------------------------------------- speech bubble
  say(html, duration = 0) {
    this.hideSpeech();
    const b = el('div', 'speech', html);
    this.worldUI.appendChild(b);
    this.speech = { el: b, until: duration ? this.t + duration : Infinity };
    b.addEventListener('click', () => this.hideSpeech());
  }

  hideSpeech() {
    if (this.speech) this.speech.el.remove();
    this.speech = null;
  }

  updateSpeech() {
    if (!this.speech) return;
    if (this.t > this.speech.until) {
      this.hideSpeech();
      return;
    }
    const v = this.game.view;
    const s = this.cam.toScreen(v, this.player.x, this.player.y - 70);
    this.speech.el.style.left = `${clamp(s.x, 160, v.w - 160)}px`;
    this.speech.el.style.top = `${Math.max(170, s.y)}px`;
  }

  // ---------------------------------------------------------------- construction
  playConstruction(id) {
    this.construction = { id, t: 0, dur: 2.6, flashed: false, prevLevel: Math.max(0, (this.d.buildings[id]?.level || 1) - 1) };
    const b = BUILDINGS[id];
    this.focus = { x: b.slot.x, y: b.slot.y - 60 };
    this.game.audio.play('build');
    this.hidePrompt();
  }

  updateConstruction(dt) {
    const c = this.construction;
    if (!c) return;
    c.t += dt;
    const p = c.t / c.dur;
    const b = BUILDINGS[c.id];
    const ps = this.game.particles;
    if (p < 0.7 && Math.random() < dt * 40) {
      const a = rand(0, TAU);
      const r = rand(120, 200);
      ps.spawn({ x: b.slot.x + Math.cos(a) * r, y: b.slot.y - 50 + Math.sin(a) * r * 0.6, target: { x: b.slot.x, y: b.slot.y - 50 }, homing: 1400, drag: 2.5, life: 0.9, size: 3, color: Math.random() < 0.5 ? '#35e8ff' : '#ffffff', type: 'dot' });
    }
    if (p >= 0.8 && !c.flashed) {
      c.flashed = true;
      this.game.audio.play('buildDone');
      ps.ring(b.slot.x, b.slot.y - 40, { color: '#ffffff', radius: 170, life: 0.6, width: 6 });
      ps.burst(b.slot.x, b.slot.y - 60, { count: 30, colors: ['#35e8ff', '#ffd34a', '#ff7ad9', '#ffffff'], speed: 340, type: 'star', size: 4, life: 0.9, drag: 2.5 });
      this.cam.zoomPunch(0.06);
    }
    if (p >= 1) {
      this.construction = null;
      this.focus = null;
      this.syncBots();
      this.game.onConstructionDone(c.id);
    }
  }

  // ---------------------------------------------------------------- update
  update(dt) {
    this.t += dt;
    this.dayPhase = (this.dayPhase + dt / 240) % 1;
    this.cam.update(dt);
    this.game.particles.update(dt);
    this.updatePlayer(dt);
    this.updateBots(dt);
    this.updateVehicles(dt);
    this.updateConstruction(dt);
    this.game.progress.updateGenerator();
    // camera: follow player on narrow screens, or the construction focus
    const v = this.game.view;
    const z = this.cam.zoom;
    const halfW = v.w / 2 / z;
    let tx = 0;
    let ty = 10;
    if (this.focus) {
      tx = this.focus.x;
      ty = this.focus.y + 60;
    } else if (halfW < ISLAND.rx + 60) {
      tx = this.player.x;
    }
    const lim = Math.max(0, ISLAND.rx + 60 - halfW);
    tx = clamp(tx, -lim, lim);
    this.cam.follow(tx, ty, dt, 3.5);
    if (this.interactive) this.updatePrompt();
    this.updateLabels();
    this.updateSpeech();
    if (Math.random() < dt * 3) {
      // ambient energy motes rising from the core
      this.game.particles.spawn({ x: rand(-300, 300), y: rand(360, 560), vx: rand(-8, 8), vy: rand(-50, -25), life: 3, size: 2.5, color: Math.random() < 0.5 ? '#35e8ff' : '#b88cff', type: 'dot', drag: 0 });
    }
  }

  updatePlayer(dt) {
    const p = this.player;
    let mx = 0;
    let my = 0;
    if (this.interactive) {
      const m = this.game.input.getMove(null);
      if (m.mag > 0) {
        mx = m.x;
        my = m.y;
        p.target = null;
      } else if (p.target) {
        const dx = p.target.x - p.x;
        const dy = p.target.y - p.y;
        const d = Math.hypot(dx, dy);
        if (d < 8) p.target = null;
        else {
          const k = Math.min(1, d / 60);
          mx = (dx / d) * k;
          my = (dy / d) * k;
        }
      }
    }
    const speed = 270;
    const tvx = mx * speed;
    const tvy = my * speed * 0.8;
    p.vx = damp(p.vx, tvx, mx || my ? 7 : 5, dt);
    p.vy = damp(p.vy, tvy, mx || my ? 7 : 5, dt);
    let nx = p.x + p.vx * dt;
    let ny = p.y + p.vy * dt;
    for (const o of this.obstacles()) {
      const dx = nx - o.x;
      const dy = (ny - o.y) * 1.6;
      const d = Math.hypot(dx, dy);
      if (d < o.r) {
        const push = (o.r - d) / (d || 1);
        nx += dx * push;
        ny += (dy * push) / 1.6;
      }
    }
    const c = this.clampInside(nx, ny, 50);
    p.x = c.x;
    p.y = c.y;
    const sp = Math.hypot(p.vx, p.vy);
    p.lean = damp(p.lean, clamp(p.vx / speed, -1, 1) * 0.25, 8, dt);
    if (sp > 20) {
      p.look.x = damp(p.look.x, clamp(p.vx / speed, -1, 1), 6, dt);
      p.look.y = damp(p.look.y, clamp(p.vy / speed, -1, 1), 6, dt);
      p.idle = 0;
    } else {
      p.idle += dt;
      // look around while idle
      const lk = Math.sin(this.t * 0.6) * 0.6;
      p.look.x = damp(p.look.x, lk, 2, dt);
      p.look.y = damp(p.look.y, 0.15, 2, dt);
      if (p.idle > 9 && !this.game.reducedMotion) {
        p.idle = 0;
        p.spin = 1;
        p.expr = 'happy';
        p.exprT = 1.2;
      }
    }
    p.spin = Math.max(0, p.spin - dt / 0.9);
    p.nextBlink -= dt;
    if (p.nextBlink <= 0) {
      p.blink = 1;
      p.nextBlink = rand(2.2, 5);
    }
    p.blink = Math.max(0, p.blink - dt * 7);
    if (p.exprT > 0) {
      p.exprT -= dt;
      if (p.exprT <= 0) p.expr = 'idle';
    }
  }

  react(expr = 'happy', t = 1.2) {
    this.player.expr = expr;
    this.player.exprT = t;
    if (expr === 'excited' && !this.game.reducedMotion) this.player.spin = 1;
  }

  updateBots(dt) {
    const targets = BUILDING_ORDER.filter((id) => this.isBuilt(id)).map((id) => BUILDINGS[id].slot);
    for (const b of this.bots) {
      if (b.wait > 0) {
        b.wait -= dt;
        continue;
      }
      const dx = b.tx - b.x;
      const dy = b.ty - b.y;
      const d = Math.hypot(dx, dy);
      if (d < 6 || (!b.tx && !b.ty)) {
        const s = pick(targets.length ? targets : [{ x: 0, y: 0 }]);
        const c = this.clampInside(s.x + rand(-90, 90), s.y + rand(40, 90), 60);
        b.tx = c.x;
        b.ty = c.y;
        b.wait = rand(1, 4);
        continue;
      }
      const sp = 42;
      b.x += (dx / d) * sp * dt;
      b.y += (dy / d) * sp * dt;
      b.facing = dx > 0 ? 1 : -1;
    }
  }

  updateVehicles(dt) {
    if (this.game.reducedMotion) {
      this.vehicles.length = 0;
      return;
    }
    this.vehicleTimer -= dt;
    if (this.vehicleTimer <= 0) {
      this.vehicleTimer = rand(6, 12);
      const dir = Math.random() < 0.5 ? 1 : -1;
      this.vehicles.push({ x: -dir * 1300, y: rand(-560, -330), dir, speed: rand(110, 170), color: pick(BOT_COLORS) });
    }
    for (const v of this.vehicles) v.x += v.dir * v.speed * dt;
    this.vehicles = this.vehicles.filter((v) => Math.abs(v.x) < 1400);
  }

  // ---------------------------------------------------------------- render
  render() {
    const g = this.game;
    const v = g.view;
    const ctx = v.ctx;
    const t = this.t;
    const night = nightFactor(this.dayPhase);
    v.screen();
    this.sky.draw(ctx, v.w, v.h, { colors: skyColors(Math.round(this.dayPhase * 300) / 300), night, t, camX: this.cam.x, camY: this.cam.y, reduced: g.reducedMotion, quality: g.quality });
    this.cam.apply(v);
    // distant islands (parallax)
    for (const isl of WORLD_ISLANDS) {
      drawDistantIsland(ctx, isl.x + this.cam.x * 0.3, isl.y + this.cam.y * 0.3, isl.scale, isl.theme, t);
    }
    for (const veh of this.vehicles) drawVehicle(ctx, veh.x + this.cam.x * 0.2, veh.y, veh.dir, t, veh.color);
    ctx.save();
    ctx.translate(0, Math.sin(t * 0.5) * (g.reducedMotion ? 0 : 4));
    drawIslandUnderside(ctx, t, night, 'back');
    this.drawTerrain(ctx);
    drawIslandUnderside(ctx, t, night, 'live');
    drawIslandTop(ctx, t, night, PATHS, 'live');
    this.drawObjects(ctx, t, night);
    ctx.restore();
    this.game.particles.render(ctx, this.cam.bounds(v));
    // night tint + light pass
    if (night > 0.02) {
      v.screen();
      ctx.globalCompositeOperation = 'multiply';
      ctx.fillStyle = `rgba(70,70,150,${night * 0.35})`;
      ctx.fillRect(0, 0, v.w, v.h);
      ctx.globalCompositeOperation = 'source-over';
      this.cam.apply(v);
      this.drawLights(ctx, night);
    }
    v.screen();
    this.sky.drawMotes(ctx, v.w, v.h, t, 0.3, g.reducedMotion);
  }

  /** Static terrain is rendered once into an offscreen canvas per zoom level. */
  drawTerrain(ctx) {
    const v = this.game.view;
    const q = this.game.quality;
    const cap = q === 'low' ? 0.6 : q === 'medium' ? 1 : 1.5;
    const scale = Math.min(cap, Math.max(0.4, this.cam.baseZoom * v.dpr));
    if (!this.terrain || Math.abs(this.terrain.scale - scale) > 0.01) {
      const x0 = -ISLAND.rx - 10;
      const y0 = -ISLAND.ry - 10;
      const w = ISLAND.rx * 2 + 20;
      const h = ISLAND.ry + ISLAND.cliff + ISLAND.depth + 200;
      const c = (this.terrain && this.terrain.canvas) || document.createElement('canvas');
      c.width = Math.ceil(w * scale);
      c.height = Math.ceil(h * scale);
      const g = c.getContext('2d');
      g.setTransform(scale, 0, 0, scale, -x0 * scale, -y0 * scale);
      g.clearRect(x0, y0, w, h);
      drawIslandUnderside(g, 0, 0, 'static');
      drawIslandTop(g, 0, 0, PATHS, 'static');
      this.terrain = { canvas: c, scale, x0, y0, w, h };
    }
    const tr = this.terrain;
    ctx.drawImage(tr.canvas, tr.x0, tr.y0, tr.w, tr.h);
  }

  drawObjects(ctx, t, night) {
    const d = this.d;
    const items = [];
    const sc = scenery();
    for (const tr of sc.trees) items.push({ y: tr.y, draw: () => drawTree(ctx, tr.x, tr.y, tr.s, t, tr.c, night) });
    for (const id of BUILDING_ORDER) {
      const b = BUILDINGS[id];
      const lvl = d.buildings[id]?.level || 0;
      items.push({ y: b.slot.y, draw: () => this.drawBuildingAt(ctx, id, lvl, t, night) });
    }
    const hasGarden = this.isBuilt('garden');
    for (const slot of DECOR_SLOTS) {
      const item = d.decor.slots[slot.id];
      if (item) {
        items.push({
          y: slot.y,
          draw: () => {
            ctx.save();
            ctx.translate(slot.x, slot.y);
            ctx.scale(1.35, 1.35);
            drawDecor(ctx, item, t, night, { nexId: d.activeNex });
            ctx.restore();
          },
        });
      }
      if (this.decorating && hasGarden) {
        items.push({ y: slot.y - 1, draw: () => this.drawSlotMarker(ctx, slot, !!item, t) });
      }
    }
    for (const b of this.bots) items.push({ y: b.y, draw: () => drawBot(ctx, b.x, b.y, t, b.color, b.facing, b.ph) });
    const p = this.player;
    items.push({ y: p.y, draw: () => this.drawPlayer(ctx, t) });
    items.sort((a, b) => a.y - b.y);
    for (const it of items) it.draw();
    // generator ready bubble
    const gen = this.game.progress.generatorInfo();
    if (gen && gen.stored > 0 && !this.construction) {
      const s = BUILDINGS.generator.slot;
      const y = s.y - buildingHeight('generator', 1) - 22 + Math.sin(t * 3) * 4;
      const text = `+${gen.stored}`;
      ctx.font = '700 18px Fredoka, sans-serif';
      const w = ctx.measureText(text).width + 40;
      glow(ctx, s.x, y, 40, '#35e8ff', gen.full ? 0.8 : 0.4);
      ctx.fillStyle = gen.full ? '#35e8ff' : 'rgba(8,12,36,0.85)';
      roundRectPath(ctx, s.x - w / 2, y - 16, w, 32, 16);
      ctx.fill();
      ctx.fillStyle = gen.full ? '#04142d' : '#bff8ff';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`⚡ ${text}`, s.x, y + 1);
    }
  }

  drawBuildingAt(ctx, id, lvl, t, night) {
    const b = BUILDINGS[id];
    const d = this.d;
    ctx.save();
    ctx.translate(b.slot.x, b.slot.y);
    const c = this.construction && this.construction.id === id ? this.construction : null;
    const opts = {
      fill: id === 'generator' ? (this.game.progress.generatorInfo()?.stored || 0) / (this.game.progress.generatorInfo()?.cap || 1) : 0,
      nexId: d.activeNex,
      palette: this.game.getPalette(d.activeNex),
    };
    if (c) {
      const p = Math.min(1, c.t / c.dur);
      const from = c.prevLevel;
      if (from > 0) {
        // Upgrading: the old building sinks away as the new one rises.
        const k0 = Math.min(1, p / 0.3);
        ctx.save();
        ctx.globalAlpha = 1 - k0;
        drawBuilding(ctx, id, from, t, night, opts);
        ctx.restore();
      } else if (p < 0.3) {
        drawPlot(ctx, t, 'available');
      }
      // blueprint ghost
      if (p < 0.85) {
        ctx.save();
        ctx.globalAlpha = Math.min(1, p / 0.2) * 0.3 * (1 - Math.max(0, (p - 0.6) / 0.25));
        drawBuilding(ctx, id, lvl, t, night, opts);
        ctx.restore();
        ctx.strokeStyle = rgba('#35e8ff', 0.8);
        ctx.lineWidth = 2;
        ctx.setLineDash([8, 8]);
        ctx.lineDashOffset = -t * 40;
        ellipsePath(ctx, 0, 0, b.radius, b.radius * 0.42);
        ctx.stroke();
        ctx.setLineDash([]);
      }
      if (p > 0.25) {
        const k = ease.outCubic(Math.min(1, (p - 0.25) / 0.55));
        const h = buildingHeight(id, lvl) + 40;
        ctx.save();
        ctx.beginPath();
        ctx.rect(-b.radius * 2, -h - 200, b.radius * 4, h + 200 + b.radius * 0.5);
        ctx.clip();
        ctx.translate(0, (1 - k) * h);
        drawBuilding(ctx, id, lvl, t, night, opts);
        ctx.restore();
        glow(ctx, 0, 0, b.radius * 1.4, '#35e8ff', 0.5 * (1 - k));
      }
      ctx.restore();
      return;
    }
    if (lvl > 0) {
      shadow(ctx, 6, 8, b.radius * 1.05, b.radius * 0.42, 0.22);
      drawBuilding(ctx, id, lvl, t, night, opts);
    } else {
      const st = this.game.progress.buildStatus(id);
      drawPlot(ctx, t, st.state === 'locked' ? 'locked' : 'available');
    }
    ctx.restore();
  }

  drawSlotMarker(ctx, slot, filled, t) {
    const pulse = 1 + Math.sin(t * 4) * 0.08;
    ctx.save();
    ctx.translate(slot.x, slot.y);
    ctx.scale(1, 0.5);
    ctx.strokeStyle = filled ? rgba('#ff7ad9', 0.9) : rgba('#35e8ff', 0.95);
    ctx.lineWidth = 4;
    circle(ctx, 0, 0, 38 * pulse);
    ctx.stroke();
    ctx.fillStyle = filled ? rgba('#ff7ad9', 0.15) : rgba('#35e8ff', 0.18);
    ctx.fill();
    ctx.restore();
    if (!filled) {
      glow(ctx, slot.x, slot.y - 20, 30, '#35e8ff', 0.5);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(slot.x - 3, slot.y - 32, 6, 22);
      ctx.fillRect(slot.x - 11, slot.y - 24, 22, 6);
    }
  }

  drawPlayer(ctx, t) {
    const p = this.player;
    const id = this.d.activeNex;
    const hover = 30 + Math.sin(t * 2.6) * (this.game.reducedMotion ? 1 : 5);
    shadow(ctx, p.x, p.y, 18 - Math.sin(t * 2.6) * 2, 7, 0.3);
    const spin = p.spin > 0 ? (1 - p.spin) * TAU : 0;
    drawNex(ctx, id, {
      x: p.x,
      y: p.y - hover,
      scale: 1.35,
      t,
      lean: p.lean + spin,
      look: p.look,
      blink: p.blink,
      expr: p.expr,
      palette: this.game.getPalette(id),
      quality: this.game.quality,
      core: 0.2,
    });
  }

  drawLights(ctx, night) {
    // Extra glows after the night tint so windows and lamps pop.
    const d = this.d;
    for (const id of BUILDING_ORDER) {
      if (!this.isBuilt(id)) continue;
      const b = BUILDINGS[id];
      const h = buildingHeight(id, d.buildings[id].level);
      glow(ctx, b.slot.x, b.slot.y - h * 0.45, b.radius * 1.4, id === 'portal' ? '#35e8ff' : '#ffd88a', night * 0.35);
    }
    for (const slot of DECOR_SLOTS) {
      const item = d.decor.slots[slot.id];
      if (item === 'lamp') glow(ctx, slot.x, slot.y - 62, 70, '#9ff4ff', night * 0.5);
    }
    glow(ctx, this.player.x, this.player.y - 30, 60, this.game.getPalette(d.activeNex).glow, night * 0.4);
  }
}

function costHtml(cost) {
  const parts = [];
  if (cost.coins) parts.push(`${icon('coin')}${fmt(cost.coins)}`);
  if (cost.energy) parts.push(`${icon('energy')}${fmt(cost.energy)}`);
  return parts.join(' ');
}
