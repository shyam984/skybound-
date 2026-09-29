// Full-screen overlays: splash, challenge intro, pause menu and the
// level-up / new-Nex celebrations.

import { el, esc, bindActions } from '../../core/dom.js';
import { fmt, fmtTime, rand } from '../../core/math.js';
import { icon } from '../icons.js';
import { NEX, RARITY } from '../../data/nex.js';
import { CHALLENGE_ORDER, DIFFICULTY_LABELS } from '../../data/challenges.js';
import { starsHtml, difficultyHtml } from './common.js';
import { drawNex } from '../../render/nexRenderer.js';

// ------------------------------------------------------------------ splash
export class SplashScreen {
  constructor(game, onStart) {
    this.game = game;
    this.onStart = onStart;
    this.ready = false;
  }

  build() {
    const node = el('div', 'splash');
    const letters = (w) => [...w].map((c, i) => `<span style="--i:${i}">${c}</span>`).join('');
    node.innerHTML = `
      <div class="splash-inner">
        <div class="logo" aria-label="Neon Nexus"><div class="logo-top">${letters('NEON')}</div><div class="logo-bottom">${letters('NEXUS')}</div></div>
        <p class="tagline">Collect energy · Build combos · Grow your island</p>
        <div class="load"><div class="bar"><i></i></div><span class="muted small load-text">Charging the Nexus…</span></div>
        <button class="btn btn-play btn-xl btn-shine start-btn" hidden>${icon('play')} TAP TO START</button>
        <p class="muted small splash-foot">${this.game.data.profile.level > 1 || this.game.data.stats.challengesPlayed ? `Welcome back · Level ${this.game.data.profile.level}` : 'Best with sound on'}</p>
      </div>`;
    this.btn = node.querySelector('.start-btn');
    this.btn.addEventListener('click', () => this.start());
    return node;
  }

  mount() {
    const bar = this.el.querySelector('.bar > i');
    requestAnimationFrame(() => (bar.style.width = '100%'));
    const fonts = document.fonts && document.fonts.ready ? Promise.race([document.fonts.ready, new Promise((r) => setTimeout(r, 1500))]) : Promise.resolve();
    Promise.all([fonts, new Promise((r) => setTimeout(r, 700))]).then(() => {
      if (!this.el || !this.el.isConnected) return;
      this.ready = true;
      this.el.querySelector('.load').hidden = true;
      this.btn.hidden = false;
      this.btn.focus({ preventScroll: true });
    });
  }

  start() {
    if (!this.ready || this.started) return;
    this.started = true;
    this.game.audio.unlock();
    this.game.audio.play('whoosh');
    this.el.classList.add('leaving');
    setTimeout(() => this.onStart(), 260);
  }

  onKey(e) {
    if (e.code === 'Enter' || e.code === 'Space') this.start();
  }
}

// ------------------------------------------------------------------ challenge intro
export class IntroScreen {
  constructor(game, def, { onStart, onBack }) {
    this.game = game;
    this.def = def;
    this.onStart = onStart;
    this.onBack = onBack;
  }

  build() {
    const g = this.game;
    const def = this.def;
    const rec = g.progress.record(def.id);
    const idx = CHALLENGE_ORDER.indexOf(def.id) + 1;
    const objective = def.type === 'tutorial' ? 'Learn to fly, collect energy and build a combo' : `Collect ${def.objective.energy} energy${def.time ? ` in ${fmtTime(def.time)}` : ''}`;
    const nexId = g.data.activeNex;
    const node = el('div', 'intro-wrap');
    node.innerHTML = `
      <div class="intro-card" role="dialog" aria-modal="true" aria-label="${esc(def.name)}">
        <div class="intro-kicker">Challenge ${idx} · ${DIFFICULTY_LABELS[def.difficulty]} ${difficultyHtml(def.difficulty)}</div>
        <h2 class="intro-title">${esc(def.name)}</h2>
        <div class="intro-obj">${icon('flag')}<div><span class="lbl">Objective</span><b>${esc(objective)}</b></div></div>
        <div class="intro-row">
          <div class="intro-tile"><span class="lbl">Best score</span><b class="num">${rec.bestScore ? fmt(rec.bestScore) : '—'}</b>${starsHtml(rec.stars || 0)}</div>
          <div class="intro-tile"><span class="lbl">Reward</span><b>${icon('coin')}${fmt(def.rewards.coins)}+ &nbsp;${icon('xp')}${fmt(def.rewards.xp)}+</b><span class="muted small">3★ at ${fmt(def.stars[1])} pts</span></div>
        </div>
        <div class="intro-nex muted">${icon('sparkle')} Playing as <b>${esc(NEX[nexId].name)}</b> — ${esc(NEX[nexId].ability.name)}</div>
        <div class="intro-actions">
          <button class="btn btn-ghost" data-action="back">${icon('back')} Island</button>
          <button class="btn btn-play btn-lg btn-shine" data-action="start">${icon('play')} START</button>
        </div>
      </div>`;
    this.unbind = bindActions(node, {
      start: () => this.start(),
      back: () => this.onBack(),
    });
    return node;
  }

