// Island management: build & upgrade buildings, start decorating.

import { bindActions, esc } from '../../core/dom.js';
import { BUILDINGS, BUILDING_ORDER, DECOR_SLOTS, WORLD_ISLANDS } from '../../data/buildings.js';
import { icon } from '../icons.js';
import { panelShell, costHtml } from './common.js';

export class IslandPanel {
  constructor(game, params) {
    this.game = game;
    this.focus = params.focus || null;
  }

  build() {
    const g = this.game;
    const node = panelShell('Nexus Island', 'island');
    node.classList.add('island-panel');
    this.body = node.querySelector('.panel-body');
    this.render();
    this.unbind = bindActions(node, {
      __disabled: () => g.audio.play('deny'),
      close: () => g.back(),
      build: (b) => g.buildBuilding(b.dataset.id),
      decorate: () => g.startDecorating(),
      shop: () => g.navigate('SHOP', { tab: 'decor' }),
    });
    return node;
  }

  mount() {
    if (this.focus) {
      const card = this.body.querySelector(`[data-card="${this.focus}"]`);
      if (card) card.scrollIntoView({ block: 'center' });
    }
  }

  render() {
    const g = this.game;
    const d = g.data;
    const prog = g.progress;
    const cards = BUILDING_ORDER.filter((id) => !BUILDINGS[id].fixed)
      .map((id) => {
        const b = BUILDINGS[id];
        const st = prog.buildStatus(id);
        const lvl = st.level;
        const built = lvl > 0;
        let action;
        if (st.state === 'maxed') action = `<span class="chip done">${icon('check')} ${b.maxLevel > 1 ? 'Max level' : 'Built'}</span>`;
        else if (st.state === 'locked') action = `<button class="btn btn-sm" aria-disabled="true" data-action="build" data-id="${id}">${icon('lock')} ${esc(st.reason)}</button>`;
        else {
          action = `<button class="btn btn-sm ${st.afford ? 'btn-green' : ''}" ${st.afford ? '' : 'aria-disabled="true"'} data-action="build" data-id="${id}">${icon('build')} ${built ? `Upgrade to Lv ${st.next}` : 'Build'}</button>`;
        }
        const effect = b.effect ? b.effect(Math.max(1, lvl), b) : '';
        const nextEffect = b.effect && st.next && built ? b.effect(st.next, b) : '';
        return `<div class="bd-card card ${built ? 'built' : ''} ${this.focus === id ? 'focus' : ''}" data-card="${id}">
          <div class="bd-icon">${icon(b.icon)}</div>
          <div class="bd-main">
            <div class="bd-title"><b>${esc(b.name)}</b>${built && b.maxLevel > 1 ? `<span class="chip">Lv ${lvl} / ${b.maxLevel}</span>` : ''}${!built ? '<span class="chip">Not built</span>' : ''}</div>
            <p class="muted small">${esc(b.desc)}</p>
            ${effect ? `<div class="bd-effect">${icon('sparkle')} ${esc(effect)}${nextEffect && nextEffect !== effect ? ` <span class="muted">→ ${esc(nextEffect)}</span>` : ''}</div>` : ''}
            ${st.cost && st.state !== 'maxed' ? `<div class="bd-cost">${costHtml(st.cost, d.profile)}</div>` : ''}
          </div>
          <div class="bd-act">${action}</div>
        </div>`;
      })
      .join('');
    const garden = d.buildings.garden.level > 0;
    const placed = prog.decorCount();
    const inv = Object.values(d.decor.inventory).reduce((a, b) => a + b, 0);
    this.body.innerHTML = `
      <p class="muted">Construct buildings to grow your island. Each one appears on Nexus Island with its own effect.</p>
      <div class="bd-list">${cards}</div>
      <div class="section-title">Decorations</div>
      <div class="card deco-card">
        <div class="bd-icon">${icon('decor')}</div>
        <div class="bd-main">
          <b>Decorate your island</b>
          <p class="muted small">${garden ? `${placed} / ${DECOR_SLOTS.length} spots used · ${inv} in storage · +${placed}% energy bonus` : 'Build the Garden to unlock 8 decoration spots.'}</p>
        </div>
        <div class="bd-act">${garden ? `<button class="btn btn-pink btn-sm" data-action="decorate">${icon('decor')} Decorate</button><button class="btn btn-ghost btn-sm" data-action="shop">Buy decor</button>` : `<button class="btn btn-sm" aria-disabled="true" data-action="decorate">${icon('lock')} Needs Garden</button>`}</div>
      </div>
      <div class="section-title">World</div>
      <div class="world-list">
        <div class="card world-card on"><b>Nexus Island</b><span class="muted small">Your home · Hub Lv ${d.buildings.hub.level}</span></div>
        ${WORLD_ISLANDS.map((w) => `<div class="card world-card">${icon('lock')}<b>${esc(w.name)}</b><span class="muted small">${esc(w.note)}</span></div>`).join('')}
      </div>`;
  }

  destroy() {
    if (this.unbind) this.unbind();
  }
}

