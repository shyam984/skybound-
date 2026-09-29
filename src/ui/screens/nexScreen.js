// Nex collection: grid of characters + animated detail view with ability,
// stats, level/XP, upgrades and skins. Locked Nex show as silhouettes.

import { bindActions, esc } from '../../core/dom.js';
import { fmt, rand } from '../../core/math.js';
import { NEX, NEX_ORDER, RARITY, STAT_KEYS, NEX_LEVELS, MAX_NEX_LEVEL } from '../../data/nex.js';
import { SKINS } from '../../data/shop.js';
import { icon } from '../icons.js';
import { panelShell } from './common.js';
import { drawNex, drawNexPortrait } from '../../render/nexRenderer.js';

export class NexScreen {
  constructor(game, params) {
    this.game = game;
    this.selected = params.id || game.data.activeNex;
    this.t = 0;
    this.expr = 'idle';
    this.exprT = 0;
    this.blink = 0;
    this.nextBlink = 2;
    this.burst = 0;
  }

  build() {
    const g = this.game;
    const unlocked = NEX_ORDER.filter((id) => g.data.nex[id].unlocked).length;
    const node = panelShell('Nex', 'nex', { headExtra: `<span class="chip">${unlocked} / ${NEX_ORDER.length} discovered</span>` });
    node.classList.add('nex-panel');
    this.body = node.querySelector('.panel-body');
    this.render();
    this.unbind = bindActions(node, {
      __disabled: () => g.audio.play('deny'),
      close: () => g.back(),
      pick: (b) => {
        this.selected = b.dataset.id;
        g.audio.play('tab');
        if (g.data.nex[this.selected].unlocked) {
          g.audio.play('voice', { id: this.selected });
          this.react('happy');
        }
        this.render();
      },
      activate: () => {
        if (g.progress.setActiveNex(this.selected)) {
          g.audio.play('voice', { id: this.selected });
          this.react('excited');
          this.render();
        }
      },
      upgrade: () => {
        if (g.upgradeNex(this.selected)) {
          this.react('excited');
          this.burst = 1;
          this.render();
        } else g.audio.play('deny');
      },
      skin: (b) => {
        g.setSkin(this.selected, b.dataset.skin || null);
        this.react('happy');
        this.render();
      },
      shop: () => g.navigate('SHOP', { tab: 'skins' }),
      lab: () => g.navigate('ISLAND'),
    });
    return node;
  }

  react(expr) {
    this.expr = expr;
    this.exprT = 1.4;
  }

