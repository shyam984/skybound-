// In-challenge HUD. Built once per run; per-frame updates only touch the DOM
// when a displayed value actually changes.

import { pulseClass } from '../core/dom.js';
import { fmt, fmtTime } from '../core/math.js';
import { icon } from './icons.js';
import { drawNexPortrait } from '../render/nexRenderer.js';

export class HUD {
  constructor(game, root) {
    this.game = game;
    this.root = root;
    this.cache = {};
  }

  show(scene) {
    const def = scene.def;
    const p = scene.player;
    this.cache = {};
    this.root.innerHTML = `
      <div class="hud-tl">
        <button class="btn btn-icon hud-pause" aria-label="Pause (Esc)">${icon('pause')}</button>
        <div class="shields" role="img" aria-label="Shields">
          ${[0, 1, 2].map(() => `<span class="shield-pip">${icon('shield')}</span>`).join('')}
        </div>
      </div>
      <div class="hud-tc">
        <div class="score-box"><div class="score-label">SCORE</div><div class="score num">0</div></div>
        <div class="combo-box" aria-live="off">
          <div class="combo-mult">x1</div>
          <div class="combo-meta"><span class="combo-count num">0</span><span class="combo-label">COMBO</span></div>
          <div class="combo-bar"><i></i></div>
        </div>
      </div>
      <div class="hud-tr">
        ${scene.timed ? `<div class="hud-pill timer">${icon('timer')}<span class="num">${fmtTime(def.time)}</span></div>` : ''}
        <div class="hud-pill objective">${icon('energy')}<span class="num obj-num">0</span><span class="obj-target">/ ${def.objective.energy}</span></div>
      </div>
      <div class="hud-hint" aria-live="polite"></div>
      <div class="hud-big"></div>
      <div class="hud-banner"></div>
      <button class="ability-btn" aria-label="Use ability ${p.ability.name} (Space)">
        <span class="ab-ring"></span>
        <canvas class="ab-portrait" width="64" height="64"></canvas>
        <span class="ab-name">${p.ability.name}</span>
        <span class="ab-key">SPACE</span>
      </button>`;
    this.root.hidden = false;
    const r = this.root;
    this.els = {
      pause: r.querySelector('.hud-pause'),
      pips: [...r.querySelectorAll('.shield-pip')],
      shields: r.querySelector('.shields'),
      score: r.querySelector('.score'),
      scoreBox: r.querySelector('.score-box'),
      comboBox: r.querySelector('.combo-box'),
      mult: r.querySelector('.combo-mult'),
      count: r.querySelector('.combo-count'),
      bar: r.querySelector('.combo-bar > i'),
      timer: r.querySelector('.timer span'),
      timerPill: r.querySelector('.timer'),
      obj: r.querySelector('.obj-num'),
      objPill: r.querySelector('.objective'),
      objTarget: r.querySelector('.obj-target'),
      hint: r.querySelector('.hud-hint'),
      big: r.querySelector('.hud-big'),
      banner: r.querySelector('.hud-banner'),
      ability: r.querySelector('.ability-btn'),
      abRing: r.querySelector('.ab-ring'),
      abKey: r.querySelector('.ab-key'),
      portrait: r.querySelector('.ab-portrait'),
    };
    this.els.pause.addEventListener('click', () => this.game.pause());
    this.els.ability.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      scene.useAbility();
    });
    this.els.ability.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') scene.useAbility();
    });
    if (this.game.input.isTouch()) this.els.abKey.hidden = true;
    if (def.type === 'tutorial') {
      this.els.objPill.querySelector('.obj-target').textContent = '';
    }
    requestAnimationFrame(() => drawNexPortrait(this.els.portrait, p.id, { palette: p.palette, zoom: 1.1, expr: 'happy' }));
    this.update(scene);
  }

  hide() {
    this.root.hidden = true;
    this.root.innerHTML = '';
    this.els = null;
  }

  set(key, value, fn) {
    if (this.cache[key] === value) return;
    this.cache[key] = value;
    fn(value);
  }

  update(scene) {
    const e = this.els;
    if (!e) return;
    const s = scene.stats;
    const p = scene.player;
    this.set('score', s.score, (v) => (e.score.textContent = fmt(v)));
    const c = scene.combo;
    this.set('mult', c.mult, (v) => {
      e.mult.textContent = `x${v}`;
      e.comboBox.dataset.tier = String(v);
    });
    this.set('count', c.count, (v) => {
      e.count.textContent = v;
      e.comboBox.classList.toggle('live', v > 0);
    });
    const prog = Math.round(c.progress * 100) / 100;
    this.set('bar', prog, (v) => (e.bar.style.transform = `scaleX(${v})`));
    this.set('echo', scene.combo.drainMult < 1, (v) => e.comboBox.classList.toggle('slowed', v));
    if (e.timer) {
      const secs = Math.ceil(scene.timeLeft);
      this.set('timer', secs, (v) => {
        e.timer.textContent = fmtTime(v);
        e.timerPill.classList.toggle('low', v <= 10);
      });
    }
    this.set('energy', s.energy, (v) => (e.obj.textContent = v));
    this.set('objDone', scene.objectiveDone || scene.gate.open, (v) => {
      e.objPill.classList.toggle('done', v);
      if (v && scene.def.type !== 'tutorial') e.objTarget.innerHTML = `${icon('check')}`;
    });
    this.set('shields', p.shields, (v) => {
      e.pips.forEach((pip, i) => pip.classList.toggle('off', i >= v));
      e.shields.setAttribute('aria-label', `${v} of 3 shields`);
    });
    // ability cooldown ring
    let frac = 1;
    let state = 'ready';
    if (p.abilityActive > 0) {
      state = 'active';
      frac = p.abilityActive / (p.ability.id === 'burst' ? 0.6 : p.ability.duration);
    } else if (p.abilityCd > 0) {
      state = 'cooldown';
      frac = 1 - p.abilityCd / p.ability.cooldown;
    }
    const fr = Math.round(frac * 100) / 100;
    this.set('abFrac', fr, (v) => e.ability.style.setProperty('--cd', v));
    this.set('abState', state, (v) => {
      e.ability.dataset.state = v;
      if (v === 'ready') pulseClass(e.ability, 'ready-pop');
    });
  }

  pulseScore() {
    if (this.els) pulseClass(this.els.scoreBox, 'tick');
  }

  comboTier(mult) {
    if (!this.els) return;
    pulseClass(this.els.comboBox, 'tier-up');
    if (mult >= 5) pulseClass(this.els.comboBox, 'max');
  }

  shieldLost(n) {
    if (!this.els) return;
    const pip = this.els.pips[n];
    if (pip) pulseClass(pip, 'break');
    pulseClass(this.els.shields, 'shake');
  }

  shieldGained() {
    if (!this.els) return;
    pulseClass(this.els.shields, 'gain');
  }

  abilityUsed() {
    if (!this.els) return;
    pulseClass(this.els.ability, 'fired');
  }

  abilityDenied() {
    if (!this.els) return;
    pulseClass(this.els.ability, 'denied');
  }

  highlightAbility(on) {
    if (this.els) this.els.ability.classList.toggle('coach', on);
  }

  hint(html) {
    if (!this.els) return;
    const h = this.els.hint;
    if (!html) {
      h.classList.remove('on');
      return;
    }
    h.innerHTML = html;
    pulseClass(h, 'on');
  }

  bigText(text, cls = '') {
    if (!this.els) return;
    const b = this.els.big;
    b.className = `hud-big ${cls}`;
    b.textContent = text;
    pulseClass(b, 'show');
  }

  banner(title, sub = '', cls = '') {
    if (!this.els) return;
    const b = this.els.banner;
    b.className = `hud-banner ${cls}`;
    b.innerHTML = `<div class="hb-title">${title}</div>${sub ? `<div class="hb-sub">${sub}</div>` : ''}`;
    pulseClass(b, 'show');
  }
}
