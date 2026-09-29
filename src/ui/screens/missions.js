// Missions: three daily missions + achievements with progress.

import { bindActions, esc } from '../../core/dom.js';
import { fmt } from '../../core/math.js';
import { icon } from '../icons.js';
import { panelShell, tabsHtml } from './common.js';

const TABS = [
  { id: 'daily', label: 'Daily', icon: 'mission' },
  { id: 'achievements', label: 'Achievements', icon: 'trophy' },
];

export class MissionsScreen {
  constructor(game, params) {
    this.game = game;
    this.tab = params.tab || 'daily';
    this.clock = 0;
  }

  build() {
    const g = this.game;
    const node = panelShell('Missions', 'missions', { tabs: tabsHtml(TABS, this.tab) });
    node.classList.add('missions-panel');
    this.node = node;
    this.body = node.querySelector('.panel-body');
    this.render();
    this.unbind = bindActions(node, {
      close: () => g.back(),
      tab: (b) => {
        this.tab = b.dataset.tab;
        g.audio.play('tab');
        node.querySelectorAll('.tab').forEach((t) => {
          const on = t.dataset.tab === this.tab;
          t.classList.toggle('active', on);
          t.setAttribute('aria-selected', String(on));
        });
        this.render();
      },
      claim: (b) => {
        if (g.claimMission(b.dataset.id, b)) this.render();
      },
      play: () => g.navigate('CHALLENGE_SELECT'),
    });
    return node;
  }

  render() {
    if (this.tab === 'daily') this.renderDaily();
    else this.renderAchievements();
  }

  resetText() {
    const ms = this.game.missions.msUntilReset();
    const h = Math.floor(ms / 3600000);
    const m = Math.floor((ms % 3600000) / 60000);
    return `${h}h ${String(m).padStart(2, '0')}m`;
  }

  renderDaily() {
    const g = this.game;
    const list = g.missions.missions();
    this.body.innerHTML = `
      <div class="ms-head"><span class="muted">New missions in <b class="reset-clock">${this.resetText()}</b></span><span class="chip">${list.filter((m) => m.claimed).length} / 3 claimed</span></div>
      <div class="ms-list">
        ${list
          .map((m) => {
            const pct = Math.min(100, (m.progress / m.target) * 100);
            return `<div class="ms-card card ${m.complete ? 'complete' : ''} ${m.claimed ? 'claimed' : ''}">
              <div class="ms-icon">${icon(m.icon)}</div>
              <div class="ms-main">
                <b>${esc(m.text)}</b>
                <div class="bar ${m.complete ? 'green' : ''}"><i style="width:${pct}%"></i></div>
                <div class="ms-meta"><span class="num">${fmt(m.progress)} / ${fmt(m.target)}</span><span class="ms-rw">${icon('coin')}${m.reward.coins} ${icon('xp')}${m.reward.xp} XP</span></div>
              </div>
              <div class="ms-act">${
                m.claimed
                  ? `<span class="chip done">${icon('check')} Claimed</span>`
                  : m.complete
                    ? `<button class="btn btn-play btn-sm" data-action="claim" data-id="${m.id}">${icon('gift')} Claim</button>`
                    : `<button class="btn btn-ghost btn-sm" data-action="play">Play</button>`
              }</div>
            </div>`;
          })
          .join('')}
      </div>
      <p class="muted small ms-foot">Missions progress in any challenge. Claiming also gives your active Nex +50 Nex XP.</p>`;
  }

  renderAchievements() {
    const g = this.game;
    const list = g.achievements.list();
    const done = list.filter((a) => a.unlocked).length;
    this.body.innerHTML = `
      <div class="ms-head"><span class="muted">Achievements reward coins automatically.</span><span class="chip">${done} / ${list.length}</span></div>
      <div class="ach-grid">
        ${list
          .map(
            (a) => `<div class="ach card ${a.unlocked ? 'on' : ''}">
              <div class="ach-icon">${icon(a.icon)}${a.unlocked ? `<span class="ach-check">${icon('check')}</span>` : ''}</div>
              <div class="ach-main">
                <b>${esc(a.name)}</b>
                <span class="muted small">${esc(a.desc)}</span>
                <div class="bar ${a.unlocked ? 'gold' : ''}"><i style="width:${a.progress * 100}%"></i></div>
                <div class="ms-meta"><span class="num">${a.unlocked ? 'Unlocked' : `${fmt(a.value)} / ${fmt(a.target)}`}</span><span>${icon('coin')}${a.reward}</span></div>
              </div>
            </div>`,
          )
          .join('')}
      </div>`;
  }

  update(dt) {
    this.clock += dt;
    if (this.clock > 20 && this.tab === 'daily') {
      this.clock = 0;
      const c = this.body.querySelector('.reset-clock');
      if (c) c.textContent = this.resetText();
    }
  }

  destroy() {
    if (this.unbind) this.unbind();
  }
}