  render() {
    const g = this.game;
    const d = g.data;
    const id = this.selected;
    const def = NEX[id];
    const nx = d.nex[id];
    const st = g.progress.nexStatus(id);
    const rar = RARITY[def.rarity];
    const up = g.progress.nexUpgradeStatus(id);
    const next = NEX_LEVELS[nx.level + 1];
    const prevXp = NEX_LEVELS[nx.level].xp;
    const xpFrac = next ? Math.min(1, (nx.xp - prevXp) / (next.xp - prevXp)) : 1;
    const skins = SKINS.filter((s) => s.nex === id);
    const ownedSkins = skins.filter((s) => d.cosmetics.owned.includes(s.id));
    const lvBonus = nx.level - 1;

    let detail;
    if (!nx.unlocked) {
      const pct = Math.min(100, (st.progress / st.target) * 100);
      detail = `
        <div class="nx-hero locked"><canvas class="nx-canvas" aria-label="${esc(def.name)} silhouette"></canvas><div class="nx-lock">${icon('lock')}</div></div>
        <div class="nx-info">
          <div class="nx-title"><h3>${esc(def.name)}</h3><span class="chip" style="color:${rar.color}">${rar.label}</span></div>
          <p class="muted">${esc(def.title)} · ${esc(def.personality)}</p>
          <div class="nx-ability card"><div class="lbl">Ability</div><b>${icon('sparkle')} ${esc(def.ability.name)}</b><p>${esc(g.nexAbilityText(id))}</p></div>
          <div class="nx-unlock card">
            <div class="lbl">How to unlock</div>
            <b>${esc(st.text)}</b>
            <div class="bar gold"><i style="width:${pct}%"></i></div>
            <div class="muted num">${st.unit === 'clear' ? (st.progress ? 'Done' : 'Not yet cleared') : `${fmt(Math.min(st.progress, st.target))} / ${fmt(st.target)} ${esc(st.unit)}`}</div>
          </div>
        </div>`;
    } else {
      detail = `
        <div class="nx-hero" style="--nc:${def.color}"><canvas class="nx-canvas" aria-label="${esc(def.name)}"></canvas></div>
        <div class="nx-info">
          <div class="nx-title"><h3>${esc(def.name)}</h3><span class="chip" style="color:${rar.color}">${rar.label}</span><span class="chip">Lv ${nx.level}</span></div>
          <p class="muted">${esc(def.title)} · ${esc(def.personality)}</p>
          <p class="nx-bio">${esc(def.bio)}</p>
          <div class="nx-ability card"><div class="lbl">Ability</div><b>${icon('sparkle')} ${esc(def.ability.name)}</b><p>${esc(g.nexAbilityText(id))}</p><small class="muted">Cooldown ${g.nexAbility(id).cooldown.toFixed(1)}s</small></div>
          <div class="nx-stats">
            ${STAT_KEYS.map((s) => `<div class="stat"><span>${s.label}</span><div class="stat-bar" role="meter" aria-label="${s.label}" aria-valuemin="0" aria-valuemax="10" aria-valuenow="${def.stats[s.id]}">${Array.from({ length: 10 }, (_, i) => `<i class="${i < def.stats[s.id] ? 'on' : ''}"></i>`).join('')}</div><b class="num">${def.stats[s.id]}</b></div>`).join('')}
            ${lvBonus > 0 ? `<div class="muted small">Level ${nx.level} bonus: +${lvBonus * 2}% speed, +${lvBonus * 8}% ability duration, −${lvBonus * 6}% cooldown</div>` : ''}
          </div>
          <div class="nx-level card">
            <div class="row"><b>Level ${nx.level}${nx.level >= MAX_NEX_LEVEL ? ' · MAX' : ''}</b><span class="muted num">${next ? `${fmt(Math.max(0, nx.xp - prevXp))} / ${fmt(next.xp - prevXp)} Nex XP` : 'Fully upgraded'}</span></div>
            <div class="bar xp"><i style="width:${xpFrac * 100}%"></i></div>
            <p class="muted small">Nex earn XP when you play with them: +100 per clear, +10 per special orb, +50 per mission.</p>
            ${up.maxed ? '' : `<div class="nx-upgrade">
              <button class="btn ${up.ok ? 'btn-green' : ''}" data-action="upgrade" ${up.ok ? '' : 'aria-disabled="true"'}>${icon('build')} Upgrade to Lv ${nx.level + 1}<span class="btn-sub">${icon('coin')}${fmt(up.cost.coins)}</span></button>
              ${up.ok ? '' : `<span class="muted small">${esc(up.reason)}${!(d.buildings.lab.level > 0) ? ` <button class="link" data-action="lab">Go build it</button>` : ''}</span>`}
            </div>`}
          </div>
          <div class="nx-skins">
            <div class="lbl">Skins</div>
            <div class="skin-row">
              <button class="skin-btn ${!nx.skin ? 'on' : ''}" data-action="skin" data-skin="" aria-pressed="${!nx.skin}"><canvas data-skin-prev=""></canvas><span>Classic</span></button>
              ${ownedSkins.map((s) => `<button class="skin-btn ${nx.skin === s.id ? 'on' : ''}" data-action="skin" data-skin="${s.id}" aria-pressed="${nx.skin === s.id}"><canvas data-skin-prev="${s.id}"></canvas><span>${esc(s.name)}</span></button>`).join('')}
              ${skins.length > ownedSkins.length ? `<button class="skin-btn more" data-action="shop">${icon('shop')}<span>Get more</span></button>` : ''}
            </div>
          </div>
          <div class="nx-actions">
            ${d.activeNex === id ? `<button class="btn btn-block" disabled>${icon('check')} Active Nex</button>` : `<button class="btn btn-primary btn-lg btn-block" data-action="activate">Play as ${esc(def.name)}</button>`}
          </div>
        </div>`;
    }

    this.body.innerHTML = `
      <div class="nx-layout">
        <div class="nx-detail">${detail}</div>
        <div class="nx-grid" role="list">
          ${NEX_ORDER.map((nid) => {
            const n = d.nex[nid];
            const r = RARITY[NEX[nid].rarity];
            return `<button role="listitem" class="nx-card ${nid === id ? 'sel' : ''} ${n.unlocked ? '' : 'locked'}" data-action="pick" data-id="${nid}" style="--nc:${NEX[nid].color}" aria-label="${n.unlocked ? NEX[nid].name : 'Locked Nex'}">
              <canvas data-card="${nid}"></canvas>
              <span class="nx-card-name">${n.unlocked ? esc(NEX[nid].name) : '???'}</span>
              <span class="nx-card-meta" style="color:${r.color}">${r.label}${n.unlocked ? ` · Lv ${n.level}` : ''}</span>
              ${d.activeNex === nid ? `<span class="nx-active">${icon('check')}</span>` : ''}
              ${!n.unlocked ? `<span class="nx-card-lock">${icon('lock')}</span>` : ''}
            </button>`;
          }).join('')}
        </div>
      </div>`;
    this.canvas = this.body.querySelector('.nx-canvas');
    for (const c of this.body.querySelectorAll('canvas[data-card]')) {
      const nid = c.dataset.card;
      const unlocked = d.nex[nid].unlocked;
      drawNexPortrait(c, nid, { palette: g.getPalette(nid), flat: unlocked ? null : '#2a3470', zoom: 1.05 });
    }
    for (const c of this.body.querySelectorAll('canvas[data-skin-prev]')) {
      const sid = c.dataset.skinPrev;
      const skin = SKINS.find((s) => s.id === sid);
      drawNexPortrait(c, id, { palette: skin ? { ...def.palette, ...skin.palette } : def.palette, zoom: 1 });
    }
    this.sizeCanvas();
  }

