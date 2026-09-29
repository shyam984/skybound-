// Settings: audio, graphics quality, reduced motion, controls, reset.

import { bindActions } from '../../core/dom.js';
import { icon } from '../icons.js';
import { panelShell } from './common.js';

export class SettingsScreen {
  constructor(game, params) {
    this.game = game;
    this.fromPause = !!params.fromPause;
  }

  build() {
    const g = this.game;
    const s = g.data.settings;
    const node = panelShell('Settings', 'gear');
    node.classList.add('settings-panel');
    const body = node.querySelector('.panel-body');
    const q = (v) => `<button class="seg-btn ${s.quality === v ? 'on' : ''}" data-action="quality" data-q="${v}" aria-pressed="${s.quality === v}">${v[0].toUpperCase() + v.slice(1)}</button>`;
    body.innerHTML = `
      <div class="set-group card">
        <label class="set-row"><span>${icon('music')} Music</span><input type="range" min="0" max="100" value="${Math.round(s.music * 100)}" data-vol="music" aria-label="Music volume"/><b class="num vol-num">${Math.round(s.music * 100)}</b></label>
        <label class="set-row"><span>${icon('sound')} Sound effects</span><input type="range" min="0" max="100" value="${Math.round(s.sfx * 100)}" data-vol="sfx" aria-label="Sound effects volume"/><b class="num vol-num">${Math.round(s.sfx * 100)}</b></label>
      </div>
      <div class="set-group card">
        <div class="set-row"><span>${icon('sparkle')} Graphics quality</span><div class="seg" role="group" aria-label="Graphics quality">${q('low')}${q('medium')}${q('high')}</div></div>
        <p class="muted small">Low reduces particles, trails and resolution for older devices.</p>
        <div class="set-row"><span>${icon('eye')} Reduced motion</span><button class="toggle ${s.reducedMotion ? 'on' : ''}" data-action="motion" role="switch" aria-checked="${s.reducedMotion}" aria-label="Reduced motion"><i></i></button></div>
        <p class="muted small">Turns off screen shake, camera zooms and most flashing effects.</p>
      </div>
      <div class="set-group card">
        <div class="set-title">${icon('keyboard')} Controls</div>
        <div class="controls-grid">
          <span class="key">WASD / Arrows</span><span>Move</span>
          <span class="key">Space / Shift</span><span>Use ability</span>
          <span class="key">Esc / P</span><span>Pause · close panels</span>
          <span class="key">E / Enter</span><span>Interact with buildings</span>
          <span class="key">Mouse hold</span><span>Steer toward the cursor</span>
          <span class="key">Touch</span><span>Drag anywhere to move · tap the ability button</span>
        </div>
      </div>
      <div class="set-group card danger-zone">
        <div class="set-row"><span>${icon('reset')} Reset progress</span><button class="btn btn-danger btn-sm" data-action="reset">Reset…</button></div>
        <p class="muted small">Progress saves automatically on this device. Resetting deletes it permanently.</p>
      </div>
      <p class="muted small version">NEON NEXUS · Version 1.0 vertical slice</p>`;
    this.unbind = bindActions(node, {
      close: () => g.back(),
      quality: (b) => {
        g.setSetting('quality', b.dataset.q);
        node.querySelectorAll('.seg-btn').forEach((x) => {
          const on = x.dataset.q === b.dataset.q;
          x.classList.toggle('on', on);
          x.setAttribute('aria-pressed', String(on));
        });
        g.audio.play('tab');
      },
      motion: (b) => {
        const v = !g.data.settings.reducedMotion;
        g.setSetting('reducedMotion', v);
        b.classList.toggle('on', v);
        b.setAttribute('aria-checked', String(v));
        g.audio.play('tab');
      },
      reset: async () => {
        const ok = await g.ui.confirm({ title: 'Reset all progress?', text: 'Your level, coins, Nex, buildings and achievements will be permanently deleted.', confirmLabel: 'Reset everything', danger: true });
        if (ok) g.resetProgress();
      },
    });
    for (const r of body.querySelectorAll('input[type="range"]')) {
      r.addEventListener('input', () => {
        const v = Number(r.value) / 100;
        g.setSetting(r.dataset.vol, v);
        r.parentElement.querySelector('.vol-num').textContent = r.value;
      });
      r.addEventListener('change', () => g.audio.play('click'));
    }
    return node;
  }

  destroy() {
    if (this.unbind) this.unbind();
  }
}