  mount() {
    requestAnimationFrame(() => this.el && this.el.querySelector('[data-action="start"]').focus({ preventScroll: true }));
  }

  start() {
    if (this.started) return;
    this.started = true;
    this.game.audio.play('click');
    this.el.classList.add('leaving');
    setTimeout(() => this.onStart(), 180);
  }

  onKey(e) {
    if (e.code === 'Enter' || e.code === 'Space') {
      e.preventDefault();
      this.start();
    }
  }

  destroy() {
    if (this.unbind) this.unbind();
  }
}

// ------------------------------------------------------------------ pause
export class PauseScreen {
  constructor(game, scene) {
    this.game = game;
    this.scene = scene;
  }

  build() {
    const s = this.scene;
    const node = el('div', 'pause-wrap');
    node.innerHTML = `
      <div class="pause-card" role="dialog" aria-modal="true" aria-label="Paused">
        <h2>PAUSED</h2>
        <p class="muted">${esc(s.def.name)}</p>
        <div class="pause-stats">
          <div><span class="lbl">Score</span><b class="num">${fmt(s.stats.score)}</b></div>
          <div><span class="lbl">Energy</span><b class="num">${fmt(s.stats.energy)}</b></div>
          ${s.timed ? `<div><span class="lbl">Time</span><b class="num">${fmtTime(s.timeLeft)}</b></div>` : ''}
        </div>
        <div class="pause-actions">
          <button class="btn btn-primary btn-lg btn-block" data-action="resume">${icon('play')} Resume</button>
          <button class="btn btn-block" data-action="restart">${icon('reset')} Restart</button>
          <button class="btn btn-block" data-action="settings">${icon('gear')} Settings</button>
          <button class="btn btn-ghost btn-block" data-action="exit">${icon('island')} Exit to island</button>
        </div>
      </div>`;
    const g = this.game;
    this.unbind = bindActions(node, {
      resume: () => g.resume(),
      restart: async () => {
        const ok = await g.ui.confirm({ title: 'Restart challenge?', text: 'Your current run will be lost.', confirmLabel: 'Restart' });
        if (ok) g.restartChallenge();
      },
      settings: () => g.openSettingsFromPause(),
      exit: async () => {
        const ok = await g.ui.confirm({ title: 'Leave this challenge?', text: 'Progress in this run will not be saved.', confirmLabel: 'Leave', cancelLabel: 'Cancel' });
        if (ok) g.exitChallenge();
      },
    });
    return node;
  }

  mount() {
    requestAnimationFrame(() => this.el && this.el.querySelector('[data-action="resume"]').focus({ preventScroll: true }));
  }

  destroy() {
    if (this.unbind) this.unbind();
  }
}

// ------------------------------------------------------------------ celebrations
/** Level-up or new-Nex celebration. Lives in the modal layer. */
export class Celebration {
  constructor(game, item, onDone) {
    this.game = game;
    this.item = item;
    this.onDone = onDone;
    this.t = 0;
    this.sparks = Array.from({ length: 28 }, () => ({ a: rand(0, Math.PI * 2), r: rand(40, 150), s: rand(0.4, 1.2), c: ['#ffd34a', '#35e8ff', '#ff4fb8', '#48f5a0'][Math.floor(rand(0, 4))] }));
  }