  sizeCanvas() {
    const c = this.canvas;
    if (!c) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = c.clientWidth || 220;
    const h = c.clientHeight || 220;
    c.width = Math.round(w * dpr);
    c.height = Math.round(h * dpr);
    this.cw = w;
    this.ch = h;
    this.dpr = dpr;
  }

  update(dt) {
    const c = this.canvas;
    if (!c || !c.isConnected) return;
    if (!this.cw || c.clientWidth !== this.cw) this.sizeCanvas();
    this.t += dt;
    if (this.exprT > 0) {
      this.exprT -= dt;
      if (this.exprT <= 0) this.expr = 'idle';
    }
    this.nextBlink -= dt;
    if (this.nextBlink <= 0) {
      this.blink = 1;
      this.nextBlink = rand(2, 4.5);
    }
    this.blink = Math.max(0, this.blink - dt * 7);
    this.burst = Math.max(0, this.burst - dt);
    const g = this.game;
    const id = this.selected;
    const unlocked = g.data.nex[id].unlocked;
    const ctx = c.getContext('2d');
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, this.cw, this.ch);
    const scale = Math.min(this.cw, this.ch) / 95;
    const bob = Math.sin(this.t * 2.4) * 6 * (g.reducedMotion ? 0.3 : 1);
    // platform
    const cx = this.cw / 2;
    const cy = this.ch / 2;
    const plat = ctx.createRadialGradient(cx, cy + 36 * scale, 2, cx, cy + 36 * scale, 40 * scale);
    plat.addColorStop(0, unlocked ? 'rgba(53,232,255,0.45)' : 'rgba(120,130,200,0.25)');
    plat.addColorStop(1, 'rgba(53,232,255,0)');
    ctx.fillStyle = plat;
    ctx.beginPath();
    ctx.ellipse(cx, cy + 36 * scale, 40 * scale, 11 * scale, 0, 0, Math.PI * 2);
    ctx.fill();
    if (this.burst > 0) {
      ctx.strokeStyle = `rgba(255,211,74,${this.burst})`;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(cx, cy, (1 - this.burst) * 60 * scale, 0, Math.PI * 2);
      ctx.stroke();
    }
    const abilityPulse = unlocked && this.t % 6 > 4.6;
    drawNex(ctx, id, {
      x: cx,
      y: cy + bob - 4 * scale,
      scale,
      t: this.t,
      look: { x: Math.sin(this.t * 0.7) * 0.5, y: 0.1 },
      blink: this.blink,
      expr: unlocked ? this.expr : 'idle',
      palette: g.getPalette(id),
      flat: unlocked ? null : '#27306a',
      ability: abilityPulse,
      core: abilityPulse ? 0.8 : 0.2,
      quality: 'high',
      nearby: 0.5,
      lean: Math.sin(this.t * 0.9) * 0.05,
    });
  }

  destroy() {
    if (this.unbind) this.unbind();
  }
}