  build() {
    const it = this.item;
    const g = this.game;
    const node = el('div', 'celebrate-wrap');
    if (it.type === 'level') {
      node.innerHTML = `
        <div class="celebrate-card" role="dialog" aria-modal="true" aria-label="Level up">
          <canvas class="cel-canvas" aria-hidden="true"></canvas>
          <div class="cel-kicker">LEVEL UP!</div>
          <div class="cel-level num">${it.level}</div>
          <div class="cel-reward">${icon('coin')} +${fmt(it.coins)} bonus coins</div>
          ${it.unlocks.length ? `<div class="cel-list"><div class="lbl">Now available</div>${it.unlocks.map((u) => `<div class="cel-item">${icon('sparkle')} ${esc(u)}</div>`).join('')}</div>` : ''}
          <button class="btn btn-play btn-lg" data-action="ok">Awesome!</button>
        </div>`;
    } else {
      const def = NEX[it.id];
      const r = RARITY[def.rarity];
      node.innerHTML = `
        <div class="celebrate-card nex" role="dialog" aria-modal="true" aria-label="New Nex unlocked" style="--nc:${def.color}">
          <canvas class="cel-canvas" aria-hidden="true"></canvas>
          <div class="cel-kicker">NEW NEX UNLOCKED!</div>
          <div class="cel-name">${esc(def.name)}</div>
          <div class="chip" style="color:${r.color}">${r.label} · ${esc(def.title)}</div>
          <p class="cel-ability">${icon('sparkle')} <b>${esc(def.ability.name)}</b> — ${esc(g.nexAbilityText(it.id))}</p>
          <div class="cel-actions">
            <button class="btn btn-ghost" data-action="ok">Later</button>
            <button class="btn btn-play btn-lg" data-action="use">Play as ${esc(def.name)}</button>
          </div>
        </div>`;
    }
    this.unbind = bindActions(node, {
      ok: () => this.close(),
      use: () => {
        g.progress.setActiveNex(it.id);
        this.close();
      },
    });
    return node;
  }

  mount() {
    const g = this.game;
    g.audio.play(this.item.type === 'level' ? 'levelUp' : 'unlock');
    if (this.item.type === 'nex') setTimeout(() => g.audio.play('voice', { id: this.item.id }), 700);
    this.canvas = this.el.querySelector('.cel-canvas');
    requestAnimationFrame(() => this.el && this.el.querySelector('.btn-play').focus({ preventScroll: true }));
  }

  update(dt) {
    this.t += dt;
    const c = this.canvas;
    if (!c || !c.isConnected) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = c.clientWidth;
    const h = c.clientHeight;
    if (c.width !== Math.round(w * dpr)) {
      c.width = Math.round(w * dpr);
      c.height = Math.round(h * dpr);
    }
    const ctx = c.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    const cx = w / 2;
    const cy = this.item.type === 'level' ? h * 0.36 : 128;
    const reduced = this.game.reducedMotion;
    // light rays
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(reduced ? 0 : this.t * 0.3);
    for (let i = 0; i < 12; i++) {
      ctx.rotate(Math.PI / 6);
      ctx.fillStyle = i % 2 ? 'rgba(255,211,74,0.08)' : 'rgba(53,232,255,0.07)';
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(-30, -260);
      ctx.lineTo(30, -260);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
    const k = Math.min(1, this.t / 0.6);
    for (const s of this.sparks) {
      const r = s.r * (0.3 + k * 0.9) + Math.sin(this.t * 2 + s.a) * 6;
      const a = s.a + (reduced ? 0 : this.t * 0.2 * s.s);
      ctx.fillStyle = s.c;
      ctx.globalAlpha = 0.8;
      ctx.beginPath();
      ctx.arc(cx + Math.cos(a) * r * 1.4, cy + Math.sin(a) * r, 2.5 * s.s + 1, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    if (this.item.type === 'nex') {
      const scale = (Math.min(w, h) / 110) * (0.4 + 0.6 * Math.min(1, this.t / 0.5));
      drawNex(ctx, this.item.id, {
        x: cx,
        y: cy + Math.sin(this.t * 2.5) * 5,
        scale,
        t: this.t,
        expr: this.t < 1.5 ? 'excited' : 'happy',
        palette: this.game.getPalette(this.item.id),
        lean: this.t < 0.8 && !reduced ? (this.t / 0.8) * Math.PI * 2 : 0,
        core: 0.8,
        quality: 'high',
      });
    }
  }

  close() {
    if (this.closed) return;
    this.closed = true;
    this.game.audio.play('click');
    if (this.unbind) this.unbind();
    this.el.classList.add('leaving');
    setTimeout(() => {
      this.el.remove();
      this.onDone();
    }, 180);
  }

  onKey(e) {
    if (e.code === 'Enter' || e.code === 'Escape') {
      e.preventDefault();
      this.close();
    }
  }
}
